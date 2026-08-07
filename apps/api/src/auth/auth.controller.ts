import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import type { AuthResponse, OtpRequestResponse, SessionUser } from "@kidir/shared";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/authenticated-user";
import { env } from "../config/env";
import { AuthService, type SessionResult } from "./auth.service";
import { GoogleAuthService } from "./google-auth.service";
import {
  AUTH_RATE_LIMIT_PER_MIN,
  AUTH_RATE_LIMIT_TTL_MS,
  OAUTH_STATE_COOKIE,
  REFRESH_COOKIE,
} from "./auth.constants";
import {
  clearAuthCookies,
  clearOauthStateCookie,
  readCookie,
  setAuthCookies,
  setOauthStateCookie,
} from "./auth.cookies";
import type { SessionContext } from "./token.service";
import {
  GoogleCallbackQueryDto,
  LoginDto,
  RegisterDto,
  RequestEmailOtpDto,
  RequestPhoneOtpDto,
  VerifyEmailOtpDto,
  VerifyPhoneOtpDto,
} from "./dto/auth.dto";

/** Brute-force ceiling for the credential-bearing endpoints. */
const authThrottle = Throttle({
  default: { limit: AUTH_RATE_LIMIT_PER_MIN, ttl: AUTH_RATE_LIMIT_TTL_MS },
});

/**
 * Authentication is the application-wide default (`GuardsModule` registers the
 * guards as APP_GUARD), so every anonymous route here has to say `@Public()`
 * out loud. Tokens never appear in a response body — they are written straight
 * to httpOnly cookies here, and the body carries only the session user
 * (`zAuthResponse`).
 */
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleAuthService,
  ) {}

  // --- Phone OTP -----------------------------------------------------------

  @Public()
  @authThrottle
  @HttpCode(HttpStatus.OK)
  @Post("otp/phone/request")
  requestPhoneOtp(@Body() body: RequestPhoneOtpDto): Promise<OtpRequestResponse> {
    return this.auth.requestPhoneOtp(body);
  }

  @Public()
  @authThrottle
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("otp/phone/verify")
  verifyPhoneOtp(@Body() body: VerifyPhoneOtpDto): Promise<void> {
    return this.auth.verifyPhoneOtp(body);
  }

  // --- Registration and login ----------------------------------------------

  @Public()
  @authThrottle
  @Post("register")
  async register(
    @Body() body: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    return this.respondWithSession(
      response,
      await this.auth.register(body, sessionContext(request)),
    );
  }

  @Public()
  @authThrottle
  @HttpCode(HttpStatus.OK)
  @Post("login")
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    return this.respondWithSession(response, await this.auth.login(body, sessionContext(request)));
  }

  // --- Session lifecycle ---------------------------------------------------

  /**
   * Public because the access token is expected to be expired by the time this
   * is called — the refresh cookie is the credential.
   */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const session = await this.auth.refresh(
      readCookie(request, REFRESH_COOKIE),
      sessionContext(request),
    );

    return this.respondWithSession(response, session);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("logout")
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(readCookie(request, REFRESH_COOKIE));
    clearAuthCookies(response);
  }

  @Get("me")
  me(@CurrentUser() current: AuthenticatedUser): Promise<SessionUser> {
    return this.auth.me(current.id);
  }

  // --- Email OTP and phone attachment --------------------------------------

  @authThrottle
  @HttpCode(HttpStatus.OK)
  @Post("otp/email/request")
  requestEmailOtp(
    @CurrentUser() current: AuthenticatedUser,
    @Body() body: RequestEmailOtpDto,
  ): Promise<OtpRequestResponse> {
    return this.auth.requestEmailOtp(current.id, body);
  }

  @authThrottle
  @HttpCode(HttpStatus.OK)
  @Post("otp/email/verify")
  async verifyEmailOtp(
    @CurrentUser() current: AuthenticatedUser,
    @Body() body: VerifyEmailOtpDto,
  ): Promise<AuthResponse> {
    return { user: await this.auth.verifyEmailOtp(current.id, body) };
  }

  /**
   * The SMS step for accounts created through Google, which arrive without a
   * phone. Same two-request shape as registration: `otp/phone/verify` first,
   * then this claims the verification.
   */
  @authThrottle
  @HttpCode(HttpStatus.OK)
  @Post("phone/attach")
  async attachPhone(
    @CurrentUser() current: AuthenticatedUser,
    @Body() body: RequestPhoneOtpDto,
  ): Promise<AuthResponse> {
    return { user: await this.auth.attachPhone(current.id, body) };
  }

  // --- Google --------------------------------------------------------------

  /**
   * Browser navigations, so both routes end in a redirect rather than JSON,
   * and `@Res()` is used without passthrough because the response is written
   * here in full.
   */
  @Public()
  @Get("google")
  async googleStart(@Res() response: Response): Promise<void> {
    const { url, state } = await this.google.buildAuthorizationUrl();

    // The same value goes to Google and to this browser; the callback is only
    // honoured when the two come back together.
    setOauthStateCookie(response, state);
    response.redirect(url);
  }

  @Public()
  @Get("google/callback")
  async googleCallback(
    @Query() query: GoogleCallbackQueryDto,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const session = await this.google.handleCallback(
      query.code,
      query.state,
      readCookie(request, OAUTH_STATE_COOKIE),
      sessionContext(request),
    );

    // One flow, one state: cleared whether or not the exchange succeeded is
    // handled by the throw path leaving it to expire on its own TTL.
    clearOauthStateCookie(response);
    setAuthCookies(response, session.tokens);
    // The web app reads `GET /auth/me` on load and decides where to go from
    // `onboardingComplete`, so the API does not need to know its routes.
    response.redirect(env.WEB_URL);
  }

  private respondWithSession(response: Response, session: SessionResult): AuthResponse {
    setAuthCookies(response, session.tokens);
    return { user: session.user };
  }
}

/** Recorded on the refresh row: the trail a stolen session leaves behind. */
function sessionContext(request: Request): SessionContext {
  return { ip: request.ip, userAgent: request.get("user-agent") };
}
