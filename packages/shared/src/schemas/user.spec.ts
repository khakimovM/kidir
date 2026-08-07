import { describe, expect, it } from "vitest";
import {
  isAllowedPortfolioUrl,
  zBio,
  zFullName,
  zPortfolioLinks,
  zPublicUser,
  zSessionUser,
  zSkills,
  zUpdateProfile,
} from "./user";

describe("isAllowedPortfolioUrl", () => {
  it("accepts an allowlisted host over https", () => {
    expect(isAllowedPortfolioUrl("https://github.com/aziz")).toBe(true);
  });

  it("accepts a subdomain of an allowlisted host", () => {
    expect(isAllowedPortfolioUrl("https://workspace.notion.site/cv")).toBe(true);
  });

  it("rejects http", () => {
    expect(isAllowedPortfolioUrl("http://github.com/aziz")).toBe(false);
  });

  it("rejects a host outside the allowlist", () => {
    expect(isAllowedPortfolioUrl("https://evil.example.com")).toBe(false);
  });

  it("rejects a host that merely ends with an allowlisted name", () => {
    expect(isAllowedPortfolioUrl("https://notgithub.com/aziz")).toBe(false);
  });

  it("rejects an allowlisted host smuggled into the userinfo part", () => {
    expect(isAllowedPortfolioUrl("https://github.com@evil.example.com/x")).toBe(false);
  });

  it("rejects non-http schemes", () => {
    expect(isAllowedPortfolioUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedPortfolioUrl("file:///etc/passwd")).toBe(false);
  });

  it("rejects a malformed url", () => {
    expect(isAllowedPortfolioUrl("not a url")).toBe(false);
  });
});

describe("zPortfolioLinks", () => {
  it("rejects the whole list when one link is not allowlisted", () => {
    const result = zPortfolioLinks.safeParse([
      "https://github.com/aziz",
      "https://evil.example.com",
    ]);
    expect(result.success).toBe(false);
  });

  it("caps the list at 10 links", () => {
    const links = Array.from({ length: 11 }, (_, i) => `https://github.com/user${i}`);
    expect(zPortfolioLinks.safeParse(links).success).toBe(false);
  });
});

describe("zSkills", () => {
  it("accepts a self-assessment inside 0-100", () => {
    expect(zSkills.safeParse([{ name: "NestJS", level: 0 }]).success).toBe(true);
    expect(zSkills.safeParse([{ name: "NestJS", level: 100 }]).success).toBe(true);
  });

  it("rejects a level above 100", () => {
    expect(zSkills.safeParse([{ name: "NestJS", level: 101 }]).success).toBe(false);
  });

  it("rejects a negative level", () => {
    expect(zSkills.safeParse([{ name: "NestJS", level: -1 }]).success).toBe(false);
  });

  it("rejects a fractional level", () => {
    expect(zSkills.safeParse([{ name: "NestJS", level: 50.5 }]).success).toBe(false);
  });

  it("accepts an empty list", () => {
    expect(zSkills.safeParse([]).success).toBe(true);
  });

  it("caps the list at 20 entries", () => {
    const skills = Array.from({ length: 21 }, (_, index) => ({ name: `S${index}`, level: 50 }));

    expect(zSkills.safeParse(skills).success).toBe(false);
  });

  it("rejects an entry with a blank name", () => {
    expect(zSkills.safeParse([{ name: "   ", level: 50 }]).success).toBe(false);
  });
});

describe("zFullName", () => {
  it("trims before measuring, so padding cannot fake a name", () => {
    expect(zFullName.parse("  Aziz Xakimov  ")).toBe("Aziz Xakimov");
    expect(zFullName.safeParse("  A  ").success).toBe(false);
    expect(zFullName.safeParse("     ").success).toBe(false);
  });

  it("accepts a two-character name", () => {
    expect(zFullName.safeParse("Ali").success).toBe(true);
  });

  it("rejects a name longer than 100 characters", () => {
    expect(zFullName.safeParse("a".repeat(101)).success).toBe(false);
  });
});

