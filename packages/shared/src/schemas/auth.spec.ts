import { describe, expect, it } from "vitest";
import {
  zAuthResponse,
  zEmail,
  zGoogleCallbackQuery,
  zLogin,
  zNewPassword,
  zOtpCode,
  zOtpRequestResponse,
  zRegister,
  zSelfServiceRole,
  zVerifyPhoneOtp,
} from "./auth";

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

  it("rejects an empty identifier", () => {
    expect(zLogin.safeParse({ identifier: "   ", password: "parol12345" }).success).toBe(false);
  });

  it("trims the identifier, so a copy-pasted address still matches", () => {
    const parsed = zLogin.parse({ identifier: "  aziz@example.com  ", password: "parol12345" });

    expect(parsed.identifier).toBe("aziz@example.com");
  });

  /** The identifier is a phone or an email, so it is not lowercased here — the
   * server decides which shape it is and normalises accordingly. */
  it("leaves the identifier's case alone", () => {
    const parsed = zLogin.parse({ identifier: "Aziz@Example.com", password: "parol12345" });

    expect(parsed.identifier).toBe("Aziz@Example.com");
  });
});

describe("zEmail length", () => {
  it("rejects an address longer than 254 characters", () => {
    const long = `${"a".repeat(250)}@example.com`;

    expect(zEmail.safeParse(long).success).toBe(false);
  });

  it.each(["aziz", "aziz@", "@example.com", "aziz example.com"])("rejects %s", (value) => {
    expect(zEmail.safeParse(value).success).toBe(false);
  });
});

describe("zVerifyPhoneOtp", () => {
  it("requires both the phone and the code", () => {
    expect(zVerifyPhoneOtp.safeParse({ phone: "+998901234567" }).success).toBe(false);
    expect(zVerifyPhoneOtp.safeParse({ code: "123456" }).success).toBe(false);
  });

  it("keeps a code with leading zeros as a string", () => {
    const parsed = zVerifyPhoneOtp.parse({ phone: "+998901234567", code: "000123" });

    expect(parsed.code).toBe("000123");
  });
});

/**
 * `state` is the CSRF defence for the OAuth callback: without it an attacker
 * can feed the victim's browser their own authorization code.
 */
describe("zGoogleCallbackQuery", () => {
  it("accepts a code and a state", () => {
    expect(zGoogleCallbackQuery.safeParse({ code: "abc", state: "xyz" }).success).toBe(true);
  });

  it("rejects a callback with no state", () => {
    expect(zGoogleCallbackQuery.safeParse({ code: "abc" }).success).toBe(false);
    expect(zGoogleCallbackQuery.safeParse({ code: "abc", state: "" }).success).toBe(false);
  });

  it("rejects a callback with no code", () => {
    expect(zGoogleCallbackQuery.safeParse({ state: "xyz" }).success).toBe(false);
  });
});

/**
 * The contract itself is where "no tokens in the body" is guaranteed: the
 * response carries the session user and nothing else (docs/PLAN.md 7.3).
 */
describe("zAuthResponse", () => {
  const user = {
    id: "0193b7f0-0000-7000-8000-000000000001",
    role: "CLIENT",
    fullName: "Aziz Xakimov",
    bio: null,
    specialization: null,
    skills: [],
    portfolioLinks: [],
    kycLevel: "PHONE",
    createdAt: "2026-07-01T00:00:00.000Z",
    status: "ACTIVE",
    phone: "+998901234567",
    phoneVerified: true,
    email: "aziz@example.com",
    emailVerified: true,
    onboardingComplete: true,
  };

  it("accepts a response carrying only the user", () => {
    expect(zAuthResponse.safeParse({ user }).success).toBe(true);
  });

  it("strips a token somebody added to the payload", () => {
    const parsed = zAuthResponse.parse({ user, accessToken: "eyJhbGciOi" });

    expect(Object.keys(parsed)).toEqual(["user"]);
  });

  it("strips a password hash smuggled onto the user", () => {
    const parsed = zAuthResponse.parse({ user: { ...user, passwordHash: "$argon2id$..." } });

    expect(Object.keys(parsed.user)).not.toContain("passwordHash");
  });
});

describe("zOtpRequestResponse", () => {
  it("accepts the waiting times", () => {
    const value = { retryAfterSeconds: 0, expiresInSeconds: 120 };

    expect(zOtpRequestResponse.safeParse(value).success).toBe(true);
  });

  it("rejects a lifetime of zero — a code that is already dead is not a code", () => {
    expect(
      zOtpRequestResponse.safeParse({ retryAfterSeconds: 0, expiresInSeconds: 0 }).success,
    ).toBe(false);
  });

  it("rejects a negative wait", () => {
    expect(
      zOtpRequestResponse.safeParse({ retryAfterSeconds: -1, expiresInSeconds: 120 }).success,
    ).toBe(false);
  });
});
