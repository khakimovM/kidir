import type { User } from "@prisma/client";
import {
  zSkills,
  type PublicUser,
  type SessionUser,
  type SkillAssessment,
  type UserRole,
} from "@kidir/shared";

/** Roles that deliver work, and therefore have a craft to declare. */
const CRAFT_ROLES: readonly UserRole[] = ["WORKER", "PM"];

/**
 * `skills` is a Json column, so what comes back is whatever was written —
 * possibly by an older shape of the schema. Parse it instead of trusting it;
 * an unreadable value degrades to "no skills" rather than breaking a profile.
 */
export function parseSkills(value: User["skills"]): SkillAssessment[] {
  const parsed = zSkills.safeParse(value);
  return parsed.success ? parsed.data : [];
}

/**
 * Onboarding is complete when the account can actually be used: both channels
 * verified, a real name, and — for the roles that get hired — a declared
 * specialization with at least one skill.
 */
export function isOnboardingComplete(user: User): boolean {
  if (user.phoneVerifiedAt === null || user.emailVerifiedAt === null) {
    return false;
  }

  if (user.fullName.trim().length < 2) {
    return false;
  }

  if (CRAFT_ROLES.includes(user.role)) {
    return user.specialization !== null && parseSkills(user.skills).length > 0;
  }

  return true;
}

/**
 * What anyone else may see. Phone, email, `passwordHash` and `googleId` are
 * absent by construction: the object is built field by field, so a column
 * added to the model later cannot leak by simply being spread in.
 */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    role: user.role,
    fullName: user.fullName,
    bio: user.bio,
    specialization: user.specialization,
    skills: parseSkills(user.skills),
    portfolioLinks: user.portfolioLinks,
    kycLevel: user.kycLevel,
    createdAt: user.createdAt.toISOString(),
  };
}

/** What the signed-in user sees about themselves. */
export function toSessionUser(user: User): SessionUser {
  return {
    ...toPublicUser(user),
    status: user.status,
    phone: user.phone,
    phoneVerified: user.phoneVerifiedAt !== null,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    onboardingComplete: isOnboardingComplete(user),
  };
}
