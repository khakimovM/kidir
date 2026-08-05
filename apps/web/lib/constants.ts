import type { SelfServiceRole, Specialization } from "@kidir/shared";

/**
 * Only used for the "N urinish qoldi" hint. The server owns the real limit
 * (`Config` key `otp.maxAttempts`) and rejects the request regardless of what
 * the browser thinks.
 */
export const OTP_MAX_ATTEMPTS = 3;

/** Fallback resend cooldown when the server did not say when to retry. */
export const OTP_RESEND_FALLBACK_SECONDS = 60;

export const ROLE_LABELS: Record<SelfServiceRole, string> = {
  CLIENT: "Buyurtmachi",
  WORKER: "Ijrochi",
};

export const ROLE_DESCRIPTIONS: Record<SelfServiceRole, string> = {
  CLIENT: "Loyiha e'lon qilaman va jamoa yollayman.",
  WORKER: "Jamoada ishlayman yoki o'z jamoamni tuzaman.",
};

export const SPECIALIZATION_LABELS: Record<Specialization, string> = {
  BACKEND: "Backend",
  FRONTEND: "Frontend",
  FULLSTACK: "Fullstack",
  MOBILE: "Mobil ilovalar",
  DESIGN: "Dizayn",
  DEVOPS: "DevOps",
  QA: "Test (QA)",
  OTHER: "Boshqa",
};

export const SPECIALIZATION_DESCRIPTIONS: Record<Specialization, string> = {
  BACKEND: "Server, API, ma'lumotlar bazasi",
  FRONTEND: "Veb interfeys, brauzer ilovalari",
  FULLSTACK: "Ham server, ham interfeys",
  MOBILE: "iOS, Android, cross-platform",
  DESIGN: "UI/UX, grafika, prototip",
  DEVOPS: "Infratuzilma, CI/CD, monitoring",
  QA: "Qo'lda va avtomatlashtirilgan test",
  OTHER: "Yuqoridagilarga kirmaydi",
};
