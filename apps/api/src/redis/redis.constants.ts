/**
 * Injection token for the shared ioredis connection.
 *
 * Redis is never a source of truth here — only cache, queue, presence and
 * short-lived OTP state. Every key follows `kidir:<domain>:<id>` and every key
 * gets a TTL (see .claude/rules/database.md).
 */
export const REDIS_CLIENT = "REDIS_CLIENT";

export const REDIS_KEY_PREFIX = "kidir";

export function redisKey(...parts: readonly string[]): string {
  return [REDIS_KEY_PREFIX, ...parts].join(":");
}
