import * as argon2 from "argon2";
import type { HashOptions } from "argon2";

/**
 * Cookie names. Tokens live only here — never in the response body, never in
 * localStorage (docs/PLAN.md 7.3).
 */
export const ACCESS_COOKIE = "kidir_at";
export const REFRESH_COOKIE = "kidir_rt";

/**
 * The refresh cookie is scoped as tightly as it can be while still reaching
 * every route that needs it: `/auth/refresh` rotates it and `/auth/logout`
 * revokes it, so `/auth` is the narrowest common prefix. A wider path would
 * ship a 30-day credential with every request in the app.
 */
export const REFRESH_COOKIE_PATH = "/auth";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Long enough to finish a Google consent screen, short enough to be useless later. */
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;

/**
 * Mirrors the seeded value of `CONFIG_KEYS.AUTH_RATE_LIMIT_PER_MIN`.
 *
 * It has to be a compile-time constant because `@Throttle` is evaluated when
 * the class is decorated, long before a database is reachable. Reading the
 * live config value means replacing the global `ThrottlerGuard` registered in
 * app.module.ts, which this terminal does not own — see the handover note.
 */
export const AUTH_RATE_LIMIT_PER_MIN = 5;

export const AUTH_RATE_LIMIT_TTL_MS = 60_000;

/**
 * argon2id with the OWASP second-recommended parameters (19 MiB, t=2, p=1).
 * The algorithm is fixed here so no call site can quietly pick a weaker one.
 */
export const ARGON2_OPTIONS: HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};
