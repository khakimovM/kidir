import { HttpStatus } from "@nestjs/common";
import { Redis } from "ioredis";
import { CONFIG_KEYS, ERROR_CODES, type ErrorCode } from "@kidir/shared";
import { DomainException } from "../common";
import { env } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import type { MailMessage, MailProvider } from "../providers/mail/mail-provider.interface";
import type { SmsProvider } from "../providers/sms/sms-provider.interface";
import { redisKey } from "../redis/redis.constants";
import type { OtpChannel } from "./otp.contract";
import { RedisOtpService } from "./redis-otp.service";

/**
 * Runs against the real Redis and the real test database (docker compose):
 * the attempt counter, the TTL and GETDEL are the behaviour under test, and a
 * fake Redis would only prove the fake works. Config rows are read from
 * Postgres for the same reason (.claude/rules/testing.md).
 *
 * Every test uses a unique target, so a stale key from another run — or from
 * another terminal sharing the container — cannot make it pass or fail.
 */

const SEEDED_TTL_SECONDS = 120;
const SEEDED_MAX_ATTEMPTS = 3;

class RecordingSmsProvider implements SmsProvider {
  readonly sent: { to: string; text: string }[] = [];
  failNext = false;

  send(to: string, text: string): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      return Promise.reject(new Error("sms gateway unavailable"));
    }

    this.sent.push({ to, text });
    return Promise.resolve();
  }
}

class RecordingMailProvider implements MailProvider {
  readonly sent: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }
}

function extractCode(text: string): string {
  const match = /\b(\d{6})\b/.exec(text);
  if (match?.[1] === undefined) {
    throw new Error(`no 6-digit code in message: ${text}`);
  }

  return match[1];
}

async function expectDomainError(
  promise: Promise<unknown>,
  code: ErrorCode,
): Promise<DomainException> {
  try {
    await promise;
  } catch (error) {
    if (!(error instanceof DomainException)) {
      throw error;
    }

    expect(error.code).toBe(code);
    return error;
  }

  throw new Error(`expected the call to reject with ${code}`);
}

/**
 * The TTL is enforced by Redis, whose clock cannot be faked from here. Waiting
 * on the observable condition instead of on a fixed duration is what keeps the
 * expiry tests from depending on how loaded the machine is.
 */
async function waitForExpiry(redis: Redis, key: string): Promise<void> {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    if ((await redis.exists(key)) === 0) {
      return;
    }

    await new Promise((resolve) => setImmediate(resolve));
  }

  throw new Error(`"${key}" kaliti kutilgan vaqtda o'chmadi`);
}

