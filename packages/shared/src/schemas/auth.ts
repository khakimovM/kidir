import { z } from "zod";
import { zPhone } from "./common";
import { zFullName, zSessionUser } from "./user";

/**
 * Only these two roles can self-register. PM is granted by team assignment;
 * MODERATOR and SUPERADMIN are created from the admin panel.
 */
export const zSelfServiceRole = z.enum(["CLIENT", "WORKER"]);

export const zEmail = z.email().max(254).toLowerCase();

/** Six digits, kept as a string so leading zeros survive. */
export const zOtpCode = z.string().regex(/^\d{6}$/, "Kod 6 raqamdan iborat bo'lishi kerak");

/**
 * Registration only. Login deliberately does not reuse this: an existing
 * account must not be rejected because the policy tightened later.
 */
export const zNewPassword = z
  .string()
  .min(10, "Parol kamida 10 belgi bo'lishi kerak")
  .max(128)
  .refine((value) => /[a-z]/i.test(value), "Parolda kamida bitta harf bo'lishi kerak")
  .refine((value) => /\d/.test(value), "Parolda kamida bitta raqam bo'lishi kerak");

// --- OTP -------------------------------------------------------------------

export const zRequestPhoneOtp = z.object({ phone: zPhone });

export const zVerifyPhoneOtp = z.object({ phone: zPhone, code: zOtpCode });

export const zRequestEmailOtp = z.object({ email: zEmail });

export const zVerifyEmailOtp = z.object({ email: zEmail, code: zOtpCode });

// --- Registration and login ------------------------------------------------

/**
 * SMS verification is mandatory for everyone, so the phone must already be
 * verified when this is called — the server checks its own short-lived
 * verification marker rather than trusting the client.
 */
export const zRegister = z.object({
  phone: zPhone,
  email: zEmail,
  password: zNewPassword,
  fullName: zFullName,
  role: zSelfServiceRole,
});

export const zLogin = z.object({
  /** Phone or email — the server decides which by shape. */
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
});

// --- Google OAuth ----------------------------------------------------------

/** `state` is mandatory: it is the CSRF defence for the callback. */
export const zGoogleCallbackQuery = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

// --- Responses -------------------------------------------------------------

/**
 * No tokens in the body — access and refresh live only in httpOnly cookies.
 * The client learns nothing beyond who it is signed in as.
 */
export const zAuthResponse = z.object({ user: zSessionUser });

export const zOtpRequestResponse = z.object({
  /** Seconds until a resend is allowed. */
  retryAfterSeconds: z.number().int().nonnegative(),
  expiresInSeconds: z.number().int().positive(),
});

export type SelfServiceRole = z.infer<typeof zSelfServiceRole>;
export type Register = z.infer<typeof zRegister>;
export type Login = z.infer<typeof zLogin>;
export type AuthResponse = z.infer<typeof zAuthResponse>;
export type OtpRequestResponse = z.infer<typeof zOtpRequestResponse>;
