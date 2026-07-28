import { describe, expect, it } from "vitest";
import { zMoneyTiyin, zPhone } from "./common";

describe("zPhone", () => {
  it("accepts a valid +998 phone number", () => {
    expect(zPhone.safeParse("+998901234567").success).toBe(true);
  });

  it("rejects a number without the +998 prefix", () => {
    expect(zPhone.safeParse("+79001234567").success).toBe(false);
  });
});

describe("zMoneyTiyin", () => {
  it("accepts a non-negative bigint", () => {
    expect(zMoneyTiyin.safeParse(100n).success).toBe(true);
  });

  it("rejects a negative bigint", () => {
    expect(zMoneyTiyin.safeParse(-1n).success).toBe(false);
  });
});
