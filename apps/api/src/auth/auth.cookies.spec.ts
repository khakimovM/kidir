import type { CookieOptions, Request, Response } from "express";
import { env } from "../config/env";
import {
  ACCESS_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_TTL_SECONDS,
} from "./auth.constants";
import { clearAuthCookies, readCookie, setAuthCookies } from "./auth.cookies";

interface RecordedCookie {
  name: string;
  value?: string;
  options: CookieOptions;
}

/**
 * Records what would have been written. Express itself is not under test — the
 * flags are, and they are the whole of the cookie design (docs/PLAN.md 7.3).
 */
function recordingResponse(): {
  response: Response;
  set: RecordedCookie[];
  cleared: RecordedCookie[];
} {
  const set: RecordedCookie[] = [];
  const cleared: RecordedCookie[] = [];

  const response = {
    cookie(name: string, value: string, options: CookieOptions) {
      set.push({ name, value, options });
      return this;
    },
    clearCookie(name: string, options: CookieOptions) {
      cleared.push({ name, options });
      return this;
    },
  } as unknown as Response;

  return { response, set, cleared };
}

function requestWith(cookies: unknown): Request {
  return { cookies } as unknown as Request;
}

describe("auth cookies", () => {
  const tokens = { accessToken: "access-token-value", refreshToken: "refresh-token-value" };

  describe("setAuthCookies", () => {
    it("writes both tokens as httpOnly SameSite=Lax cookies", () => {
      const { response, set } = recordingResponse();

      setAuthCookies(response, tokens);

      expect(set.map((cookie) => cookie.name)).toEqual([ACCESS_COOKIE, REFRESH_COOKIE]);

      for (const cookie of set) {
        expect(cookie.options.httpOnly).toBe(true);
        expect(cookie.options.sameSite).toBe("lax");
        expect(cookie.options.domain).toBe(env.COOKIE_DOMAIN);
      }
    });

    it("carries the token values and their lifetimes", () => {
      const { response, set } = recordingResponse();

      setAuthCookies(response, tokens);
      const [access, refresh] = set;

      expect(access?.value).toBe(tokens.accessToken);
      expect(access?.options.maxAge).toBe(ACCESS_TOKEN_TTL_SECONDS * 1000);
      expect(refresh?.value).toBe(tokens.refreshToken);
      expect(refresh?.options.maxAge).toBe(REFRESH_TOKEN_TTL_SECONDS * 1000);
    });

    /**
     * The refresh cookie is a 30-day credential; scoping it to /auth keeps it
     * off every other request in the app.
     */
    it("scopes the refresh cookie to /auth and the access cookie to the whole site", () => {
      const { response, set } = recordingResponse();

      setAuthCookies(response, tokens);
      const [access, refresh] = set;

      expect(access?.options.path).toBe("/");
      expect(refresh?.options.path).toBe(REFRESH_COOKIE_PATH);
    });
  });

  /**
   * `secure` is derived from NODE_ENV in one place so that "production always
   * sets Secure" is a property of the code. Locally it must stay off, or
   * http://localhost would drop the cookie and every dev login would look
   * broken.
   */
  describe("the Secure flag", () => {
    const original = env.NODE_ENV;

    afterEach(() => {
      env.NODE_ENV = original;
    });

    it("is set in production", () => {
      env.NODE_ENV = "production";
      const { response, set } = recordingResponse();

      setAuthCookies(response, tokens);

      expect(set.every((cookie) => cookie.options.secure === true)).toBe(true);
    });

    it.each(["development", "test"] as const)("is not set in %s", (mode) => {
      env.NODE_ENV = mode;
      const { response, set } = recordingResponse();

      setAuthCookies(response, tokens);

      expect(set.every((cookie) => cookie.options.secure === false)).toBe(true);
    });
  });

  /**
   * A browser matches a clear against the flags it was set with. Any drift
   * here means logout silently leaves a live credential in the browser.
   */
  describe("clearAuthCookies", () => {
    it("clears both cookies with the same flags they were set with", () => {
      const { response, set, cleared } = recordingResponse();

      setAuthCookies(response, tokens);
      clearAuthCookies(response);

      expect(cleared.map((cookie) => cookie.name)).toEqual([ACCESS_COOKIE, REFRESH_COOKIE]);

      for (const [index, cookie] of cleared.entries()) {
        const written = set[index];
        expect(cookie.options.path).toBe(written?.options.path);
        expect(cookie.options.domain).toBe(written?.options.domain);
        expect(cookie.options.sameSite).toBe(written?.options.sameSite);
        expect(cookie.options.httpOnly).toBe(true);
      }
    });
  });

  describe("readCookie", () => {
    it("returns the value when it is present", () => {
      expect(readCookie(requestWith({ [ACCESS_COOKIE]: "abc" }), ACCESS_COOKIE)).toBe("abc");
    });

    it("returns undefined for a cookie that is not there", () => {
      expect(readCookie(requestWith({}), ACCESS_COOKIE)).toBeUndefined();
    });

    it("treats an empty value as absent", () => {
      expect(readCookie(requestWith({ [ACCESS_COOKIE]: "" }), ACCESS_COOKIE)).toBeUndefined();
    });

    it("ignores a non-string value", () => {
      expect(readCookie(requestWith({ [ACCESS_COOKIE]: 42 }), ACCESS_COOKIE)).toBeUndefined();
    });

    /**
     * cookie-parser is installed in main.ts, so a request that never went
     * through it has no bag at all. That must read as "no cookie" rather than
     * throw inside a guard.
     */
    it.each([
      ["missing", undefined],
      ["null", null],
      ["not an object", "kidir_at=abc"],
    ])("survives a cookie bag that is %s", (_label, bag) => {
      expect(readCookie(requestWith(bag), ACCESS_COOKIE)).toBeUndefined();
    });
  });
});
