import { ERROR_CODES, type ErrorCode } from "@kidir/shared";

/**
 * Codes the client raises on its own. The server never sends these — they
 * cover the cases where there is no usable response at all.
 */
export const CLIENT_ERROR_CODES = {
  NETWORK_ERROR: "NETWORK_ERROR",
  MALFORMED_RESPONSE: "MALFORMED_RESPONSE",
} as const;

export type ClientErrorCode = (typeof CLIENT_ERROR_CODES)[keyof typeof CLIENT_ERROR_CODES];

export type AnyErrorCode = ErrorCode | ClientErrorCode;

/**
 * Every failed request surfaces as this. The API always answers with
 * `{ error: { code, message } }`, so `code` is the thing UI branches on;
 * `message` is only a fallback for codes the client does not translate.
 */
export class ApiError extends Error {
  /** HTTP status, or 0 when the request never reached the server. */
  readonly status: number;
  /** Kept as `string`: a newer server may send a code this build predates. */
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  /** Type-safe comparison against `ERROR_CODES` / `CLIENT_ERROR_CODES`. */
  is(code: AnyErrorCode): boolean {
    return this.code === code;
  }

  isOneOf(codes: readonly AnyErrorCode[]): boolean {
    return codes.some((code) => this.code === code);
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

function readErrorEnvelope(body: unknown): { code: string; message: string } | null {
  if (typeof body !== "object" || body === null || !("error" in body)) {
    return null;
  }

  const { error } = body as { error: unknown };
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const { code, message } = error as { code?: unknown; message?: unknown };
  if (typeof code !== "string") {
    return null;
  }

  return { code, message: typeof message === "string" ? message : "" };
}

/**
 * Turns a non-2xx response body into an `ApiError`. A body that does not match
 * the envelope (proxy error page, gateway timeout) still produces a usable
 * error rather than a crash.
 */
export function toApiError(status: number, body: unknown): ApiError {
  const envelope = readErrorEnvelope(body);
  if (envelope) {
    return new ApiError(status, envelope.code, envelope.message);
  }

  const code = status === 401 ? ERROR_CODES.UNAUTHORIZED : ERROR_CODES.INTERNAL_ERROR;
  return new ApiError(status, code, "Serverda kutilmagan xatolik yuz berdi.");
}
