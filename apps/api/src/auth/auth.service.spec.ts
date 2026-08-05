import { JwtModule } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import { ERROR_CODES, type ErrorCode } from "@kidir/shared";
import { DomainException } from "../common/exceptions/domain.exception";
import { PrismaService } from "../prisma/prisma.service";
import { OtpService, type OtpChannel, type OtpIssueResult } from "../otp/otp.contract";
import { UsersService } from "../users/users.service";
import { AuthService } from "./auth.service";
import { TokenService, type SessionContext } from "./token.service";

// argon2 at the configured cost plus a real database round-trip per step:
// the default 5s budget is not enough for the registration-heavy cases.
jest.setTimeout(60_000);

const VALID_CODE = "123456";
const PASSWORD = "kidir-parol-2026";
const CONTEXT: SessionContext = { ip: "127.0.0.1", userAgent: "jest" };

/**
 * Stands in for the Redis-backed implementation the infra terminal owns. Only
 * the contract is reproduced — codes are compared literally and the
 * verification marker is a set, which is all the auth flow can observe.
 *
 * Prisma is *not* mocked (see .claude/rules/testing.md): rotation and reuse
 * detection are decided by unique constraints and row locks, and a fake would
 * be testing the fake.
 */
class FakeOtpService extends OtpService {
  private readonly verified = new Set<string>();

  issue(): Promise<OtpIssueResult> {
    return Promise.resolve({ retryAfterSeconds: 60, expiresInSeconds: 120 });
  }

  verify(channel: OtpChannel, target: string, code: string): Promise<void> {
    if (code !== VALID_CODE) {
      throw new DomainException(ERROR_CODES.OTP_INVALID, "Kod noto'g'ri");
    }

    this.verified.add(markerKey(channel, target));
    return Promise.resolve();
  }

  consumeVerification(channel: OtpChannel, target: string): Promise<boolean> {
    return Promise.resolve(this.verified.delete(markerKey(channel, target)));
  }

  reset(): void {
    this.verified.clear();
  }
}

function markerKey(channel: OtpChannel, target: string): string {
  return `${channel}:${target}`;
}

