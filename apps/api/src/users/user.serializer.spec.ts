import type { User } from "@prisma/client";
import type { UserRole } from "@kidir/shared";
import { isOnboardingComplete, parseSkills, toPublicUser, toSessionUser } from "./user.serializer";

/**
 * A fully populated row, so every test states only what it is actually about.
 * The serializer is pure, so no database is needed here — `users.service.spec`
 * covers the same functions against real rows.
 */
function userRow(overrides: Partial<User> = {}): User {
  return {
    id: "0193b7f0-0000-7000-8000-000000000001",
    role: "CLIENT",
    status: "ACTIVE",
    kycLevel: "PHONE",
    phone: "+998901234567",
    phoneVerifiedAt: new Date("2026-07-01T00:00:00.000Z"),
    email: "aziz@example.com",
    emailVerifiedAt: new Date("2026-07-01T00:00:00.000Z"),
    passwordHash: "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$hash",
    googleId: "google-123",
    fullName: "Aziz Xakimov",
    bio: "Backend dasturchi",
    specialization: "BACKEND",
    skills: [{ name: "NestJS", level: 80 }],
    portfolioLinks: ["https://github.com/aziz"],
    warningsCount: 0,
    suspendedUntil: null,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  } as User;
}

describe("user serializer", () => {
  /**
   * `skills` is a Json column, so what comes back is whatever was written —
   * possibly by an older shape of the schema. An unreadable value must degrade
   * to "no skills" rather than break a profile page.
   */
  describe("parseSkills", () => {
    it("returns the assessments when the column holds a valid list", () => {
      expect(parseSkills([{ name: "NestJS", level: 80 }])).toEqual([{ name: "NestJS", level: 80 }]);
    });

    it("returns an empty list for an empty array", () => {
      expect(parseSkills([])).toEqual([]);
    });

    it.each([
      ["null", null],
      ["a plain object", { name: "NestJS" }],
      ["a string", "NestJS"],
      ["a number", 42],
      ["entries with the wrong shape", [{ name: "NestJS" }]],
      ["a level outside the range", [{ name: "NestJS", level: 500 }]],
    ])("degrades to an empty list for %s", (_label, value) => {
      expect(parseSkills(value as User["skills"])).toEqual([]);
    });
  });

  describe("isOnboardingComplete", () => {
    it("is true for a client with both channels verified and a real name", () => {
      expect(isOnboardingComplete(userRow({ role: "CLIENT" }))).toBe(true);
    });

    it("is false while the phone is unverified", () => {
      expect(isOnboardingComplete(userRow({ phoneVerifiedAt: null }))).toBe(false);
    });

    it("is false while the email is unverified", () => {
      expect(isOnboardingComplete(userRow({ emailVerifiedAt: null }))).toBe(false);
    });

    it.each([
      ["empty", ""],
      ["a single letter", "A"],
      ["only whitespace", "   "],
    ])("is false when the full name is %s", (_label, fullName) => {
      expect(isOnboardingComplete(userRow({ fullName }))).toBe(false);
    });

    /** WORKER and PM get hired, so they have a craft to declare. */
    describe.each(["WORKER", "PM"] as const)("for a %s", (role: UserRole) => {
      it("is false without a specialization", () => {
        expect(isOnboardingComplete(userRow({ role, specialization: null }))).toBe(false);
      });

      it("is false without at least one skill", () => {
        expect(isOnboardingComplete(userRow({ role, skills: [] }))).toBe(false);
      });

      it("is false when the stored skills cannot be parsed", () => {
        expect(isOnboardingComplete(userRow({ role, skills: "buzuq" }))).toBe(false);
      });

      it("is true once both are set", () => {
        expect(isOnboardingComplete(userRow({ role }))).toBe(true);
      });
    });

    /** A client is never asked for a specialization. */
    it.each(["CLIENT", "MODERATOR", "SUPERADMIN"] as const)(
      "ignores the craft fields for a %s",
      (role: UserRole) => {
        expect(isOnboardingComplete(userRow({ role, specialization: null, skills: [] }))).toBe(
          true,
        );
      },
    );
  });

  /**
   * The object is built field by field precisely so that a column added to the
   * model later cannot leak by being spread in. These assertions are what turn
   * that intention into a failing test if someone rewrites it as a spread.
   */
  describe("toPublicUser", () => {
    const publicUser = toPublicUser(userRow());

    it("exposes exactly the public fields", () => {
      expect(Object.keys(publicUser).sort()).toEqual([
        "bio",
        "createdAt",
        "fullName",
        "id",
        "kycLevel",
        "portfolioLinks",
        "role",
        "skills",
        "specialization",
      ]);
    });

    it.each(["phone", "email", "passwordHash", "googleId", "status", "deletedAt"])(
      "hides %s",
      (field) => {
        expect(Object.keys(publicUser)).not.toContain(field);
      },
    );

    it("never carries a credential in its serialised form", () => {
      expect(JSON.stringify(publicUser)).not.toContain("$argon2");
      expect(JSON.stringify(publicUser)).not.toContain("+998901234567");
    });

    it("renders createdAt as an ISO string", () => {
      expect(publicUser.createdAt).toBe("2026-06-01T00:00:00.000Z");
    });
  });

  describe("toSessionUser", () => {
    it("adds the private fields the owner may see about themselves", () => {
      const session = toSessionUser(userRow());

      expect(session.phone).toBe("+998901234567");
      expect(session.email).toBe("aziz@example.com");
      expect(session.status).toBe("ACTIVE");
      expect(session.phoneVerified).toBe(true);
      expect(session.emailVerified).toBe(true);
      expect(session.onboardingComplete).toBe(true);
    });

    it("still keeps the password hash and the google id out", () => {
      const session = toSessionUser(userRow());

      expect(Object.keys(session)).not.toContain("passwordHash");
      expect(Object.keys(session)).not.toContain("googleId");
    });

    it("reports an unverified channel as false rather than omitting it", () => {
      const session = toSessionUser(userRow({ phoneVerifiedAt: null, emailVerifiedAt: null }));

      expect(session.phoneVerified).toBe(false);
      expect(session.emailVerified).toBe(false);
      expect(session.onboardingComplete).toBe(false);
    });

    /** A Google account arrives without a phone; null must survive the trip. */
    it("keeps a null phone as null", () => {
      const session = toSessionUser(userRow({ phone: null, phoneVerifiedAt: null }));

      expect(session.phone).toBeNull();
      expect(session.phoneVerified).toBe(false);
    });
  });
});
