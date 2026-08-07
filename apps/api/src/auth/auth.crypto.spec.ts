import { createHash } from "node:crypto";
import { randomToken, sha256Hex, uuidV7 } from "./auth.crypto";

describe("auth crypto", () => {
  /**
   * Refresh tokens are stored only as a digest, so a database dump does not
   * hand an attacker a set of live sessions.
   */
  describe("sha256Hex", () => {
    it("produces the standard sha-256 digest as lowercase hex", () => {
      expect(sha256Hex("kidir")).toBe(createHash("sha256").update("kidir", "utf8").digest("hex"));
      expect(sha256Hex("kidir")).toMatch(/^[0-9a-f]{64}$/);
    });

    it("is stable across calls", () => {
      expect(sha256Hex("bir xil qiymat")).toBe(sha256Hex("bir xil qiymat"));
    });

    it("changes completely for a one-character difference", () => {
      expect(sha256Hex("token-a")).not.toBe(sha256Hex("token-b"));
    });

    it("handles an empty string and non-ascii input", () => {
      expect(sha256Hex("")).toMatch(/^[0-9a-f]{64}$/);
      expect(sha256Hex("o'zbek matni")).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("randomToken", () => {
    /** The default is 256 bits — the size the OAuth `state` relies on. */
    it("defaults to 32 bytes when no length is given", () => {
      expect(Buffer.from(randomToken(), "base64url")).toHaveLength(32);
    });

    it("honours an explicit length", () => {
      expect(Buffer.from(randomToken(16), "base64url")).toHaveLength(16);
      expect(Buffer.from(randomToken(64), "base64url")).toHaveLength(64);
    });

    /**
     * base64url, not base64: the value travels in a URL query string, where
     * `+`, `/` and `=` would have to be escaped.
     */
    it("stays url-safe", () => {
      for (let index = 0; index < 20; index += 1) {
        expect(randomToken()).toMatch(/^[A-Za-z0-9_-]+$/);
      }
    });

    it("does not repeat itself", () => {
      const tokens = new Set(Array.from({ length: 100 }, () => randomToken()));

      expect(tokens.size).toBe(100);
    });
  });

  /**
   * Every id in the project is a time-ordered v7 (docs/PLAN.md 7.4). Prisma
   * generates them for primary keys, but `familyId` is chosen by the
   * application — a v4 here would scatter the index the family lookups walk.
   */
  describe("uuidV7", () => {
    it("looks like a uuid", () => {
      expect(uuidV7()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it("declares version 7", () => {
      for (let index = 0; index < 50; index += 1) {
        expect(uuidV7()[14]).toBe("7");
      }
    });

    /** RFC 9562 variant: the high bits of byte 8 must be 10xx. */
    it("declares the rfc variant", () => {
      for (let index = 0; index < 50; index += 1) {
        expect(["8", "9", "a", "b"]).toContain(uuidV7()[19]);
      }
    });

    it("carries the current time in its leading 48 bits", () => {
      const before = Date.now();
      const timestamp = Number.parseInt(uuidV7().replace(/-/g, "").slice(0, 12), 16);
      const after = Date.now();

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    /**
     * The point of v7: ids minted later sort later as plain strings, which is
     * what keeps a b-tree index appending rather than fragmenting.
     */
    it("sorts in the order it was generated", () => {
      jest.useFakeTimers();

      try {
        const ids: string[] = [];
        for (let index = 0; index < 25; index += 1) {
          jest.setSystemTime(new Date(1_800_000_000_000 + index * 1_000));
          ids.push(uuidV7());
        }

        expect([...ids].sort()).toEqual(ids);
      } finally {
        jest.useRealTimers();
      }
    });

    it("does not repeat itself within a single millisecond", () => {
      jest.useFakeTimers();

      try {
        jest.setSystemTime(new Date(1_800_000_000_000));
        const ids = new Set(Array.from({ length: 500 }, () => uuidV7()));

        expect(ids.size).toBe(500);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
