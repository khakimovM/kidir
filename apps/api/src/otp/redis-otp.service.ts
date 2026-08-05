import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { Redis } from "ioredis";
import { z } from "zod";
import { CONFIG_KEYS, ERROR_CODES } from "@kidir/shared";
import { DomainException } from "../common";
import { PrismaService } from "../prisma/prisma.service";
import { MAIL_PROVIDER, type MailProvider } from "../providers/mail/mail-provider.interface";
import { SMS_PROVIDER, type SmsProvider } from "../providers/sms/sms-provider.interface";
import { REDIS_CLIENT, redisKey } from "../redis/redis.constants";
import { type OtpChannel, type OtpIssueResult, OtpService } from "./otp.contract";

/** 6 digits, so 000000-999999 — leading zeros are significant. */
const OTP_MODULUS = 1_000_000;
const OTP_LENGTH = 6;

/**
 * How long a successful verification stays claimable. Registration happens
 * right after the code is entered, so 15 minutes is generous; it exists only
 * so a browser hiccup does not force a second SMS.
 */
const VERIFIED_MARKER_TTL_SECONDS = 15 * 60;

/** Config rows change through the admin panel, not per request. */
const CONFIG_CACHE_TTL_MS = 60_000;

/**
 * Used only when the config row is missing or unparseable — a broken seed
 * must not lock every user out of registration. These mirror the seeded
 * values (docs/PLAN.md); the config table stays the source of truth and the
 * fallback is logged as a warning.
 */
const FALLBACK_TTL_SECONDS = 120;
const FALLBACK_MAX_ATTEMPTS = 3;

interface OtpLimits {
  ttlSeconds: number;
  maxAttempts: number;
}

const limitSchema = z.coerce.number().int().positive();

/**
 * Stores the code and creates the attempt counter only when no live code
 * exists, and reports the remaining wait otherwise. Atomic, so two parallel
 * "send me a code" requests cannot both win and issue two codes.
 *
 * Returns the seconds left on the existing code, or -1 when a code was
 * stored. A key without a TTL (-1 from TTL) should be impossible; it is
 * replaced rather than left to live forever.
 */
const ISSUE_SCRIPT = `
local ttl = redis.call('TTL', KEYS[1])
if ttl > 0 then
  return ttl
end
redis.call('DEL', KEYS[1])
redis.call('HSET', KEYS[1], 'code', ARGV[1], 'attempts', '0')
redis.call('EXPIRE', KEYS[1], ARGV[2])
return -1
`;

/**
 * Consumes one attempt and hands the stored code back for a constant-time
 * comparison in Node (Lua string equality is not constant-time). Counting and
 * reading in one round trip is what makes the attempt budget unbeatable by
 * parallel guesses.
 *
 * Returns {found, code, exhausted}. When the budget is spent the key is
 * deleted immediately — right or wrong, that code is dead.
 */
const VERIFY_SCRIPT = `
local code = redis.call('HGET', KEYS[1], 'code')
if not code then
  return {0, '', 0}
end
local attempts = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
if attempts >= tonumber(ARGV[1]) then
  redis.call('DEL', KEYS[1])
  return {1, code, 1}
end
return {1, code, 0}
`;

const issueReplySchema = z.number().int();
const verifyReplySchema = z.tuple([z.number().int(), z.string(), z.number().int()]);

/**
 * Redis-backed OTP (see `OtpService` for the contract).
 *
 * Security properties this file is responsible for:
 * - codes come from `crypto.randomInt`, never `Math.random`;
 * - a code is compared in constant time and never written to a log or an
 *   exception message (only MockSmsProvider prints one, on purpose);
 * - the attempt budget and the TTL come from the config table, not constants;
 * - every state change is a single atomic Redis operation, so parallel
 *   requests cannot buy extra guesses or extra codes.
 */
