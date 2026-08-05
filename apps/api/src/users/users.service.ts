import { HttpStatus, Injectable } from "@nestjs/common";
import type { Prisma, User } from "@prisma/client";
import {
  ERROR_CODES,
  isAllowedPortfolioUrl,
  type PublicUser,
  type SessionUser,
  type UpdateProfile,
} from "@kidir/shared";
import { DomainException } from "../common/exceptions/domain.exception";
import { PrismaService } from "../prisma/prisma.service";
import { toPublicUser, toSessionUser } from "./user.serializer";

/**
 * Profile reads and the onboarding writes. Onboarding is saved one step at a
 * time, so every field of `zUpdateProfile` is optional and only the keys the
 * client actually sent are written — a half-filled form must never blank out
 * what a previous step stored.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getSessionUser(userId: string): Promise<SessionUser> {
    return toSessionUser(await this.requireUser(userId));
  }

  /**
   * For callers that already hold the row — registration and login would
   * otherwise re-read the user they just wrote. Serialisation lives here so
   * `GET /auth/me` and the auth responses can never drift apart.
   */
  toSessionUser(user: User): SessionUser {
    return toSessionUser(user);
  }

  async getPublicProfile(userId: string): Promise<PublicUser> {
    return toPublicUser(await this.requireUser(userId));
  }

  async updateProfile(userId: string, input: UpdateProfile): Promise<SessionUser> {
    const data: Prisma.UserUpdateInput = {};

    if (input.fullName !== undefined) {
      data.fullName = input.fullName;
    }

    if (input.bio !== undefined) {
      data.bio = input.bio;
    }

    if (input.specialization !== undefined) {
      data.specialization = input.specialization;
    }

    if (input.skills !== undefined) {
      data.skills = input.skills;
    }

    if (input.portfolioLinks !== undefined) {
      // The schema already rejects anything off the allowlist; re-checking here
      // buys the client a specific error code instead of a generic validation
      // failure, and keeps the rule true for any future non-HTTP caller.
      for (const link of input.portfolioLinks) {
        if (!isAllowedPortfolioUrl(link)) {
          throw new DomainException(
            ERROR_CODES.PORTFOLIO_LINK_NOT_ALLOWED,
            `Bu havolaga ruxsat yo'q: ${link}`,
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      data.portfolioLinks = { set: input.portfolioLinks };
    }

    await this.requireUser(userId);
    const updated = await this.prisma.user.update({ where: { id: userId }, data });

    return toSessionUser(updated);
  }

  /** Soft-deleted accounts are indistinguishable from missing ones. */
  private async requireUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });

    if (user === null) {
      throw DomainException.notFound("Foydalanuvchi topilmadi");
    }

    return user;
  }
}