describe("zBio", () => {
  it("accepts an empty bio", () => {
    expect(zBio.safeParse("").success).toBe(true);
  });

  it("rejects a bio longer than 1000 characters", () => {
    expect(zBio.safeParse("a".repeat(1000)).success).toBe(true);
    expect(zBio.safeParse("a".repeat(1001)).success).toBe(false);
  });
});

/** Onboarding saves one step at a time, so every field is optional. */
describe("zUpdateProfile", () => {
  it("accepts an empty patch", () => {
    expect(zUpdateProfile.parse({})).toEqual({});
  });

  it("accepts a single field on its own", () => {
    expect(zUpdateProfile.parse({ bio: "backend" })).toEqual({ bio: "backend" });
  });

  it("rejects an unknown specialization", () => {
    expect(zUpdateProfile.safeParse({ specialization: "ASTRONAUT" }).success).toBe(false);
  });

  it("still applies the allowlist to the links", () => {
    expect(zUpdateProfile.safeParse({ portfolioLinks: ["https://evil.example.com"] }).success).toBe(
      false,
    );
  });

  /** A field the client did not send must stay absent, not become null. */
  it("does not invent keys the caller omitted", () => {
    expect(Object.keys(zUpdateProfile.parse({ fullName: "Aziz Xakimov" }))).toEqual(["fullName"]);
  });
});

/**
 * The contract is the last line of defence for the leak the serializer is
 * written to prevent: a public profile carries no contact details at all.
 */
describe("zPublicUser", () => {
  const valid = {
    id: "0193b7f0-0000-7000-8000-000000000001",
    role: "WORKER",
    fullName: "Aziz Xakimov",
    bio: null,
    specialization: "BACKEND",
    skills: [{ name: "NestJS", level: 80 }],
    portfolioLinks: ["https://github.com/aziz"],
    kycLevel: "PHONE",
    createdAt: "2026-07-01T00:00:00.000Z",
  };

  it("accepts a well-formed public profile", () => {
    expect(zPublicUser.safeParse(valid).success).toBe(true);
  });

  it.each(["phone", "email", "passwordHash", "googleId", "status"])("strips %s", (field) => {
    const parsed = zPublicUser.parse({ ...valid, [field]: "sirli-qiymat" });

    expect(Object.keys(parsed)).not.toContain(field);
  });

  it("rejects a createdAt that is not an ISO timestamp", () => {
    expect(zPublicUser.safeParse({ ...valid, createdAt: "2026-07-01" }).success).toBe(false);
  });
});

describe("zSessionUser", () => {
  const valid = {
    id: "0193b7f0-0000-7000-8000-000000000001",
    role: "CLIENT",
    fullName: "Aziz Xakimov",
    bio: null,
    specialization: null,
    skills: [],
    portfolioLinks: [],
    kycLevel: "NONE",
    createdAt: "2026-07-01T00:00:00.000Z",
    status: "ACTIVE",
    phone: null,
    phoneVerified: false,
    email: "aziz@example.com",
    emailVerified: true,
    onboardingComplete: false,
  };

  /** A Google account arrives with no phone yet. */
  it("allows a null phone", () => {
    expect(zSessionUser.safeParse(valid).success).toBe(true);
  });

  it("allows a null email", () => {
    expect(zSessionUser.safeParse({ ...valid, email: null }).success).toBe(true);
  });

  it("still refuses to carry the password hash", () => {
    const parsed = zSessionUser.parse({ ...valid, passwordHash: "$argon2id$..." });

    expect(Object.keys(parsed)).not.toContain("passwordHash");
  });

  it("requires the verification flags to be present", () => {
    const { phoneVerified: _omitted, ...withoutFlag } = valid;

    expect(zSessionUser.safeParse(withoutFlag).success).toBe(false);
  });
});
