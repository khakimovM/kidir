import { HttpStatus, Injectable, type OnModuleInit } from "@nestjs/common";
import { Prisma, type User } from "@prisma/client";
import * as argon2 from "argon2";
import type { z } from "zod";
import {
  ERROR_CODES,
  zRequestEmailOtp,
  zRequestPhoneOtp,
  zVerifyEmailOtp,
  zVerifyPhoneOtp,
  type Login,
  type OtpRequestResponse,
  type Register,
  type SessionUser,
} from "@kidir/shared";
import { DomainException } from "../common/exceptions/domain.exception";
import { PrismaService } from "../prisma/prisma.service";
import { OtpService } from "../otp/otp.contract";
import { UsersService } from "../users/users.service";
import { ARGON2_OPTIONS } from "./auth.constants";
import { randomToken } from "./auth.crypto";
import { assertAccountUsable } from "./account-state";
import { TokenService, type SessionContext } from "./token.service";
import type { IssuedTokens } from "./auth.cookies";

/** What every sign-in path produces: cookies for the controller, user for the body. */
export interface SessionResult {
  user: SessionUser;
  tokens: IssuedTokens;
}

/** The identity Google vouched for, already normalised. */
export interface GoogleProfile {
  googleId: string;
  email: string;
  fullName: string;
}

// `packages/shared` exports these schemas but not their inferred types, and
// contracts are never re-declared here — so infer them from the schema itself.
type RequestPhoneOtpInput = z.infer<typeof zRequestPhoneOtp>;
type VerifyPhoneOtpInput = z.infer<typeof zVerifyPhoneOtp>;
type RequestEmailOtpInput = z.infer<typeof zRequestEmailOtp>;
type VerifyEmailOtpInput = z.infer<typeof zVerifyEmailOtp>;

