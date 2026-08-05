import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";
import { z } from "zod";
import { ERROR_CODES } from "@kidir/shared";
import { DomainException } from "../common/exceptions/domain.exception";
import { REDIS_CLIENT, redisKey } from "../redis/redis.constants";
import { env } from "../config/env";
import { OAUTH_STATE_TTL_SECONDS } from "./auth.constants";
import { randomToken } from "./auth.crypto";
import { AuthService, type SessionResult } from "./auth.service";
import type { SessionContext } from "./token.service";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

/**
 * Google's responses are not API input, so they are not covered by the shared
 * contracts — but they are still untrusted bytes, and `any` is banned. Narrow
 * them here instead of asserting a shape.
 */
const zTokenResponse = z.object({ access_token: z.string().min(1) });

const zUserInfo = z.object({
  sub: z.string().min(1),
  email: z.email(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
});

interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

/**
 * The OAuth2 authorization-code flow, written out rather than delegated to a
 * passport strategy, because the one part that matters here — `state` — has to
 * be stored server-side with a TTL and consumed exactly once, and has to fail
 * with this project's error codes.
 */
@Injectable()
export class GoogleAuthService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly auth: AuthService,
  ) {}

  /**
   * Mints a single-use `state` and returns where to send the browser.
   *
   * `state` is the CSRF defence for the callback: without it an attacker can
   * feed the victim's browser their own authorization code and silently link
   * the victim's session to the attacker's Google account.
   */
  async buildAuthorizationUrl(): Promise<string> {
    const config = this.requireConfig();
    const state = randomToken(32);

    await this.redis.set(stateKey(state), "1", "EX", OAUTH_STATE_TTL_SECONDS);

    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", config.callbackUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");

    return url.toString();
  }

  async handleCallback(
    code: string,
    state: string,
    context: SessionContext,
  ): Promise<SessionResult> {
    const config = this.requireConfig();
    await this.consumeState(state);

    const accessToken = await this.exchangeCode(config, code);
    const profile = await this.fetchProfile(accessToken);

    // Google's own address must be verified, or "sign in with Google" would
    // accept an address its owner never confirmed.
    if (profile.email_verified === false) {
      throw new DomainException(
        ERROR_CODES.OAUTH_EMAIL_MISMATCH,
        "Google hisobidagi email tasdiqlanmagan",
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.auth.loginWithGoogle(
      {
        googleId: profile.sub,
        email: profile.email.toLowerCase(),
        fullName: profile.name ?? profile.email,
      },
      context,
    );
  }

  /** GETDEL is what makes the state single-use: a replay finds nothing. */
  private async consumeState(state: string): Promise<void> {
    const stored = await this.redis.getdel(stateKey(state));

    if (stored === null) {
      throw new DomainException(
        ERROR_CODES.OAUTH_STATE_INVALID,
        "Google javobi tasdiqlanmadi, qaytadan urinib ko'ring",
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async exchangeCode(config: GoogleConfig, code: string): Promise<string> {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.callbackUrl,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      throw googleFailed();
    }

    const parsed = zTokenResponse.safeParse(await response.json());
    if (!parsed.success) {
      throw googleFailed();
    }

    return parsed.data.access_token;
  }

  private async fetchProfile(accessToken: string): Promise<z.infer<typeof zUserInfo>> {
    const response = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw googleFailed();
    }

    const parsed = zUserInfo.safeParse(await response.json());
    if (!parsed.success) {
      throw googleFailed();
    }

    return parsed.data;
  }

  /**
   * The Google credentials are optional in env (the mock-provider setup runs
   * without them), so the absence is reported as "not available" instead of
   * crashing mid-flow with an undefined client id.
   */
  private requireConfig(): GoogleConfig {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL } = env;

    if (
      GOOGLE_CLIENT_ID === undefined ||
      GOOGLE_CLIENT_SECRET === undefined ||
      GOOGLE_CALLBACK_URL === undefined
    ) {
      throw new DomainException(
        ERROR_CODES.INTERNAL_ERROR,
        "Google orqali kirish sozlanmagan",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackUrl: GOOGLE_CALLBACK_URL,
    };
  }
}

function stateKey(state: string): string {
  return redisKey("oauth", "state", state);
}

function googleFailed(): DomainException {
  return new DomainException(
    ERROR_CODES.OAUTH_STATE_INVALID,
    "Google bilan bog'lanishda xatolik",
    HttpStatus.BAD_GATEWAY,
  );
}