describe("AuthService", () => {
  let moduleRef: TestingModule;
  let auth: AuthService;
  let tokens: TokenService;
  let users: UsersService;
  let prisma: PrismaService;
  let otp: FakeOtpService;

  const createdUserIds: string[] = [];
  let sequence = 0;

  beforeAll(async () => {
    otp = new FakeOtpService();

    moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [
        AuthService,
        TokenService,
        UsersService,
        PrismaService,
        { provide: OtpService, useValue: otp },
      ],
    }).compile();

    // compile() does not run lifecycle hooks, and AuthService warms its decoy
    // hash in onModuleInit.
    await moduleRef.init();

    auth = moduleRef.get(AuthService);
    tokens = moduleRef.get(TokenService);
    users = moduleRef.get(UsersService);
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }

    await moduleRef.close();
  });

  beforeEach(() => {
    otp.reset();
  });

  // --- helpers -------------------------------------------------------------

  /** Unique per test run so a rerun never collides with leftover rows. */
  function uniqueSuffix(): string {
    sequence += 1;
    const stamp = `${Date.now()}${sequence}`;
    return stamp.slice(-9).padStart(9, "0");
  }

  interface TestAccount {
    userId: string;
    phone: string;
    email: string;
    refreshToken: string;
  }

  async function registerAccount(role: "CLIENT" | "WORKER" = "CLIENT"): Promise<TestAccount> {
    const suffix = uniqueSuffix();
    const phone = `+998${suffix}`;
    const email = `kidir.test.${suffix}@example.com`;

    await auth.verifyPhoneOtp({ phone, code: VALID_CODE });
    const session = await auth.register(
      { phone, email, password: PASSWORD, fullName: "Test Foydalanuvchi", role },
      CONTEXT,
    );

    createdUserIds.push(session.user.id);

    return { userId: session.user.id, phone, email, refreshToken: session.tokens.refreshToken };
  }

  async function captureDomainError(run: () => Promise<unknown>): Promise<DomainException> {
    try {
      await run();
    } catch (error) {
      if (error instanceof DomainException) {
        return error;
      }
      throw error;
    }

    throw new Error("DomainException kutilgan edi, lekin xato tashlanmadi");
  }

  async function expectDomainError(
    run: () => Promise<unknown>,
    code: ErrorCode,
  ): Promise<DomainException> {
    const error = await captureDomainError(run);
    expect(error.code).toBe(code);
    return error;
  }

  // --- registration --------------------------------------------------------

  describe("register", () => {
    it("records the phone as verified and raises kycLevel to PHONE", async () => {
      const account = await registerAccount();
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: account.userId } });

      expect(stored.phoneVerifiedAt).not.toBeNull();
      expect(stored.kycLevel).toBe("PHONE");
      expect(stored.emailVerifiedAt).toBeNull();
      expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    });

    it("never returns the password hash or the google id", async () => {
      const suffix = uniqueSuffix();
      const phone = `+998${suffix}`;
      await auth.verifyPhoneOtp({ phone, code: VALID_CODE });

      const session = await auth.register(
        {
          phone,
          email: `kidir.test.${suffix}@example.com`,
          password: PASSWORD,
          fullName: "Test Foydalanuvchi",
          role: "CLIENT",
        },
        CONTEXT,
      );
      createdUserIds.push(session.user.id);

      expect(Object.keys(session.user)).not.toContain("passwordHash");
      expect(Object.keys(session.user)).not.toContain("googleId");
      expect(session.user.phoneVerified).toBe(true);
      expect(session.user.emailVerified).toBe(false);
      expect(session.user.onboardingComplete).toBe(false);
    });

    it("rejects a registration whose phone was never verified", async () => {
      const suffix = uniqueSuffix();

      await expectDomainError(
        () =>
          auth.register(
            {
              phone: `+998${suffix}`,
              email: `kidir.test.${suffix}@example.com`,
              password: PASSWORD,
              fullName: "Test Foydalanuvchi",
              role: "CLIENT",
            },
            CONTEXT,
          ),
        ERROR_CODES.OTP_NOT_VERIFIED,
      );
    });

    it("rejects a phone that already has an account", async () => {
      const existing = await registerAccount();
      await auth.verifyPhoneOtp({ phone: existing.phone, code: VALID_CODE });

      await expectDomainError(
        () =>
          auth.register(
            {
              phone: existing.phone,
              email: `kidir.test.${uniqueSuffix()}@example.com`,
              password: PASSWORD,
              fullName: "Boshqa Odam",
              role: "CLIENT",
            },
            CONTEXT,
          ),
        ERROR_CODES.PHONE_ALREADY_REGISTERED,
      );
    });

    it("keeps the phone verification when registration fails on a taken email", async () => {
      const existing = await registerAccount();
      const suffix = uniqueSuffix();
      const phone = `+998${suffix}`;

      await auth.verifyPhoneOtp({ phone, code: VALID_CODE });

      await expectDomainError(
        () =>
          auth.register(
            {
              phone,
              email: existing.email,
              password: PASSWORD,
              fullName: "Test Foydalanuvchi",
              role: "CLIENT",
            },
            CONTEXT,
          ),
        ERROR_CODES.EMAIL_ALREADY_REGISTERED,
      );

      // The marker must survive: the caller did nothing wrong with their phone,
      // and making them pay for another SMS would be the real bug.
      const retry = await auth.register(
        {
          phone,
          email: `kidir.test.${uniqueSuffix()}@example.com`,
          password: PASSWORD,
          fullName: "Test Foydalanuvchi",
          role: "CLIENT",
        },
        CONTEXT,
      );
      createdUserIds.push(retry.user.id);

      expect(retry.user.phoneVerified).toBe(true);
    });
  });

  // --- login ---------------------------------------------------------------

  describe("login", () => {
    it("accepts the phone or the email as identifier", async () => {
      const account = await registerAccount();

      const byPhone = await auth.login({ identifier: account.phone, password: PASSWORD }, CONTEXT);
      const byEmail = await auth.login(
        { identifier: account.email.toUpperCase(), password: PASSWORD },
        CONTEXT,
      );

      expect(byPhone.user.id).toBe(account.userId);
      expect(byEmail.user.id).toBe(account.userId);
    });

    it("answers a wrong password and an unknown account identically", async () => {
      const account = await registerAccount();

      const wrongPassword = await expectDomainError(
        () => auth.login({ identifier: account.phone, password: "butunlay-boshqa-1" }, CONTEXT),
        ERROR_CODES.INVALID_CREDENTIALS,
      );

      const unknownUser = await expectDomainError(
        () => auth.login({ identifier: `+998${uniqueSuffix()}`, password: PASSWORD }, CONTEXT),
        ERROR_CODES.INVALID_CREDENTIALS,
      );

      // Same code and same message: anything else is a user-enumeration oracle.
      expect(unknownUser.message).toBe(wrongPassword.message);
      expect(unknownUser.getStatus()).toBe(wrongPassword.getStatus());
    });

    it("refuses a suspended account", async () => {
      const account = await registerAccount();
      await prisma.user.update({ where: { id: account.userId }, data: { status: "SUSPENDED" } });

      await expectDomainError(
        () => auth.login({ identifier: account.phone, password: PASSWORD }, CONTEXT),
        ERROR_CODES.ACCOUNT_SUSPENDED,
      );
    });

    it("refuses a banned account", async () => {
      const account = await registerAccount();
      await prisma.user.update({ where: { id: account.userId }, data: { status: "BANNED" } });

      await expectDomainError(
        () => auth.login({ identifier: account.phone, password: PASSWORD }, CONTEXT),
        ERROR_CODES.ACCOUNT_BANNED,
      );
    });

    it("refuses an account that has no password set", async () => {
      const account = await registerAccount();
      await prisma.user.update({ where: { id: account.userId }, data: { passwordHash: null } });

      await expectDomainError(
        () => auth.login({ identifier: account.phone, password: PASSWORD }, CONTEXT),
        ERROR_CODES.INVALID_CREDENTIALS,
      );
    });

    it("refuses a soft-deleted account", async () => {
      const account = await registerAccount();
      await prisma.user.update({ where: { id: account.userId }, data: { deletedAt: new Date() } });

      await expectDomainError(
        () => auth.login({ identifier: account.phone, password: PASSWORD }, CONTEXT),
        ERROR_CODES.INVALID_CREDENTIALS,
      );
    });
  });

  // --- refresh rotation ----------------------------------------------------

  describe("refresh rotation", () => {
    it("issues a new token and closes the old row against its replacement", async () => {
      const account = await registerAccount();
      const rotated = await auth.refresh(account.refreshToken, CONTEXT);

      expect(rotated.tokens.refreshToken).not.toBe(account.refreshToken);
      expect(rotated.user.id).toBe(account.userId);

      const rows = await prisma.refreshToken.findMany({
        where: { userId: account.userId },
        orderBy: { createdAt: "asc" },
      });

      expect(rows).toHaveLength(2);
      const [previous, current] = rows;

      expect(previous?.revokedAt).not.toBeNull();
      expect(previous?.replacedById).toBe(current?.id);
      expect(current?.revokedAt).toBeNull();
      // One login is one family, however many times it rotates.
      expect(current?.familyId).toBe(previous?.familyId);
    });

    it("stores only a digest, never the token itself", async () => {
      const account = await registerAccount();
      const row = await prisma.refreshToken.findFirstOrThrow({
        where: { userId: account.userId },
      });

      expect(row.tokenHash).not.toBe(account.refreshToken);
      expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("lets the freshly rotated token keep working", async () => {
      const account = await registerAccount();
      const first = await auth.refresh(account.refreshToken, CONTEXT);
      const second = await auth.refresh(first.tokens.refreshToken, CONTEXT);

      expect(second.user.id).toBe(account.userId);
    });

    it("revokes the whole family when a rotated token is replayed", async () => {
      const account = await registerAccount();
      const rotated = await auth.refresh(account.refreshToken, CONTEXT);

      await expectDomainError(
        () => auth.refresh(account.refreshToken, CONTEXT),
        ERROR_CODES.REFRESH_REUSE_DETECTED,
      );

      const rows = await prisma.refreshToken.findMany({ where: { userId: account.userId } });
      expect(rows).not.toHaveLength(0);
      expect(rows.every((row) => row.revokedAt !== null)).toBe(true);

      // The token the legitimate client is holding dies too: with a thief in
      // the family there is no way to tell which side is which.
      await expectDomainError(
        () => auth.refresh(rotated.tokens.refreshToken, CONTEXT),
        ERROR_CODES.REFRESH_REUSE_DETECTED,
      );
    });

    it("rejects a token whose database row has expired", async () => {
      const account = await registerAccount();
      await prisma.refreshToken.updateMany({
        where: { userId: account.userId },
        data: { expiresAt: new Date(Date.now() - 1_000) },
      });

      await expectDomainError(
        () => auth.refresh(account.refreshToken, CONTEXT),
        ERROR_CODES.SESSION_EXPIRED,
      );
    });

    it("rejects a forged token and a missing cookie the same way", async () => {
      await expectDomainError(
        () => auth.refresh("not-a-jwt", CONTEXT),
        ERROR_CODES.REFRESH_TOKEN_INVALID,
      );

      await expectDomainError(
        () => auth.refresh(undefined, CONTEXT),
        ERROR_CODES.REFRESH_TOKEN_INVALID,
      );
    });

    it("rejects a well-formed token that has no row", async () => {
      const account = await registerAccount();
      await prisma.refreshToken.deleteMany({ where: { userId: account.userId } });

      await expectDomainError(
        () => auth.refresh(account.refreshToken, CONTEXT),
        ERROR_CODES.REFRESH_TOKEN_INVALID,
      );
    });

    it("refuses to rotate for an account suspended mid-session", async () => {
      const account = await registerAccount();
      await prisma.user.update({ where: { id: account.userId }, data: { status: "SUSPENDED" } });

      await expectDomainError(
        () => auth.refresh(account.refreshToken, CONTEXT),
        ERROR_CODES.ACCOUNT_SUSPENDED,
      );
    });

    it("hands out exactly one live token when two rotations race", async () => {
      const account = await registerAccount();

      const results = await Promise.allSettled([
        auth.refresh(account.refreshToken, CONTEXT),
        auth.refresh(account.refreshToken, CONTEXT),
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);

      const live = await prisma.refreshToken.findMany({
        where: { userId: account.userId, revokedAt: null },
      });
      expect(live).toHaveLength(1);
    });
  });

  // --- logout --------------------------------------------------------------

  describe("logout", () => {
    it("ends every token in the family", async () => {
      const account = await registerAccount();
      await auth.logout(account.refreshToken);

      const rows = await prisma.refreshToken.findMany({ where: { userId: account.userId } });
      expect(rows.every((row) => row.revokedAt !== null)).toBe(true);

      await expectDomainError(
        () => auth.refresh(account.refreshToken, CONTEXT),
        ERROR_CODES.REFRESH_REUSE_DETECTED,
      );
    });

    it("accepts a missing cookie without complaining", async () => {
      await expect(auth.logout(undefined)).resolves.toBeUndefined();
    });

    it("ignores a token nobody issued", async () => {
      await expect(tokens.revokeSession("not-a-real-token")).resolves.toBeUndefined();
    });
  });

  // --- email verification and onboarding -----------------------------------

  describe("email verification", () => {
    it("marks the email verified and completes onboarding for a client", async () => {
      const account = await registerAccount("CLIENT");

      await auth.requestEmailOtp(account.userId, { email: account.email });
      await auth.verifyEmailOtp(account.userId, { email: account.email, code: VALID_CODE });

      const session = await auth.me(account.userId);
      expect(session.emailVerified).toBe(true);
      expect(session.onboardingComplete).toBe(true);
    });

    it("refuses an email that belongs to somebody else", async () => {
      const other = await registerAccount();
      const account = await registerAccount();

      await expectDomainError(
        () => auth.requestEmailOtp(account.userId, { email: other.email }),
        ERROR_CODES.EMAIL_ALREADY_REGISTERED,
      );
    });

    it("keeps a worker incomplete until specialization and skills are set", async () => {
      const account = await registerAccount("WORKER");
      await auth.requestEmailOtp(account.userId, { email: account.email });
      await auth.verifyEmailOtp(account.userId, { email: account.email, code: VALID_CODE });

      const beforeProfile = await auth.me(account.userId);
      expect(beforeProfile.onboardingComplete).toBe(false);

      const afterProfile = await users.updateProfile(account.userId, {
        specialization: "BACKEND",
        skills: [{ name: "NestJS", level: 80 }],
      });

      expect(afterProfile.onboardingComplete).toBe(true);
    });

    it("rejects a portfolio link outside the allowlist", async () => {
      const account = await registerAccount("WORKER");

      await expectDomainError(
        () =>
          users.updateProfile(account.userId, {
            portfolioLinks: ["https://example.com/portfolio"],
          }),
        ERROR_CODES.PORTFOLIO_LINK_NOT_ALLOWED,
      );
    });

    it("hides the phone and email from a public profile", async () => {
      const account = await registerAccount();
      const profile = await users.getPublicProfile(account.userId);

      expect(Object.keys(profile)).not.toContain("phone");
      expect(Object.keys(profile)).not.toContain("email");
    });
  });

  // --- phone attachment ----------------------------------------------------

  describe("attachPhone", () => {
    it("refuses to attach a phone that was not verified", async () => {
      const account = await registerAccount();

      await expectDomainError(
        () => auth.attachPhone(account.userId, { phone: `+998${uniqueSuffix()}` }),
        ERROR_CODES.OTP_NOT_VERIFIED,
      );
    });

    it("refuses a phone that belongs to somebody else", async () => {
      const other = await registerAccount();
      const account = await registerAccount();

      await expectDomainError(
        () => auth.attachPhone(account.userId, { phone: other.phone }),
        ERROR_CODES.PHONE_ALREADY_REGISTERED,
      );
    });
  });

  // --- Google ---------------------------------------------------------------

  describe("loginWithGoogle", () => {
    it("creates a client account that still has onboarding left", async () => {
      const suffix = uniqueSuffix();
      const session = await auth.loginWithGoogle(
        {
          googleId: `google-${suffix}`,
          email: `kidir.google.${suffix}@example.com`,
          fullName: "Google Mijoz",
        },
        CONTEXT,
      );
      createdUserIds.push(session.user.id);

      expect(session.user.role).toBe("CLIENT");
      expect(session.user.emailVerified).toBe(true);
      // No phone yet: SMS verification is mandatory for everyone.
      expect(session.user.phone).toBeNull();
      expect(session.user.onboardingComplete).toBe(false);
    });

    it("recognises the same google account on the second sign-in", async () => {
      const suffix = uniqueSuffix();
      const profile = {
        googleId: `google-${suffix}`,
        email: `kidir.google.${suffix}@example.com`,
        fullName: "Google Mijoz",
      };

      const first = await auth.loginWithGoogle(profile, CONTEXT);
      createdUserIds.push(first.user.id);
      const second = await auth.loginWithGoogle(profile, CONTEXT);

      expect(second.user.id).toBe(first.user.id);
    });

    it("links an existing client account by email and settles the email channel", async () => {
      const account = await registerAccount("CLIENT");

      const session = await auth.loginWithGoogle(
        { googleId: `google-${uniqueSuffix()}`, email: account.email, fullName: "Test" },
        CONTEXT,
      );

      expect(session.user.id).toBe(account.userId);
      expect(session.user.emailVerified).toBe(true);
    });

    it("refuses a worker account", async () => {
      const account = await registerAccount("WORKER");

      await expectDomainError(
        () =>
          auth.loginWithGoogle(
            { googleId: `google-${uniqueSuffix()}`, email: account.email, fullName: "Test" },
            CONTEXT,
          ),
        ERROR_CODES.OAUTH_ROLE_NOT_ALLOWED,
      );
    });

    it("refuses a suspended account", async () => {
      const account = await registerAccount("CLIENT");
      await prisma.user.update({ where: { id: account.userId }, data: { status: "SUSPENDED" } });

      await expectDomainError(
        () =>
          auth.loginWithGoogle(
            { googleId: `google-${uniqueSuffix()}`, email: account.email, fullName: "Test" },
            CONTEXT,
          ),
        ERROR_CODES.ACCOUNT_SUSPENDED,
      );
    });
  });
});
