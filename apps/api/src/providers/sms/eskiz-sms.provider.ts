import { Injectable, Logger } from "@nestjs/common";
import { z } from "zod";
import { env } from "../../config/env";
import { requiredEnv } from "../required-env";
import type { SmsProvider } from "./sms-provider.interface";

const ESKIZ_BASE_URL = "https://notify.eskiz.uz/api";

/**
 * Eskiz's shared test sender. Every account may use it; a branded alphanumeric
 * sender has to be approved by the operator first. Once the contract is signed
 * this should move to an `ESKIZ_FROM` env var (owner: orchestrator).
 */
const ESKIZ_DEFAULT_SENDER = "4546";

const REQUEST_TIMEOUT_MS = 10_000;

const loginResponseSchema = z.object({ data: z.object({ token: z.string().min(1) }) });

/**
 * Eskiz.uz (notify.eskiz.uz) SMS gateway.
 *
 * ⚠️ UNVERIFIED AGAINST THE LIVE API. There is no Eskiz account yet (see
 * docs/PLAN.md, phase-1 parallel action items), so this was written from the
 * published REST contract and has never been executed against the real
 * service. Before the first production send, re-check: the login payload
 * encoding, the exact `mobile_phone` format and the sender id.
 *
 * Auth model: `POST /auth/login` returns a bearer token valid ~30 days.
 * `PATCH /auth/refresh` extends it. The token is kept in memory only — a
 * restart simply logs in again — and a 401 mid-flight triggers one
 * re-authentication and one retry, so an expired token never surfaces as a
 * failed OTP.
 */
@Injectable()
export class EskizSmsProvider implements SmsProvider {
  private readonly logger = new Logger(EskizSmsProvider.name);
  private token: string | undefined;
  /** Dedupes concurrent logins: parallel sends share one auth round-trip. */
  private authInFlight: Promise<string> | undefined;

  async send(to: string, text: string): Promise<void> {
    const token = await this.authenticate();
    const sent = await this.postMessage(to, text, token);
    if (sent) {
      return;
    }

    // The token was rejected: re-authenticate from scratch (refresh can fail
    // the same way once the 30-day window has fully lapsed) and retry once.
    this.token = undefined;
    const freshToken = await this.authenticate();
    const retried = await this.postMessage(to, text, freshToken);
    if (!retried) {
      throw new EskizError("Eskiz rejected the bearer token twice");
    }
  }

  /** @returns false when Eskiz answered 401, i.e. the token needs replacing. */
  private async postMessage(to: string, text: string, token: string): Promise<boolean> {
    const body = new FormData();
    body.set("mobile_phone", toEskizPhone(to));
    body.set("message", text);
    body.set("from", ESKIZ_DEFAULT_SENDER);

    const response = await this.request("/message/sms/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
    });

    if (response.status === 401) {
      return false;
    }

    if (!response.ok) {
      // The body may echo the message text, so only the status is logged.
      throw new EskizError(`Eskiz send failed with status ${response.status}`);
    }

    return true;
  }

  private async authenticate(): Promise<string> {
    const cached = this.token;
    if (cached !== undefined) {
      return cached;
    }

    this.authInFlight ??= this.login().finally(() => {
      this.authInFlight = undefined;
    });

    return this.authInFlight;
  }

  private async login(): Promise<string> {
    const body = new FormData();
    body.set("email", requiredEnv("ESKIZ_EMAIL", env.ESKIZ_EMAIL));
    body.set("password", requiredEnv("ESKIZ_PASSWORD", env.ESKIZ_PASSWORD));

    const response = await this.request("/auth/login", { method: "POST", body });
    if (!response.ok) {
      throw new EskizError(`Eskiz login failed with status ${response.status}`);
    }

    const parsed = loginResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new EskizError("Eskiz login response did not contain a token");
    }

    this.logger.log("Authenticated against Eskiz");
    this.token = parsed.data.data.token;
    return parsed.data.data.token;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(`${ESKIZ_BASE_URL}${path}`, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new EskizError(
        `Eskiz request to ${path} failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }
}

/** Eskiz expects a bare `998XXXXXXXXX`, while the platform stores E.164. */
function toEskizPhone(to: string): string {
  return to.replace(/\D/g, "");
}

/**
 * Infrastructure failure, not a domain failure: it is caught by the caller
 * (OtpService drops the pending code) and rendered as a generic 500 by
 * DomainExceptionFilter — the user is never shown gateway internals.
 */
class EskizError extends Error {}