describe("RedisOtpService", () => {
  let redis: Redis;
  let prisma: PrismaService;
  let sms: RecordingSmsProvider;
  let mail: RecordingMailProvider;
  let service: RedisOtpService;
  let targetCounter = 0;
  let phone: string;
  let email: string;

  const codeKey = (channel: OtpChannel, target: string): string =>
    redisKey("otp", channel, target.toLowerCase());
  const verifiedKey = (channel: OtpChannel, target: string): string =>
    redisKey("otp", "verified", channel, target.toLowerCase());

  const setLimit = async (key: string, value: number): Promise<void> => {
    await prisma.config.upsert({ where: { key }, update: { value }, create: { key, value } });
  };

  const buildService = (): RedisOtpService => new RedisOtpService(redis, prisma, sms, mail);

  const issuedCode = async (channel: OtpChannel = "phone"): Promise<string> => {
    const target = channel === "phone" ? phone : email;
    await service.issue(channel, target);
    return channel === "phone"
      ? extractCode(sms.sent[sms.sent.length - 1]?.text ?? "")
      : extractCode(mail.sent[mail.sent.length - 1]?.text ?? "");
  };

  beforeAll(async () => {
    redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });
    prisma = new PrismaService();
    // The suite asserts against these numbers; the seed sets the same values,
    // so this only makes the run independent of seed order.
    await setLimit(CONFIG_KEYS.OTP_TTL_SECONDS, SEEDED_TTL_SECONDS);
    await setLimit(CONFIG_KEYS.OTP_MAX_ATTEMPTS, SEEDED_MAX_ATTEMPTS);
  });

  afterAll(async () => {
    await redis.quit();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    targetCounter += 1;
    const unique = `${process.pid}${Date.now() % 100_000}${targetCounter}`;
    phone = `+998${unique.slice(-9)}`;
    email = `Otp-Test-${unique}@Example.uz`;

    sms = new RecordingSmsProvider();
    mail = new RecordingMailProvider();
    service = buildService();
  });

  afterEach(async () => {
    await redis.del(
      codeKey("phone", phone),
      verifiedKey("phone", phone),
      codeKey("email", email),
      verifiedKey("email", email),
    );
  });

  describe("issue", () => {
    it("sends a 6-digit code over SMS and reports the lifetime from config", async () => {
      const result = await service.issue("phone", phone);

      expect(result).toEqual({
        retryAfterSeconds: SEEDED_TTL_SECONDS,
        expiresInSeconds: SEEDED_TTL_SECONDS,
      });
      expect(sms.sent).toHaveLength(1);
      expect(sms.sent[0]?.to).toBe(phone);
      expect(extractCode(sms.sent[0]?.text ?? "")).toMatch(/^\d{6}$/);
      expect(mail.sent).toHaveLength(0);
    });

    it("sends over email for the email channel and stores the code with a ttl", async () => {
      await service.issue("email", email);

      expect(mail.sent).toHaveLength(1);
      expect(mail.sent[0]?.to).toBe(email);
      expect(sms.sent).toHaveLength(0);
      await expect(redis.ttl(codeKey("email", email))).resolves.toBeGreaterThan(0);
    });

    it("rejects a resend while the previous code is still alive", async () => {
      const first = await issuedCode();

      const error = await expectDomainError(
        service.issue("phone", phone),
        ERROR_CODES.OTP_ALREADY_SENT,
      );

      expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      // The live code must survive the refused resend.
      expect(sms.sent).toHaveLength(1);
      await expect(service.verify("phone", phone, first)).resolves.toBeUndefined();
    });

    it("drops the pending code when the provider fails, so a resend is possible at once", async () => {
      sms.failNext = true;

      await expect(service.issue("phone", phone)).rejects.toThrow("sms gateway unavailable");
      await expect(redis.exists(codeKey("phone", phone))).resolves.toBe(0);

      await expect(service.issue("phone", phone)).resolves.toMatchObject({
        expiresInSeconds: SEEDED_TTL_SECONDS,
      });
    });

    /**
     * Storing the code only when none is live is a single atomic script, so
     * two "send me a code" requests racing cannot both win — otherwise the
     * second SMS would invalidate the code the user is already reading.
     */
    it("issues exactly one code when two requests race", async () => {
      const outcomes = await Promise.allSettled([
        service.issue("phone", phone),
        service.issue("phone", phone),
      ]);

      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      expect(sms.sent).toHaveLength(1);

      const code = extractCode(sms.sent[0]?.text ?? "");
      await expect(service.verify("phone", phone, code)).resolves.toBeUndefined();
    });

    it("keeps leading zeros, so every code is exactly six digits", async () => {
      const codes: string[] = [];

      for (let index = 0; index < 40; index += 1) {
        const target = `${phone.slice(0, -2)}${String(index).padStart(2, "0")}`;
        await service.issue("phone", target);
        codes.push(extractCode(sms.sent[sms.sent.length - 1]?.text ?? ""));
        await redis.del(codeKey("phone", target));
      }

      expect(codes.every((code) => /^\d{6}$/.test(code))).toBe(true);
      // A constant generator would be a catastrophic bug; 40 identical draws
      // from 10^6 is not something a healthy RNG produces.
      expect(new Set(codes).size).toBeGreaterThan(1);
    });
  });

  describe("verify", () => {
    it("accepts the correct code, clears it and leaves a claimable marker", async () => {
      const code = await issuedCode();

      await expect(service.verify("phone", phone, code)).resolves.toBeUndefined();

      await expect(redis.exists(codeKey("phone", phone))).resolves.toBe(0);
      await expect(redis.ttl(verifiedKey("phone", phone))).resolves.toBeGreaterThan(0);
      await expect(service.consumeVerification("phone", phone)).resolves.toBe(true);
    });

    it("rejects a wrong code with OTP_INVALID and spends one attempt", async () => {
      const code = await issuedCode();

      await expectDomainError(
        service.verify("phone", phone, wrongCode(code)),
        ERROR_CODES.OTP_INVALID,
      );

      await expect(redis.hget(codeKey("phone", phone), "attempts")).resolves.toBe("1");
      // A failed attempt must not hand out a verification marker.
      await expect(service.consumeVerification("phone", phone)).resolves.toBe(false);
    });

    it("burns the code once the attempt budget is spent", async () => {
      const code = await issuedCode();
      const wrong = wrongCode(code);

      await expectDomainError(service.verify("phone", phone, wrong), ERROR_CODES.OTP_INVALID);
      await expectDomainError(service.verify("phone", phone, wrong), ERROR_CODES.OTP_INVALID);

      const error = await expectDomainError(
        service.verify("phone", phone, wrong),
        ERROR_CODES.OTP_TOO_MANY_ATTEMPTS,
      );
      expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);

      await expect(redis.exists(codeKey("phone", phone))).resolves.toBe(0);
      // Even the right code is worthless afterwards.
      await expectDomainError(service.verify("phone", phone, code), ERROR_CODES.OTP_EXPIRED);
    });

    it("still accepts the correct code on the last allowed attempt", async () => {
      const code = await issuedCode();
      const wrong = wrongCode(code);

      await expectDomainError(service.verify("phone", phone, wrong), ERROR_CODES.OTP_INVALID);
      await expectDomainError(service.verify("phone", phone, wrong), ERROR_CODES.OTP_INVALID);

      await expect(service.verify("phone", phone, code)).resolves.toBeUndefined();
      await expect(service.consumeVerification("phone", phone)).resolves.toBe(true);
    });

    it("reports OTP_EXPIRED once the code's ttl has lapsed", async () => {
      const code = await issuedCode();
      await redis.pexpire(codeKey("phone", phone), 1);
      await waitForExpiry(redis, codeKey("phone", phone));

      await expectDomainError(service.verify("phone", phone, code), ERROR_CODES.OTP_EXPIRED);
    });

    /**
     * Counting the attempt and reading the code back happen in one Lua call
     * precisely so parallel guesses cannot each see the pre-increment counter
     * and buy themselves an extra try.
     */
    it("spends one attempt per guess even when the guesses arrive together", async () => {
      const code = await issuedCode();
      const wrong = wrongCode(code);

      const outcomes = await Promise.allSettled([
        service.verify("phone", phone, wrong),
        service.verify("phone", phone, wrong),
        service.verify("phone", phone, wrong),
      ]);

      expect(outcomes.every((outcome) => outcome.status === "rejected")).toBe(true);
      // Three wrong guesses is exactly the budget, so the code is gone.
      await expect(redis.exists(codeKey("phone", phone))).resolves.toBe(0);
      await expectDomainError(service.verify("phone", phone, code), ERROR_CODES.OTP_EXPIRED);
    });

    it("reports OTP_EXPIRED when no code was ever issued", async () => {
      await expectDomainError(service.verify("phone", phone, "123456"), ERROR_CODES.OTP_EXPIRED);
    });

    it("matches the target case-insensitively, so an email verifies either way", async () => {
      const code = await issuedCode("email");

      await expect(service.verify("email", email.toUpperCase(), code)).resolves.toBeUndefined();
      await expect(service.consumeVerification("email", email.toLowerCase())).resolves.toBe(true);
    });
  });

  describe("consumeVerification", () => {
    it("can be claimed only once", async () => {
      const code = await issuedCode();
      await service.verify("phone", phone, code);

      await expect(service.consumeVerification("phone", phone)).resolves.toBe(true);
      await expect(service.consumeVerification("phone", phone)).resolves.toBe(false);
    });

    it("returns false when the channel was never verified", async () => {
      await expect(service.consumeVerification("phone", phone)).resolves.toBe(false);
    });
  });

  describe("config-driven limits", () => {
    afterEach(async () => {
      await setLimit(CONFIG_KEYS.OTP_TTL_SECONDS, SEEDED_TTL_SECONDS);
      await setLimit(CONFIG_KEYS.OTP_MAX_ATTEMPTS, SEEDED_MAX_ATTEMPTS);
    });

    it("takes the lifetime from the config table rather than a constant", async () => {
      await setLimit(CONFIG_KEYS.OTP_TTL_SECONDS, 300);
      const configured = buildService();

      const result = await configured.issue("phone", phone);

      expect(result.expiresInSeconds).toBe(300);
      await expect(redis.ttl(codeKey("phone", phone))).resolves.toBeGreaterThan(SEEDED_TTL_SECONDS);
    });

    it("takes the attempt budget from the config table", async () => {
      await setLimit(CONFIG_KEYS.OTP_MAX_ATTEMPTS, 2);
      const configured = buildService();
      await configured.issue("phone", phone);
      const code = extractCode(sms.sent[0]?.text ?? "");
      const wrong = wrongCode(code);

      await expectDomainError(configured.verify("phone", phone, wrong), ERROR_CODES.OTP_INVALID);
      // Budget of 2: the second wrong guess is already the last one.
      await expectDomainError(
        configured.verify("phone", phone, wrong),
        ERROR_CODES.OTP_TOO_MANY_ATTEMPTS,
      );
    });

    it("caches the config, so a change mid-window is not read again", async () => {
      const cached = buildService();
      await cached.issue("phone", phone);

      await setLimit(CONFIG_KEYS.OTP_TTL_SECONDS, 900);
      await redis.del(codeKey("phone", phone));
      const result = await cached.issue("phone", phone);

      expect(result.expiresInSeconds).toBe(SEEDED_TTL_SECONDS);
    });

    it("falls back to the documented defaults when the config rows are missing", async () => {
      await prisma.config.deleteMany({
        where: { key: { in: [CONFIG_KEYS.OTP_TTL_SECONDS, CONFIG_KEYS.OTP_MAX_ATTEMPTS] } },
      });
      const degraded = buildService();

      const result = await degraded.issue("phone", phone);

      expect(result.expiresInSeconds).toBe(SEEDED_TTL_SECONDS);
      const code = extractCode(sms.sent[0]?.text ?? "");
      const wrong = wrongCode(code);
      await expectDomainError(degraded.verify("phone", phone, wrong), ERROR_CODES.OTP_INVALID);
      await expectDomainError(degraded.verify("phone", phone, wrong), ERROR_CODES.OTP_INVALID);
      await expectDomainError(
        degraded.verify("phone", phone, wrong),
        ERROR_CODES.OTP_TOO_MANY_ATTEMPTS,
      );
    });

    it("falls back when the config value is not a positive integer", async () => {
      await setLimit(CONFIG_KEYS.OTP_TTL_SECONDS, -5);
      const degraded = buildService();

      await expect(degraded.issue("phone", phone)).resolves.toMatchObject({
        expiresInSeconds: SEEDED_TTL_SECONDS,
      });
    });
  });
});

/** A code that is guaranteed to differ from the issued one. */
function wrongCode(code: string): string {
  const shifted = (Number(code) + 1) % 1_000_000;
  return String(shifted).padStart(6, "0");
}
