import { ApiError, CLIENT_ERROR_CODES, toApiError } from "./errors";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(
  /\/+$/,
  "",
);

/** Where the browser lands once the session is definitively gone. */
export const LOGIN_PATH = "/kirish";

/**
 * CSRF defence. The server rejects any mutation without this header
 * (`CSRF_HEADER_MISSING`), and a cross-site form post cannot set it.
 */
const CSRF_HEADER = "X-Requested-With";
const CSRF_HEADER_VALUE = "XMLHttpRequest";

const REFRESH_PATH = "/auth/refresh";

const MUTATING_METHODS: ReadonlySet<string> = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Endpoints where a 401 is a normal answer for a signed-out visitor (wrong
 * password, expired OTP session). Refreshing or bouncing to the login page
 * there would hide the real error.
 */
const UNAUTHENTICATED_PATHS: readonly string[] = [
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/otp/phone/request",
  "/auth/otp/phone/verify",
];

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  method?: HttpMethod;
  /** Serialised as JSON. Tokens are never part of this — they live in cookies. */
  body?: unknown;
  signal?: AbortSignal;
  /** Defaults to `false` for the unauthenticated endpoints listed above. */
  allowRefresh?: boolean;
  /** Send the browser to `/kirish` when the session cannot be restored. */
  redirectOnSessionLoss?: boolean;
}

async function rawRequest(path: string, options: RequestOptions): Promise<Response> {
  const method = options.method ?? "GET";
  const headers = new Headers({ Accept: "application/json" });

  if (MUTATING_METHODS.has(method)) {
    headers.set(CSRF_HEADER, CSRF_HEADER_VALUE);
  }

  let body: string | undefined;
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body,
      // Access and refresh tokens are httpOnly cookies: the browser attaches
      // them, JavaScript never reads or stores them.
      credentials: "include",
      cache: "no-store",
      signal: options.signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw cause;
    }
    throw new ApiError(
      0,
      CLIENT_ERROR_CODES.NETWORK_ERROR,
      "Serverga ulanib bo'lmadi. Internet aloqasini tekshiring.",
    );
  }
}

/**
 * Shared across concurrent 401s so a page firing three requests at once
 * refreshes once instead of three times.
 */
let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshInFlight ??= rawRequest(REFRESH_PATH, { method: "POST" })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

let redirectingToLogin = false;

function redirectToLogin(): void {
  if (typeof window === "undefined" || redirectingToLogin) {
    return;
  }
  if (window.location.pathname.startsWith(LOGIN_PATH)) {
    return;
  }

  redirectingToLogin = true;
  window.location.assign(`${LOGIN_PATH}?sabab=sessiya`);
}

async function readBody<T>(response: Response): Promise<T> {
  const text = await response.text();

  let payload: unknown;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      if (!response.ok) {
        throw toApiError(response.status, undefined);
      }
      throw new ApiError(
        response.status,
        CLIENT_ERROR_CODES.MALFORMED_RESPONSE,
        "Serverdan tushunarsiz javob keldi.",
      );
    }
  }

  if (!response.ok) {
    throw toApiError(response.status, payload);
  }

  // 204 and empty bodies land here as `undefined`, which callers type as void.
  return payload as T;
}

/**
 * One 401 buys exactly one refresh attempt and one replay of the original
 * request. If that replay is still 401 the session is gone — no further
 * retries, so there is no loop.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const allowRefresh = options.allowRefresh ?? !UNAUTHENTICATED_PATHS.includes(path);

  let response = await rawRequest(path, options);

  if (response.status === 401 && allowRefresh) {
    const refreshed = await refreshSession();

    if (refreshed) {
      response = await rawRequest(path, options);
    }

    if (response.status === 401 && (options.redirectOnSessionLoss ?? true)) {
      redirectToLogin();
    }
  }

  return readBody<T>(response);
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">): Promise<T> =>
    request<T>(path, { ...options, method: "GET" }),

  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method">): Promise<T> =>
    request<T>(path, { ...options, method: "POST", body }),

  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method">): Promise<T> =>
    request<T>(path, { ...options, method: "PATCH", body }),

  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method">): Promise<T> =>
    request<T>(path, { ...options, method: "PUT", body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">): Promise<T> =>
    request<T>(path, { ...options, method: "DELETE" }),
} as const;
