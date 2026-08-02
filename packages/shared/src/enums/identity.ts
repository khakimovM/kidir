export const USER_ROLES = ["CLIENT", "WORKER", "PM", "MODERATOR", "SUPERADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const KYC_LEVELS = ["NONE", "PHONE", "FULL"] as const;
export type KycLevel = (typeof KYC_LEVELS)[number];

export const USER_STATUSES = ["ACTIVE", "SUSPENDED", "BANNED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const SPECIALIZATIONS = [
  "BACKEND",
  "FRONTEND",
  "FULLSTACK",
  "MOBILE",
  "DESIGN",
  "DEVOPS",
  "QA",
  "OTHER",
] as const;
export type Specialization = (typeof SPECIALIZATIONS)[number];
