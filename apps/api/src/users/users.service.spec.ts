import { ERROR_CODES, type ErrorCode } from "@kidir/shared";
// Imported for the side effect: this module is what reads the repo-root .env,
// and PrismaService needs DATABASE_URL before its first query. main.ts pulls it
// in the same way.
import "../config/env";
import { DomainException } from "../common/exceptions/domain.exception";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "./users.service";

/**
 * Runs against the real test database (.claude/rules/testing.md): the partial
 * update is the behaviour under test, and only a real row can show that the
 * keys the client did not send were left alone.
 */
describe("UsersService", () => {
  let prisma: PrismaService;
  let users: UsersService;

  const createdUserIds: string[] = [];
  let sequence = 0;

  beforeAll(() => {
    prisma = new PrismaService();
    users = new UsersService(prisma);
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }

    await prisma.$disconnect();
  });

  // --- helpers -------------------------------------------------------------

  async function createUser(
    overrides: { role?: "CLIENT" | "WORKER"; deletedAt?: Date } = {},
  ): Promise<string> {
    sequence += 1;
    const suffix = `${Date.now()}${sequence}`.slice(-9).padStart(9, "0");

    const user = await prisma.user.create({
      data: {
        phone: `+998${suffix}`,
        phoneVerifiedAt: new Date(),
        email: `kidir.users.${suffix}@example.com`,
        emailVerifiedAt: new Date(),
        kycLevel: "PHONE",
        fullName: "Users Test",
        role: overrides.role ?? "WORKER",
        bio: "boshlang'ich bio",
        specialization: "BACKEND",
        skills: [{ name: "NestJS", level: 70 }],
        portfolioLinks: ["https://github.com/kidir"],
        deletedAt: overrides.deletedAt ?? null,
      },
      select: { id: true },
    });

    createdUserIds.push(user.id);
    return user.id;
  }

  async function expectDomainError(run: () => Promise<unknown>, code: ErrorCode): Promise<void> {
    try {
      await run();
    } catch (error) {
      if (!(error instanceof DomainException)) {
        throw error;
      }

      expect(error.code).toBe(code);
      return;
    }

    throw new Error(`${code} kutilgan edi, lekin xato tashlanmadi`);
  }

  const missingId = "0193b7f0-0000-7000-8000-0000000000aa";

  // --- reads ---------------------------------------------------------------

  describe("getSessionUser", () => {
    it("returns the caller's own view of the account", async () => {
      const userId = await createUser();

      const session = await users.getSessionUser(userId);

      expect(session.id).toBe(userId);
      expect(session.phone).not.toBeNull();
      expect(session.onboardingComplete).toBe(true);
    });

    it("reports a missing account as not found", async () => {
      await expectDomainError(() => users.getSessionUser(missingId), ERROR_CODES.NOT_FOUND);
    });

    /** A soft-deleted account is indistinguishable from a missing one. */
    it("reports a soft-deleted account as not found", async () => {
      const userId = await createUser({ deletedAt: new Date() });

      await expectDomainError(() => users.getSessionUser(userId), ERROR_CODES.NOT_FOUND);
    });
  });

  describe("getPublicProfile", () => {
    it("omits the contact details", async () => {
      const userId = await createUser();

      const profile = await users.getPublicProfile(userId);

      expect(Object.keys(profile)).not.toContain("phone");
      expect(Object.keys(profile)).not.toContain("email");
      expect(Object.keys(profile)).not.toContain("status");
    });

    it("reports a missing account as not found", async () => {
      await expectDomainError(() => users.getPublicProfile(missingId), ERROR_CODES.NOT_FOUND);
    });

    it("reports a soft-deleted account as not found", async () => {
      const userId = await createUser({ deletedAt: new Date() });

      await expectDomainError(() => users.getPublicProfile(userId), ERROR_CODES.NOT_FOUND);
    });
  });

  // --- writes --------------------------------------------------------------

  describe("updateProfile", () => {
    it("writes the full name on its own", async () => {
      const userId = await createUser();

      const updated = await users.updateProfile(userId, { fullName: "Yangi Ism" });

      expect(updated.fullName).toBe("Yangi Ism");
    });

    it("writes the bio on its own", async () => {
      const userId = await createUser();

      const updated = await users.updateProfile(userId, { bio: "yangi bio" });

      expect(updated.bio).toBe("yangi bio");
    });

    it("writes the specialization on its own", async () => {
      const userId = await createUser();

      const updated = await users.updateProfile(userId, { specialization: "DEVOPS" });

      expect(updated.specialization).toBe("DEVOPS");
    });

    it("replaces the skills wholesale", async () => {
      const userId = await createUser();

      const updated = await users.updateProfile(userId, {
        skills: [{ name: "Postgres", level: 60 }],
      });

      expect(updated.skills).toEqual([{ name: "Postgres", level: 60 }]);
    });

    it("replaces the portfolio links rather than appending to them", async () => {
      const userId = await createUser();

      const updated = await users.updateProfile(userId, {
        portfolioLinks: ["https://gitlab.com/kidir"],
      });

      expect(updated.portfolioLinks).toEqual(["https://gitlab.com/kidir"]);
    });

    /**
     * Onboarding saves one step at a time, so a half-filled form must never
     * blank out what an earlier step stored.
     */
    it("leaves every key the caller did not send untouched", async () => {
      const userId = await createUser();
      const before = await users.getSessionUser(userId);

      const updated = await users.updateProfile(userId, { bio: "faqat bio o'zgardi" });

      expect(updated.bio).toBe("faqat bio o'zgardi");
      expect(updated.fullName).toBe(before.fullName);
      expect(updated.specialization).toBe(before.specialization);
      expect(updated.skills).toEqual(before.skills);
      expect(updated.portfolioLinks).toEqual(before.portfolioLinks);
      expect(updated.phone).toBe(before.phone);
    });

    it("accepts an empty patch without changing anything", async () => {
      const userId = await createUser();
      const before = await users.getSessionUser(userId);

      const updated = await users.updateProfile(userId, {});

      expect(updated).toEqual(before);
    });

    it("can clear the portfolio links with an empty list", async () => {
      const userId = await createUser();

      const updated = await users.updateProfile(userId, { portfolioLinks: [] });

      expect(updated.portfolioLinks).toEqual([]);
    });

    /**
     * The links are never rendered as previews, so an arbitrary URL here would
     * be an SSRF vector. The service re-checks the rule the schema already
     * enforces, which is what gives a non-HTTP caller the same guarantee.
     */
    describe("the portfolio allowlist", () => {
      it.each([
        ["an unlisted host", "https://example.com/portfolio"],
        ["plain http on a listed host", "http://github.com/kidir"],
        ["a host that merely ends in the domain name", "https://evil-github.com/kidir"],
        ["something that is not a url", "github.com/kidir"],
        ["a non-http scheme", "javascript:alert(1)"],
      ])("refuses %s", async (_label, link) => {
        const userId = await createUser();

        await expectDomainError(
          () => users.updateProfile(userId, { portfolioLinks: [link] }),
          ERROR_CODES.PORTFOLIO_LINK_NOT_ALLOWED,
        );
      });

      it("refuses the whole list when a single link is disallowed", async () => {
        const userId = await createUser();

        await expectDomainError(
          () =>
            users.updateProfile(userId, {
              portfolioLinks: ["https://github.com/kidir", "https://example.com/x"],
            }),
          ERROR_CODES.PORTFOLIO_LINK_NOT_ALLOWED,
        );

        // Nothing was written: the rejection happens before the update.
        const after = await users.getSessionUser(userId);
        expect(after.portfolioLinks).toEqual(["https://github.com/kidir"]);
      });

      it.each([
        "https://github.com/kidir",
        "https://gitlab.com/kidir",
        "https://www.linkedin.com/in/kidir",
        "https://behance.net/kidir",
        "https://dribbble.com/kidir",
        "https://kidir.notion.site/portfolio",
      ])("accepts %s", async (link) => {
        const userId = await createUser();

        const updated = await users.updateProfile(userId, { portfolioLinks: [link] });

        expect(updated.portfolioLinks).toEqual([link]);
      });
    });

    it("refuses to update an account that does not exist", async () => {
      await expectDomainError(
        () => users.updateProfile(missingId, { bio: "salom" }),
        ERROR_CODES.NOT_FOUND,
      );
    });

    it("refuses to update a soft-deleted account", async () => {
      const userId = await createUser({ deletedAt: new Date() });

      await expectDomainError(
        () => users.updateProfile(userId, { bio: "salom" }),
        ERROR_CODES.NOT_FOUND,
      );
    });

    /**
     * `onboardingComplete` is derived, not stored, so it has to react to the
     * write that just happened rather than to a stale row.
     */
    it("recomputes onboardingComplete from the row it just wrote", async () => {
      const userId = await createUser({ role: "WORKER" });
      await prisma.user.update({
        where: { id: userId },
        data: { specialization: null, skills: [] },
      });

      expect((await users.getSessionUser(userId)).onboardingComplete).toBe(false);

      const updated = await users.updateProfile(userId, {
        specialization: "FRONTEND",
        skills: [{ name: "React", level: 90 }],
      });

      expect(updated.onboardingComplete).toBe(true);
    });
  });

  describe("toSessionUser", () => {
    it("serialises a row the caller already holds", async () => {
      const userId = await createUser();
      const row = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

      expect(users.toSessionUser(row)).toEqual(await users.getSessionUser(userId));
    });
  });
});
