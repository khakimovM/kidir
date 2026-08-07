import { Redis } from "ioredis";
import { ERROR_CODES, type ErrorCode } from "@kidir/shared";
import { DomainException } from "../common/exceptions/domain.exception";
import { env } from "../config/env";
import { redisKey } from "../redis/redis.constants";
import type { AuthService, GoogleProfile, SessionResult } from "./auth.service";
import { GoogleAuthService } from "./google-auth.service";
import type { SessionContext } from "./token.service";

/**
 * The OAuth mechanics are what this file is about — the single-use `state`,
 * the two network hops and how a bad answer from Google is reported. What
 * happens to the identity afterwards is `loginWithGoogle`, covered in
 * auth.service.spec.ts, so it is stubbed here.
 *
 * Redis is real (.claude/rules/testing.md): GETDEL is precisely the mechanism
 * that makes the state single-use, and a fake would only prove the fake.
 */
class RecordingAuthService {
  readonly calls: { profile: GoogleProfile; context: SessionContext }[] = [];

  loginWithGoogle(profile: GoogleProfile, context: SessionContext): Promise<SessionResult> {
    this.calls.push({ profile, context });

    return Promise.resolve({
      user: { id: "0193b7f0-0000-7000-8000-000000000001" },
      tokens: { accessToken: "access", refreshToken: "refresh" },
    } as unknown as SessionResult);
  }
}

interface FetchOutcome {
  ok: boolean;
  body: unknown;
}

const CONTEXT: SessionContext = { ip: "127.0.0.1", userAgent: "jest" };

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

