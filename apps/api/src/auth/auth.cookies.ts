import type { CookieOptions, Request, Response } from "express";
import { env } from "../config/env";
import {
  ACCESS_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_TTL_SECONDS,
} from "./auth.constants";

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * The single place the cookie flags are decided.
 *
 * `secure` is off only outside production, because http://localhost would
 * otherwise drop the cookie silently and every local login would look broken.
 * Deriving it from NODE_ENV here — instead of at each call site — is what
 * keeps "production always sets Secure" a property of the code rather than of
 * whoever wrote the last handler.
 */
function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    domain: env.COOKIE_DOMAIN,
  };
}

export function setAuthCookies(response: Response, tokens: IssuedTokens): void {
  response.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseCookieOptions(),
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });

  response.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseCookieOptions(),
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

/**
 * The flags (including `path`) must match the ones used when setting, or the
 * browser keeps the old cookie and "logout" leaves a live credential behind.
 */
export function clearAuthCookies(response: Response): void {
  response.clearCookie(ACCESS_COOKIE, { ...baseCookieOptions(), path: "/" });
  response.clearCookie(REFRESH_COOKIE, { ...baseCookieOptions(), path: REFRESH_COOKIE_PATH });
}

/**
 * cookie-parser types the bag loosely, so narrow it here rather than casting
 * at each call site — `any` is banned and a missing cookie is normal.
 */
export function readCookie(request: Request, name: string): string | undefined {
  const bag: unknown = (request as { cookies?: unknown }).cookies;
  if (typeof bag !== "object" || bag === null) {
    return undefined;
  }

  const value: unknown = (bag as Record<string, unknown>)[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
