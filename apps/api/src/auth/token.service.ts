import { HttpStatus, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ERROR_CODES, type UserRole, type UserStatus } from "@kidir/shared";
import { DomainException } from "../common/exceptions/domain.exception";
import { PrismaService } from "../prisma/prisma.service";
import { env } from "../config/env";
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from "./auth.constants";
import { randomToken, sha256Hex, uuidV7 } from "./auth.crypto";
import { assertAccountUsable } from "./account-state";
import type { IssuedTokens } from "./auth.cookies";

/** Who the session belongs to, as far as token issuing is concerned. */
export interface TokenSubject {
  id: string;
  role: UserRole;
  status: UserStatus;
}

/** Recorded on every refresh row so a stolen family can be traced afterwards. */
export interface SessionContext {
  ip?: string;
  userAgent?: string;
}

export interface RotatedSession {
  tokens: IssuedTokens;
  user: TokenSubject;
}

const REFRESH_SUBJECT_SELECT = { id: true, role: true, status: true } as const;

/**
 * Issues, rotates and revokes the cookie-borne session.
 *
 * The refresh token is a signed JWT *and* a database row. The signature makes
 * a forged token cheap to reject; the row is what actually decides validity,
 * because only a row can be revoked. A JWT alone cannot express "this session
 * ended two minutes ago", which is the entire point of reuse detection.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /** Starts a new token family: one login, one chain of rotations. */
  async issueSession(user: TokenSubject, context: SessionContext): Promise<IssuedTokens> {
    const familyId = uuidV7();
    const refreshToken = await this.signRefreshToken(user.id, familyId);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256Hex(refreshToken),
        familyId,
        expiresAt: refreshExpiry(),
        ip: context.ip,
        userAgent: context.userAgent,
      },
    });

    return { accessToken: await this.signAccessToken(user), refreshToken };
  }

  /**
   * Exchanges a refresh token for a fresh pair, closing the old row.
   *
   * Replaying a token that was already rotated is the signature of a stolen
   * cookie: the legitimate client and the thief cannot both hold the newest
   * token, so the loser replays an old one. There is no way to tell victim
   * from thief, so the whole family dies and both must sign in again.
   */
  async rotate(rawToken: string, context: SessionContext): Promise<RotatedSession> {
    const subject = await this.verifyRefreshToken(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256Hex(rawToken) },
    });

    if (existing === null || existing.userId !== subject) {
      throw invalidRefresh();
    }

    if (existing.revokedAt !== null) {
      // Revoked outside the rotation transaction on purpose: it has to survive
      // the exception thrown on the next line.
      await this.revokeFamily(existing.familyId);
      throw DomainException.unauthorized(
        ERROR_CODES.REFRESH_REUSE_DETECTED,
        "Sessiya xavfsizlik sababli tugatildi, qaytadan kiring",
      );
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw DomainException.unauthorized(
        ERROR_CODES.SESSION_EXPIRED,
        "Sessiya muddati tugagan, qaytadan kiring",
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id: existing.userId, deletedAt: null },
      select: REFRESH_SUBJECT_SELECT,
    });

    if (user === null) {
      throw invalidRefresh();
    }

    assertAccountUsable(user);

    const refreshToken = await this.signRefreshToken(user.id, existing.familyId);

    await this.prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: sha256Hex(refreshToken),
          familyId: existing.familyId,
          expiresAt: refreshExpiry(),
          ip: context.ip,
          userAgent: context.userAgent,
        },
      });

      // The `revokedAt: null` filter is the concurrency control: two parallel
      // refreshes with the same token both reach here, and the row lock lets
      // exactly one of them match. The loser rolls back the row it just
      // created instead of handing out a second live token.
      const closed = await tx.refreshToken.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedById: created.id },
      });

      if (closed.count !== 1) {
        throw invalidRefresh();
      }
    });

    return { tokens: { accessToken: await this.signAccessToken(user), refreshToken }, user };
  }

  /** Logout. Ends the whole family, not just the presented token. */
  async revokeSession(rawToken: string): Promise<void> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256Hex(rawToken) },
      select: { familyId: true },
    });

    if (existing !== null) {
      await this.revokeFamily(existing.familyId);
    }
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private signAccessToken(user: TokenSubject): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.id, role: user.role },
      { secret: env.JWT_ACCESS_SECRET, expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    );
  }

  /**
   * `jti` is not read back — it is there so two tokens signed for the same
   * user in the same second are still different strings, which the unique
   * `tokenHash` column requires.
   */
  private signRefreshToken(userId: string, familyId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, fam: familyId, jti: randomToken(16) },
      { secret: env.JWT_REFRESH_SECRET, expiresIn: REFRESH_TOKEN_TTL_SECONDS },
    );
  }

  /** Returns the subject id; the database still decides whether it is usable. */
  private async verifyRefreshToken(rawToken: string): Promise<string> {
    let payload: Record<string, unknown>;

    try {
      payload = await this.jwt.verifyAsync<Record<string, unknown>>(rawToken, {
        secret: env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw invalidRefresh();
    }

    const subject = payload.sub;
    if (typeof subject !== "string" || subject.length === 0) {
      throw invalidRefresh();
    }

    return subject;
  }
}

function refreshExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
}

function invalidRefresh(): DomainException {
  return new DomainException(
    ERROR_CODES.REFRESH_TOKEN_INVALID,
    "Refresh token yaroqsiz",
    HttpStatus.UNAUTHORIZED,
  );
}