describe("GoogleAuthService", () => {
  let redis: Redis;
  let auth: RecordingAuthService;
  let service: GoogleAuthService;
  let fetchSpy: jest.SpyInstance;

  const originalConfig = {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackUrl: env.GOOGLE_CALLBACK_URL,
  };

  /** What each URL answers on the next call. */
  let outcomes: { token: FetchOutcome; userinfo: FetchOutcome };

  beforeAll(() => {
    redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(() => {
    // The credentials are optional in env (the mock-provider setup runs without
    // them), so the suite supplies its own rather than depending on the machine.
    env.GOOGLE_CLIENT_ID = "kidir-client-id";
    env.GOOGLE_CLIENT_SECRET = "kidir-client-secret";
    env.GOOGLE_CALLBACK_URL = "http://localhost:4000/auth/google/callback";

    auth = new RecordingAuthService();
    service = new GoogleAuthService(redis, auth as unknown as AuthService);

    outcomes = {
      token: { ok: true, body: { access_token: "google-access-token" } },
      userinfo: {
        ok: true,
        body: {
          sub: "google-sub-1",
          email: "Mijoz@Example.com",
          email_verified: true,
          name: "Mijoz",
        },
      },
    };

    fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockImplementation((input: Parameters<typeof fetch>[0]) => {
        const url = String(input);
        const outcome = url.startsWith(TOKEN_URL) ? outcomes.token : outcomes.userinfo;

        return Promise.resolve({
          ok: outcome.ok,
          json: () => Promise.resolve(outcome.body),
        } as unknown as Response);
      });
  });

  afterEach(() => {
    fetchSpy.mockRestore();

    env.GOOGLE_CLIENT_ID = originalConfig.clientId;
    env.GOOGLE_CLIENT_SECRET = originalConfig.clientSecret;
    env.GOOGLE_CALLBACK_URL = originalConfig.callbackUrl;
  });

  // --- helpers -------------------------------------------------------------

  async function expectDomainError(
    run: () => Promise<unknown>,
    code: ErrorCode,
    status?: number,
  ): Promise<DomainException> {
    try {
      await run();
    } catch (error) {
      if (!(error instanceof DomainException)) {
        throw error;
      }

      expect(error.code).toBe(code);
      if (status !== undefined) {
        expect(error.getStatus()).toBe(status);
      }
      return error;
    }

    throw new Error(`${code} kutilgan edi, lekin xato tashlanmadi`);
  }

  /** Mints a real state through the service, the way the browser flow does. */
  async function issuedState(): Promise<string> {
    const url = new URL(await service.buildAuthorizationUrl());
    const state = url.searchParams.get("state");

    if (state === null) {
      throw new Error("authorization url'da state yo'q");
    }

    return state;
  }

  // --- authorization url ---------------------------------------------------

  describe("buildAuthorizationUrl", () => {
    it("sends the browser to Google with the configured client and callback", async () => {
      const url = new URL(await service.buildAuthorizationUrl());

      expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
      expect(url.searchParams.get("client_id")).toBe("kidir-client-id");
      expect(url.searchParams.get("redirect_uri")).toBe(
        "http://localhost:4000/auth/google/callback",
      );
      expect(url.searchParams.get("response_type")).toBe("code");
      expect(url.searchParams.get("scope")).toBe("openid email profile");
      expect(url.searchParams.get("prompt")).toBe("select_account");
    });

    /**
     * Without a server-side `state` an attacker can feed the victim's browser
     * their own authorization code and link the victim's session to their
     * Google account. Storing it with a TTL is what makes the callback provable.
     */
    it("stores the state in redis under a ttl", async () => {
      const state = await issuedState();

      await expect(redis.exists(redisKey("oauth", "state", state))).resolves.toBe(1);
      await expect(redis.ttl(redisKey("oauth", "state", state))).resolves.toBeGreaterThan(0);

      await redis.del(redisKey("oauth", "state", state));
    });

    it("mints a different state every time", async () => {
      const first = await issuedState();
      const second = await issuedState();

      expect(first).not.toBe(second);
      expect(first.length).toBeGreaterThanOrEqual(32);

      await redis.del(redisKey("oauth", "state", first), redisKey("oauth", "state", second));
    });

    it.each(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_CALLBACK_URL"] as const)(
      "reports the flow as unavailable when %s is not configured",
      async (key) => {
        env[key] = undefined;

        await expectDomainError(
          () => service.buildAuthorizationUrl(),
          ERROR_CODES.INTERNAL_ERROR,
          503,
        );
      },
    );
  });

  // --- callback ------------------------------------------------------------

  describe("handleCallback", () => {
    it("signs the caller in with the profile Google vouched for", async () => {
      const state = await issuedState();

      await service.handleCallback("auth-code", state, CONTEXT);

      expect(auth.calls).toHaveLength(1);
      expect(auth.calls[0]?.profile).toEqual({
        googleId: "google-sub-1",
        // Emails are stored lower-case, so the address is normalised before it
        // is handed on — otherwise linking by email would miss the account.
        email: "mijoz@example.com",
        fullName: "Mijoz",
      });
      expect(auth.calls[0]?.context).toEqual(CONTEXT);
    });

    it("falls back to the email when Google sends no name", async () => {
      outcomes.userinfo.body = { sub: "google-sub-2", email: "mijoz@example.com" };
      const state = await issuedState();

      await service.handleCallback("auth-code", state, CONTEXT);

      expect(auth.calls[0]?.profile.fullName).toBe("mijoz@example.com");
    });

    it("exchanges the code at the token endpoint before reading the profile", async () => {
      const state = await issuedState();

      await service.handleCallback("auth-code", state, CONTEXT);

      expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(TOKEN_URL);
      expect(String(fetchSpy.mock.calls[1]?.[0])).toBe(USERINFO_URL);

      const profileRequest = fetchSpy.mock.calls[1]?.[1] as { headers: Record<string, string> };
      expect(profileRequest.headers.Authorization).toBe("Bearer google-access-token");
    });

    describe("state validation", () => {
      it("refuses a state nobody issued", async () => {
        await expectDomainError(
          () => service.handleCallback("auth-code", "o'ylab-topilgan", CONTEXT),
          ERROR_CODES.OAUTH_STATE_INVALID,
          403,
        );

        expect(fetchSpy).not.toHaveBeenCalled();
      });

      /** GETDEL is what makes it single-use: the replay finds nothing. */
      it("refuses the second use of a state", async () => {
        const state = await issuedState();

        await service.handleCallback("auth-code", state, CONTEXT);

        await expectDomainError(
          () => service.handleCallback("auth-code", state, CONTEXT),
          ERROR_CODES.OAUTH_STATE_INVALID,
          403,
        );

        expect(auth.calls).toHaveLength(1);
      });

      it("checks the state before spending a request on Google", async () => {
        env.GOOGLE_CLIENT_ID = undefined;

        await expectDomainError(
          () => service.handleCallback("auth-code", "har-qanday", CONTEXT),
          ERROR_CODES.INTERNAL_ERROR,
          503,
        );
      });
    });

    describe("when Google answers badly", () => {
      it("reports a failed code exchange as a bad gateway", async () => {
        outcomes.token = { ok: false, body: { error: "invalid_grant" } };
        const state = await issuedState();

        await expectDomainError(
          () => service.handleCallback("auth-code", state, CONTEXT),
          ERROR_CODES.OAUTH_STATE_INVALID,
          502,
        );
      });

      it("reports a token response with no access_token as a bad gateway", async () => {
        outcomes.token = { ok: true, body: { scope: "openid" } };
        const state = await issuedState();

        await expectDomainError(
          () => service.handleCallback("auth-code", state, CONTEXT),
          ERROR_CODES.OAUTH_STATE_INVALID,
          502,
        );
      });

      it("reports a failed profile read as a bad gateway", async () => {
        outcomes.userinfo = { ok: false, body: {} };
        const state = await issuedState();

        await expectDomainError(
          () => service.handleCallback("auth-code", state, CONTEXT),
          ERROR_CODES.OAUTH_STATE_INVALID,
          502,
        );
      });

      it("reports a profile that does not match the expected shape", async () => {
        outcomes.userinfo = { ok: true, body: { sub: "google-sub-3", email: "email-emas" } };
        const state = await issuedState();

        await expectDomainError(
          () => service.handleCallback("auth-code", state, CONTEXT),
          ERROR_CODES.OAUTH_STATE_INVALID,
          502,
        );
      });

      it("never signs anyone in when a hop fails", async () => {
        outcomes.token = { ok: false, body: {} };
        const state = await issuedState();

        await expectDomainError(
          () => service.handleCallback("auth-code", state, CONTEXT),
          ERROR_CODES.OAUTH_STATE_INVALID,
        );

        expect(auth.calls).toHaveLength(0);
      });
    });

    describe("email verification", () => {
      /**
       * Google's own address must be confirmed, or "sign in with Google" would
       * accept an address its owner never proved they hold.
       */
      it("refuses a profile whose email Google has not verified", async () => {
        outcomes.userinfo.body = {
          sub: "google-sub-4",
          email: "mijoz@example.com",
          email_verified: false,
        };
        const state = await issuedState();

        await expectDomainError(
          () => service.handleCallback("auth-code", state, CONTEXT),
          ERROR_CODES.OAUTH_EMAIL_MISMATCH,
          400,
        );

        expect(auth.calls).toHaveLength(0);
      });

      /** The claim is optional; only an explicit `false` is a refusal. */
      it("accepts a profile that omits the claim", async () => {
        outcomes.userinfo.body = { sub: "google-sub-5", email: "mijoz@example.com" };
        const state = await issuedState();

        await service.handleCallback("auth-code", state, CONTEXT);

        expect(auth.calls).toHaveLength(1);
      });
    });
  });
});
