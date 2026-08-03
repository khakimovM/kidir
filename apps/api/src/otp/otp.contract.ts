export type OtpChannel = "phone" | "email";

export interface OtpIssueResult {
  /** Seconds the caller must wait before a resend is accepted. */
  retryAfterSeconds: number;
  /** Lifetime of the code just issued. */
  expiresInSeconds: number;
}

/**
 * Contract between the auth flow and the Redis-backed OTP implementation.
 * Declared as an abstract class so it doubles as the Nest injection token.
 *
 * Codes live only in Redis (`kidir:otp:<channel>:<target>`) with a TTL and an
 * attempt counter — there is no OTP table. The durable outcome is
 * `User.phoneVerifiedAt` / `emailVerifiedAt`, written by the auth flow.
 *
 * Implementations must throw `DomainException` with `OTP_INVALID`,
 * `OTP_EXPIRED`, `OTP_TOO_MANY_ATTEMPTS` or `OTP_ALREADY_SENT` — never a
 * boolean, so a caller cannot forget to check it.
 */
export abstract class OtpService {
  /**
   * Generates a code, sends it over the channel's provider and stores it.
   * Throws `OTP_ALREADY_SENT` while a previous code is still within its
   * resend window.
   */
  abstract issue(channel: OtpChannel, target: string): Promise<OtpIssueResult>;

  /**
   * Checks the code and, on success, records a short-lived verification
   * marker that `consumeVerification` can later claim. Consumes one attempt;
   * throws once the attempt budget is spent.
   */
  abstract verify(channel: OtpChannel, target: string, code: string): Promise<void>;

  /**
   * Atomically claims the marker left by `verify`, so a single verification
   * cannot be replayed into two registrations. Returns false when there is
   * nothing to claim (never verified, or the window lapsed).
   */
  abstract consumeVerification(channel: OtpChannel, target: string): Promise<boolean>;
}