@Injectable()
export class RedisOtpService extends OtpService {
  private readonly logger = new Logger(RedisOtpService.name);
  private limitsCache: { value: OtpLimits; expiresAt: number } | undefined;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    @Inject(MAIL_PROVIDER) private readonly mail: MailProvider,
  ) {
    super();
  }

  async issue(channel: OtpChannel, target: string): Promise<OtpIssueResult> {
    const { ttlSeconds } = await this.limits();
    const key = this.codeKey(channel, target);
    const code = generateCode();

    const reply = issueReplySchema.parse(
      await this.redis.eval(ISSUE_SCRIPT, 1, key, code, ttlSeconds),
    );

    if (reply > 0) {
      throw new DomainException(
        ERROR_CODES.OTP_ALREADY_SENT,
        `Kod allaqachon yuborilgan. ${reply} soniyadan keyin qayta urinib ko'ring.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      await this.deliver(channel, target, code, ttlSeconds);
    } catch (error) {
      // A code nobody received must not block the resend for a full TTL.
      await this.redis.del(key);
      throw error;
    }

    return { retryAfterSeconds: ttlSeconds, expiresInSeconds: ttlSeconds };
  }

  async verify(channel: OtpChannel, target: string, code: string): Promise<void> {
    const { maxAttempts } = await this.limits();
    const key = this.codeKey(channel, target);

    const [found, storedCode, exhausted] = verifyReplySchema.parse(
      await this.redis.eval(VERIFY_SCRIPT, 1, key, maxAttempts),
    );

    if (found === 0) {
      throw new DomainException(
        ERROR_CODES.OTP_EXPIRED,
        "Kod muddati tugagan yoki yuborilmagan. Yangi kod so'rang.",
      );
    }

    if (!constantTimeEquals(storedCode, code)) {
      if (exhausted === 1) {
        throw new DomainException(
          ERROR_CODES.OTP_TOO_MANY_ATTEMPTS,
          "Urinishlar soni tugadi. Yangi kod so'rang.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new DomainException(ERROR_CODES.OTP_INVALID, "Kod noto'g'ri.");
    }

    // Harmless when the script already deleted the key on the final attempt.
    await this.redis.del(key);
    await this.redis.set(this.verifiedKey(channel, target), "1", "EX", VERIFIED_MARKER_TTL_SECONDS);
  }

  async consumeVerification(channel: OtpChannel, target: string): Promise<boolean> {
    // GETDEL is atomic: two concurrent registrations cannot both claim the
    // same verification.
    const claimed = await this.redis.getdel(this.verifiedKey(channel, target));
    return claimed !== null;
  }

  private async deliver(
    channel: OtpChannel,
    target: string,
    code: string,
    ttlSeconds: number,
  ): Promise<void> {
    const minutes = Math.max(1, Math.round(ttlSeconds / 60));
    const text = `Kidir tasdiqlash kodi: ${code}. Kod ${minutes} daqiqa amal qiladi. Kodni hech kimga aytmang.`;

    if (channel === "phone") {
      await this.sms.send(target, text);
      return;
    }

    await this.mail.send({
      to: target,
      subject: "Kidir — tasdiqlash kodi",
      text,
      html: `<p>Kidir tasdiqlash kodi: <strong>${code}</strong></p><p>Kod ${minutes} daqiqa amal qiladi. Kodni hech kimga aytmang.</p>`,
    });
  }

  /**
   * OTP TTL and the attempt budget are business limits, so they live in the
   * config table (.claude/rules/database.md) — cached briefly, because every
   * issue and every verify would otherwise hit Postgres.
   */
  private async limits(): Promise<OtpLimits> {
    const cached = this.limitsCache;
    if (cached !== undefined && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const rows = await this.prisma.config.findMany({
      where: { key: { in: [CONFIG_KEYS.OTP_TTL_SECONDS, CONFIG_KEYS.OTP_MAX_ATTEMPTS] } },
      select: { key: true, value: true },
    });

    const byKey = new Map(rows.map((row) => [row.key, row.value]));
    const value: OtpLimits = {
      ttlSeconds: this.readLimit(byKey.get(CONFIG_KEYS.OTP_TTL_SECONDS), {
        key: CONFIG_KEYS.OTP_TTL_SECONDS,
        fallback: FALLBACK_TTL_SECONDS,
      }),
      maxAttempts: this.readLimit(byKey.get(CONFIG_KEYS.OTP_MAX_ATTEMPTS), {
        key: CONFIG_KEYS.OTP_MAX_ATTEMPTS,
        fallback: FALLBACK_MAX_ATTEMPTS,
      }),
    };

    this.limitsCache = { value, expiresAt: Date.now() + CONFIG_CACHE_TTL_MS };
    return value;
  }

  private readLimit(raw: unknown, { key, fallback }: { key: string; fallback: number }): number {
    const parsed = limitSchema.safeParse(raw);
    if (parsed.success) {
      return parsed.data;
    }

    this.logger.warn(`Config "${key}" is missing or invalid; falling back to ${fallback}`);
    return fallback;
  }

  private codeKey(channel: OtpChannel, target: string): string {
    return redisKey("otp", channel, normalizeTarget(target));
  }

  private verifiedKey(channel: OtpChannel, target: string): string {
    return redisKey("otp", "verified", channel, normalizeTarget(target));
  }
}

function generateCode(): string {
  return randomInt(0, OTP_MODULUS).toString().padStart(OTP_LENGTH, "0");
}

/**
 * A phone number is stored E.164 and an email is case-insensitive, so the key
 * has to be derived the same way on both sides — otherwise a code issued to
 * `User@x.uz` could never be verified as `user@x.uz`.
 */
function normalizeTarget(target: string): string {
  return target.trim().toLowerCase();
}

/**
 * Hashing first makes the comparison independent of length: timingSafeEqual
 * throws on mismatched buffers, and an early length check would leak the code
 * length. The digests are always 32 bytes.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const left = createHash("sha256").update(a, "utf8").digest();
  const right = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(left, right);
}