const PHONE_PATTERN = /^\+998\d{9}$/;

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHashPromise: Promise<string> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
    private readonly otp: OtpService,
  ) {}

  /**
   * Warms the decoy hash so the first failed login is not measurably faster
   * (or slower) than every later one.
   */
  async onModuleInit(): Promise<void> {
    await this.dummyHash();
  }

  // --- Phone OTP -----------------------------------------------------------

  /**
   * Deliberately does not check whether the phone is already registered.
   * Answering that here would turn the endpoint into a "is this number a
   * Kidir user?" oracle for anyone. The collision is reported by `register`
   * instead — after the caller has proved they own the number.
   */
  requestPhoneOtp(input: RequestPhoneOtpInput): Promise<OtpRequestResponse> {
    return this.otp.issue("phone", input.phone);
  }

  /** Leaves the verification marker `register` (or `attachPhone`) will claim. */
  async verifyPhoneOtp(input: VerifyPhoneOtpInput): Promise<void> {
    await this.otp.verify("phone", input.phone, input.code);
  }

  // --- Registration and login ----------------------------------------------

  async register(input: Register, context: SessionContext): Promise<SessionResult> {
    // Checked before the marker is consumed: a taken email must not cost the
    // caller their phone verification and another SMS.
    await this.assertPhoneAvailable(input.phone);
    await this.assertEmailAvailable(input.email);

    const verified = await this.otp.consumeVerification("phone", input.phone);
    if (!verified) {
      throw new DomainException(
        ERROR_CODES.OTP_NOT_VERIFIED,
        "Telefon raqam tasdiqlanmagan yoki tasdiq muddati o'tgan",
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.createUser({
      role: input.role,
      phone: input.phone,
      phoneVerifiedAt: new Date(),
      // SMS verification is the whole of v1 KYC (docs/PLAN.md 5.3).
      kycLevel: "PHONE",
      email: input.email,
      passwordHash: await argon2.hash(input.password, ARGON2_OPTIONS),
      fullName: input.fullName,
    });

    return this.startSession(user, context);
  }

  /**
   * Every failure here answers `INVALID_CREDENTIALS`, and an unknown
   * identifier still costs one argon2 verification against a decoy hash.
   * Otherwise the response — its code or its timing — would tell an attacker
   * which phone numbers and emails have accounts.
   */
  async login(input: Login, context: SessionContext): Promise<SessionResult> {
    const user = await this.findByIdentifier(input.identifier);
    const hash = user?.passwordHash ?? (await this.dummyHash());
    const passwordMatches = await verifyPassword(hash, input.password);

    if (user === null || user.passwordHash === null || !passwordMatches) {
      throw DomainException.unauthorized(
        ERROR_CODES.INVALID_CREDENTIALS,
        "Login yoki parol noto'g'ri",
      );
    }

    // Only after the password is proven: telling an anonymous caller that an
    // account is suspended would be the same leak in a different shape.
    assertAccountUsable(user);

    return this.startSession(user, context);
  }

  // --- Session lifecycle ---------------------------------------------------

  async refresh(rawToken: string | undefined, context: SessionContext): Promise<SessionResult> {
    if (rawToken === undefined) {
      throw DomainException.unauthorized(
        ERROR_CODES.REFRESH_TOKEN_INVALID,
        "Refresh token topilmadi",
      );
    }

    const rotated = await this.tokens.rotate(rawToken, context);
    return { user: await this.users.getSessionUser(rotated.user.id), tokens: rotated.tokens };
  }

  /**
   * Missing cookie is not an error: the client asked to be signed out and it
   * is signed out. Cookies are cleared by the controller either way.
   */
  async logout(rawToken: string | undefined): Promise<void> {
    if (rawToken !== undefined) {
      await this.tokens.revokeSession(rawToken);
    }
  }

  me(userId: string): Promise<SessionUser> {
    return this.users.getSessionUser(userId);
  }

  // --- Email OTP -----------------------------------------------------------

  async requestEmailOtp(userId: string, input: RequestEmailOtpInput): Promise<OtpRequestResponse> {
    await this.assertEmailAvailable(input.email, userId);
    return this.otp.issue("email", input.email);
  }

  /**
   * The durable result of the email channel. Unlike the phone flow there is no
   * marker to carry across requests — the account already exists, so the
   * verification is written here and now.
   */
  async verifyEmailOtp(userId: string, input: VerifyEmailOtpInput): Promise<SessionUser> {
    await this.assertEmailAvailable(input.email, userId);
    await this.otp.verify("email", input.email, input.code);

    const updated = await this.runWritingUser(() =>
      this.prisma.user.update({
        where: { id: userId },
        data: { email: input.email, emailVerifiedAt: new Date() },
      }),
    );

    return this.users.toSessionUser(updated);
  }

  /**
   * Completes onboarding for accounts that were created through Google and
   * therefore have no phone yet. SMS verification is mandatory for everyone
   * (docs/PLAN.md 3.5-B), so this is the only way such an account becomes
   * usable: verify the code, then claim the marker here.
   */
  async attachPhone(userId: string, input: RequestPhoneOtpInput): Promise<SessionUser> {
    await this.assertPhoneAvailable(input.phone, userId);

    const verified = await this.otp.consumeVerification("phone", input.phone);
    if (!verified) {
      throw new DomainException(
        ERROR_CODES.OTP_NOT_VERIFIED,
        "Telefon raqam tasdiqlanmagan yoki tasdiq muddati o'tgan",
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.runWritingUser(() =>
      this.prisma.user.update({
        where: { id: userId },
        data: { phone: input.phone, phoneVerifiedAt: new Date(), kycLevel: "PHONE" },
      }),
    );

    return this.users.toSessionUser(updated);
  }

  // --- Google ---------------------------------------------------------------

  /**
   * Google sign-in is for clients only (docs/PLAN.md 3.5-B): workers and PMs
   * hold money-bearing accounts, so they go through the password + SMS path
   * where the platform controls every factor.
   */
  async loginWithGoogle(profile: GoogleProfile, context: SessionContext): Promise<SessionResult> {
    const linked = await this.prisma.user.findFirst({
      where: { googleId: profile.googleId, deletedAt: null },
    });

    if (linked !== null) {
      assertClientRole(linked);
      assertAccountUsable(linked);
      return this.startSession(linked, context);
    }

    const byEmail = await this.prisma.user.findFirst({
      where: { email: profile.email, deletedAt: null },
    });

    if (byEmail !== null) {
      assertClientRole(byEmail);
      assertAccountUsable(byEmail);

      // Google has verified the address, so linking also settles the email
      // channel — but an already-recorded verification date is left alone.
      const linkedNow = await this.runWritingUser(() =>
        this.prisma.user.update({
          where: { id: byEmail.id },
          data: {
            googleId: profile.googleId,
            emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
          },
        }),
      );

      return this.startSession(linkedNow, context);
    }

    // A brand-new Google account has no phone, so `onboardingComplete` stays
    // false until it goes through the SMS step.
    const created = await this.createUser({
      role: "CLIENT",
      email: profile.email,
      emailVerifiedAt: new Date(),
      googleId: profile.googleId,
      fullName: profile.fullName,
    });

    return this.startSession(created, context);
  }

  // --- Internals ------------------------------------------------------------

  private async startSession(user: User, context: SessionContext): Promise<SessionResult> {
    const tokens = await this.tokens.issueSession(user, context);
    return { user: this.users.toSessionUser(user), tokens };
  }

  private createUser(data: Prisma.UserUncheckedCreateInput): Promise<User> {
    return this.runWritingUser(() => this.prisma.user.create({ data }));
  }

  private findByIdentifier(identifier: string): Promise<User | null> {
    const value = identifier.trim();
    const where = PHONE_PATTERN.test(value) ? { phone: value } : { email: value.toLowerCase() };

    return this.prisma.user.findFirst({ where: { ...where, deletedAt: null } });
  }

  private async assertPhoneAvailable(phone: string, allowedUserId?: string): Promise<void> {
    const owner = await this.prisma.user.findFirst({
      where: { phone, deletedAt: null },
      select: { id: true },
    });

    if (owner !== null && owner.id !== allowedUserId) {
      throw DomainException.conflict(
        ERROR_CODES.PHONE_ALREADY_REGISTERED,
        "Bu telefon raqam allaqachon ro'yxatdan o'tgan",
      );
    }
  }

  private async assertEmailAvailable(email: string, allowedUserId?: string): Promise<void> {
    const owner = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true },
    });

    if (owner !== null && owner.id !== allowedUserId) {
      throw DomainException.conflict(
        ERROR_CODES.EMAIL_ALREADY_REGISTERED,
        "Bu email allaqachon ro'yxatdan o'tgan",
      );
    }
  }

  /**
   * The availability checks above are a courtesy, not a lock — two
   * simultaneous registrations both pass them. The unique index is what
   * actually decides, so its violation is translated into the same answer
   * rather than surfacing as a 500.
   */
  private async runWritingUser(write: () => Promise<User>): Promise<User> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = String(error.meta?.target ?? "");

        if (target.includes("phone")) {
          throw DomainException.conflict(
            ERROR_CODES.PHONE_ALREADY_REGISTERED,
            "Bu telefon raqam allaqachon ro'yxatdan o'tgan",
          );
        }

        if (target.includes("email")) {
          throw DomainException.conflict(
            ERROR_CODES.EMAIL_ALREADY_REGISTERED,
            "Bu email allaqachon ro'yxatdan o'tgan",
          );
        }

        throw DomainException.conflict(ERROR_CODES.CONFLICT, "Ma'lumot allaqachon mavjud");
      }

      throw error;
    }
  }

  /**
   * A hash of a value nobody knows, kept for the lifetime of the process.
   * Verifying against it costs the same as verifying a real password, which
   * is exactly the point.
   */
  private dummyHash(): Promise<string> {
    const pending = (this.dummyHashPromise ??= argon2.hash(randomToken(32), ARGON2_OPTIONS));
    return pending;
  }
}

function assertClientRole(user: User): void {
  if (user.role !== "CLIENT") {
    throw new DomainException(
      ERROR_CODES.OAUTH_ROLE_NOT_ALLOWED,
      "Google orqali kirish faqat mijozlar uchun",
      HttpStatus.FORBIDDEN,
    );
  }
}

/** A malformed stored hash must read as "wrong password", not as a crash. */
async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
