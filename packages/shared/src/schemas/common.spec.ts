import { describe, expect, it } from "vitest";
import { zMoneyTiyin, zPagination, zPhone, zUuid } from "./common";

describe("zPhone", () => {
  it("accepts a valid +998 phone number", () => {
    expect(zPhone.safeParse("+998901234567").success).toBe(true);
  });

  it("rejects a number without the +998 prefix", () => {
    expect(zPhone.safeParse("+79001234567").success).toBe(false);
  });

  it.each([
    ["too few digits", "+99890123456"],
    ["too many digits", "+9989012345678"],
    ["no plus", "998901234567"],
    ["spaces inside", "+998 90 123 45 67"],
    ["a letter", "+99890123456a"],
    ["empty", ""],
  ])("rejects a number with %s", (_label, value) => {
    expect(zPhone.safeParse(value).success).toBe(false);
  });
});

/**
 * Money is integer tiyin as BigInt, and float arithmetic on money is banned
 * outright (CLAUDE.md). The schema is the boundary that has to enforce it, so
 * a `number` must never be coerced into passing.
 */
describe("zMoneyTiyin", () => {
  it("accepts a non-negative bigint", () => {
    expect(zMoneyTiyin.safeParse(100n).success).toBe(true);
  });

  it("accepts zero", () => {
    expect(zMoneyTiyin.safeParse(0n).success).toBe(true);
  });

  it("rejects a negative bigint", () => {
    expect(zMoneyTiyin.safeParse(-1n).success).toBe(false);
  });

  it.each([
    ["an integer number", 100],
    ["a float", 100.5],
    ["a numeric string", "100"],
    ["null", null],
    ["undefined", undefined],
  ])("refuses to accept %s as money", (_label, value) => {
    expect(zMoneyTiyin.safeParse(value).success).toBe(false);
  });

  it("keeps a sum larger than Number.MAX_SAFE_INTEGER exact", () => {
    const huge = 9_007_199_254_740_993n;

    expect(zMoneyTiyin.parse(huge)).toBe(huge);
  });
});

describe("zUuid", () => {
  it("accepts a uuid v7", () => {
    expect(zUuid.safeParse("0193b7f0-0000-7000-8000-000000000001").success).toBe(true);
  });

  it.each([
    ["a plain string", "kidir"],
    ["a uuid without dashes", "0193b7f000007000800000000000001"],
    ["an empty string", ""],
  ])("rejects %s", (_label, value) => {
    expect(zUuid.safeParse(value).success).toBe(false);
  });
});

/** Pagination is cursor-based, never offset (.claude/rules/api-design.md). */
describe("zPagination", () => {
  it("defaults the page size when the caller sends nothing", () => {
    expect(zPagination.parse({})).toEqual({ limit: 20 });
  });

  it("accepts a cursor and an explicit limit", () => {
    const cursor = "0193b7f0-0000-7000-8000-000000000001";

    expect(zPagination.parse({ cursor, limit: 50 })).toEqual({ cursor, limit: 50 });
  });

  it("caps the page size at 100", () => {
    expect(zPagination.safeParse({ limit: 100 }).success).toBe(true);
    expect(zPagination.safeParse({ limit: 101 }).success).toBe(false);
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["fractional", 10.5],
  ])("rejects a %s limit", (_label, limit) => {
    expect(zPagination.safeParse({ limit }).success).toBe(false);
  });

  it("rejects a cursor that is not a uuid", () => {
    expect(zPagination.safeParse({ cursor: "5" }).success).toBe(false);
  });
});
