import { describe, expect, it } from "vitest";
import { zEmail, zLogin, zNewPassword, zOtpCode, zRegister, zSelfServiceRole } from "./auth";

describe("zOtpCode", () => {
  it("accepts six digits", () => {
    expect(zOtpCode.safeParse("012345").success).toBe(true);
  });

  it("rejects a five digit code", () => {
    expect(zOtpCode.safeParse("01234").success).toBe(false);
  });

  it("rejects non-digits", () => {
    expect(zOtpCode.safeParse("01234a").success).toBe(false);
  });
});

describe("zNewPassword", () => {
  it("accepts a password with a letter, a digit and 10+ characters", () => {
    expect(zNewPassword.safeParse("parol12345").success).toBe(true);
  });

  it("rejects a password shorter than 10 characters", () => {
    expect(zNewPassword.safeParse("parol123").success).toBe(false);
  });

  it("rejects a password with no digit", () => {
    expect(zNewPassword.safeParse("parolparolparol").success).toBe(false);
  });

  it("rejects a password with no letter", () => {
    expect(zNewPassword.safeParse("1234567890").success).toBe(false);
  });
});

describe("zEmail", () => {
  it("lowercases the address", () => {
    expect(zEmail.parse("Aziz@Example.COM")).toBe("aziz@example.com");
  });
});

describe("zSelfServiceRole", () => {
  it.each(["PM", "MODERATOR", "SUPERADMIN"])("rejects %s", (role) => {
    expect(zSelfServiceRole.safeParse(role).success).toBe(false);
  });

  it.each(["CLIENT", "WORKER"])("accepts %s", (role) => {
    expect(zSelfServiceRole.safeParse(role).success).toBe(true);
  });
});

describe("zRegister", () => {
  const valid = {
    phone: "+998901234567",
    email: "aziz@example.com",
    password: "parol12345",
    fullName: "Aziz Xakimov",
    role: "CLIENT",
  };

  it("accepts a complete registration", () => {
    expect(zRegister.safeParse(valid).success).toBe(true);
  });

  it("rejects a non-uzbek phone number", () => {
    expect(zRegister.safeParse({ ...valid, phone: "+79001234567" }).success).toBe(false);
  });
});

describe("zLogin", () => {
  it("does not apply the registration password policy", () => {
    const result = zLogin.safeParse({ identifier: "aziz@example.com", password: "short" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(zLogin.safeParse({ identifier: "aziz@example.com", password: "" }).success).toBe(false);
  });
});
