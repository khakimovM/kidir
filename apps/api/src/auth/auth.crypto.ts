import { createHash, randomBytes } from "node:crypto";

/**
 * Refresh tokens are stored only as a digest, so a database dump does not hand
 * an attacker a set of live sessions. SHA-256 (not argon2) is deliberate: the
 * input is 128+ bits of server-generated entropy, not a guessable password, so
 * there is nothing for a slow hash to defend against — and refresh runs on
 * every page load.
 */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** URL-safe, 256 bits. Used for OAuth `state`. */
export function randomToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

/**
 * UUID v7 (RFC 9562): 48-bit big-endian millisecond timestamp, then random.
 *
 * Prisma generates these for primary keys, but `familyId` is chosen by the
 * application, and the project rule is that every id is time-ordered v7 — a v4
 * here would scatter the index the family lookups walk.
 */
export function uuidV7(): string {
  const random = randomBytes(10);
  const bytes = Buffer.alloc(16);

  bytes.writeUIntBE(Date.now(), 0, 6);
  random.copy(bytes, 6);

  // Version 7 in the high nibble of byte 6, RFC 4122 variant in byte 8.
  bytes[6] = 0x70 | (random.readUInt8(0) & 0x0f);
  bytes[8] = 0x80 | (random.readUInt8(2) & 0x3f);

  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
