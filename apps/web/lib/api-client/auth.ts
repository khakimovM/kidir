import type {
  AuthResponse,
  Login,
  OtpRequestResponse,
  Register,
  SessionUser,
  zRequestEmailOtp,
  zRequestPhoneOtp,
  zVerifyEmailOtp,
  zVerifyPhoneOtp,
} from "@kidir/shared";
import type { SchemaOutput } from "../schema";
import { api, API_BASE_URL } from "./client";

export type RequestPhoneOtpInput = SchemaOutput<typeof zRequestPhoneOtp>;
export type VerifyPhoneOtpInput = SchemaOutput<typeof zVerifyPhoneOtp>;
export type RequestEmailOtpInput = SchemaOutput<typeof zRequestEmailOtp>;
export type VerifyEmailOtpInput = SchemaOutput<typeof zVerifyEmailOtp>;

// --- Phone OTP (registration, signed out) ----------------------------------

export function requestPhoneOtp(input: RequestPhoneOtpInput): Promise<OtpRequestResponse> {
  return api.post<OtpRequestResponse>("/auth/otp/phone/request", input);
}

export function verifyPhoneOtp(input: VerifyPhoneOtpInput): Promise<void> {
  return api.post<void>("/auth/otp/phone/verify", input);
}

// --- Registration and login -------------------------------------------------

/** The phone must already be verified; the server checks its own marker. */
export function register(input: Register): Promise<AuthResponse> {
  return api.post<AuthResponse>("/auth/register", input);
}

export function login(input: Login): Promise<AuthResponse> {
  return api.post<AuthResponse>("/auth/login", input);
}

export function logout(): Promise<void> {
  return api.post<void>("/auth/logout");
}

/**
 * Current session. `redirectOnSessionLoss` is left to the caller: a page that
 * merely wants to know "am I signed in?" should not bounce the visitor.
 */
export function getSession(options?: { redirectOnSessionLoss?: boolean }): Promise<SessionUser> {
  return api.get<SessionUser>("/auth/me", {
    redirectOnSessionLoss: options?.redirectOnSessionLoss ?? false,
  });
}

// --- Email OTP (signed in, onboarding) -------------------------------------

export function requestEmailOtp(input: RequestEmailOtpInput): Promise<OtpRequestResponse> {
  return api.post<OtpRequestResponse>("/auth/otp/email/request", input);
}

export function verifyEmailOtp(input: VerifyEmailOtpInput): Promise<void> {
  return api.post<void>("/auth/otp/email/verify", input);
}

// --- Google OAuth -----------------------------------------------------------

/**
 * A full page navigation, not a fetch: the server generates the `state` and
 * redirects to Google. Only CLIENT accounts may sign in this way.
 */
export const GOOGLE_SIGN_IN_URL = `${API_BASE_URL}/auth/google`;
