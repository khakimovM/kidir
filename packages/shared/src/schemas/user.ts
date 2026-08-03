import { z } from "zod";
import { KYC_LEVELS, SPECIALIZATIONS, USER_ROLES, USER_STATUSES } from "../enums/identity";
import { PORTFOLIO_ALLOWLIST_DOMAINS } from "../constants/portfolio-allowlist";
import { zPhone, zUuid } from "./common";

export const zFullName = z.string().trim().min(2).max(100);

export const zBio = z.string().trim().max(1000);

export const zSpecialization = z.enum(SPECIALIZATIONS);

export const zUserRole = z.enum(USER_ROLES);

export const zUserStatus = z.enum(USER_STATUSES);

export const zKycLevel = z.enum(KYC_LEVELS);

/**
 * Workers rate their own stacks 0-100. The UI must label this as a
 * self-assessment — the platform never verifies it in v1 (skill tests are v2).
 */
export const zSkillAssessment = z.object({
  name: z.string().trim().min(1).max(50),
  level: z.number().int().min(0).max(100),
});

export const zSkills = z.array(zSkillAssessment).max(20);

/**
 * Portfolio and CV links are restricted to an allowlist and never rendered as
 * previews — an arbitrary URL here would be an SSRF vector. Subdomains are
 * allowed because several allowlisted hosts are used that way
 * (e.g. `workspace.notion.site`).
 */
export function isAllowedPortfolioUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") {
    return false;
  }

  const host = url.hostname.toLowerCase();
  return PORTFOLIO_ALLOWLIST_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

export const zPortfolioLink = z
  .string()
  .max(500)
  .refine(isAllowedPortfolioUrl, "Link https bo'lishi va ruxsat etilgan saytdan bo'lishi kerak");

export const zPortfolioLinks = z.array(zPortfolioLink).max(10);

/** Every field is optional: onboarding saves one step at a time. */
export const zUpdateProfile = z.object({
  fullName: zFullName.optional(),
  bio: zBio.optional(),
  specialization: zSpecialization.optional(),
  skills: zSkills.optional(),
  portfolioLinks: zPortfolioLinks.optional(),
});

/** What another user may see. Phone and email are never exposed here. */
export const zPublicUser = z.object({
  id: zUuid,
  role: zUserRole,
  fullName: zFullName,
  bio: zBio.nullable(),
  specialization: zSpecialization.nullable(),
  skills: zSkills,
  portfolioLinks: zPortfolioLinks,
  kycLevel: zKycLevel,
  createdAt: z.iso.datetime(),
});

/** What the signed-in user sees about themselves (`GET /auth/me`). */
export const zSessionUser = zPublicUser.extend({
  status: zUserStatus,
  phone: zPhone.nullable(),
  phoneVerified: z.boolean(),
  email: z.email().nullable(),
  emailVerified: z.boolean(),
  onboardingComplete: z.boolean(),
});

export type SkillAssessment = z.infer<typeof zSkillAssessment>;
export type UpdateProfile = z.infer<typeof zUpdateProfile>;
export type PublicUser = z.infer<typeof zPublicUser>;
export type SessionUser = z.infer<typeof zSessionUser>;
