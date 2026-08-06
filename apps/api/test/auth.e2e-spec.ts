import { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { ThrottlerStorage } from "@nestjs/throttler";
import cookieParser from "cookie-parser";
import request from "supertest";
import { ERROR_CODES } from "@kidir/shared";
import { AppModule } from "../src/app.module";
import { ACCESS_COOKIE, AUTH_RATE_LIMIT_PER_MIN, REFRESH_COOKIE } from "../src/auth/auth.constants";
import { OtpService, type OtpChannel, type OtpIssueResult } from "../src/otp/otp.contract";
import { PrismaService } from "../src/prisma/prisma.service";

// argon2 at the configured cost, over HTTP, against a real database: the
// default 5s budget is not enough for the registration-heavy cases.
jest.setTimeout(120_000);

const VALID_CODE = "123456";
const PASSWORD = "kidir-parol-2026";

/**
 * The one collaborator that is faked. Everything the requirements are about —
 * cookie flags, the CSRF guard, the auth guards, the throttler and the error
 * envelope — is exercised through the real HTTP stack; delivering an SMS is
 * not, and reading a code back out of a log line would be the flakiest part of
 * the suite. Redis and Postgres stay real (.claude/rules/testing.md).
 */
class AlwaysValidOtpService extends OtpService {
  private readonly verified = new Set<string>();

  issue(): Promise<OtpIssueResult> {
    return Promise.resolve({ retryAfterSeconds: 60, expiresInSeconds: 120 });
  }

  verify(channel: OtpChannel, target: string, code: string): Promise<void> {
    if (code === VALID_CODE) {
      this.verified.add(`${channel}:${target}`);
    }

    return Promise.resolve();
  }

  consumeVerification(channel: OtpChannel, target: string): Promise<boolean> {
    return Promise.resolve(this.verified.delete(`${channel}:${target}`));
  }
}

interface ErrorEnvelope {
  error?: { code?: unknown; message?: unknown };
}

/**
 * Every error leaving the API must look like this — the web and admin apps
 * switch on `error.code` (.claude/rules/api-design.md), so a handler that
 * answers in a different shape is a contract break, not a cosmetic one.
 */
function expectErrorEnvelope(body: unknown, code: string): void {
  const envelope = body as ErrorEnvelope;

  expect(Object.keys(envelope as object)).toEqual(["error"]);
  expect(envelope.error?.code).toBe(code);
  expect(typeof envelope.error?.message).toBe("string");
  expect(String(envelope.error?.message).length).toBeGreaterThan(0);
}

function setCookieList(response: request.Response): string[] {
  const raw: unknown = response.headers["set-cookie"];

  if (Array.isArray(raw)) {
    return raw.map((entry) => String(entry));
  }

  return typeof raw === "string" ? [raw] : [];
}

function findSetCookie(response: request.Response, name: string): string {
  const found = setCookieList(response).find((entry) => entry.startsWith(`${name}=`));

  if (found === undefined) {
    throw new Error(`javobda "${name}" cookie'si yo'q`);
  }

  return found;
}

/** `name=value`, i.e. the part a browser would send back. */
function cookiePair(setCookieHeader: string): string {
  return setCookieHeader.split(";")[0] ?? "";
}

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  const createdUserIds: string[] = [];
  let sequence = 0;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OtpService)
      .useClass(AlwaysValidOtpService)
      .compile();

    app = moduleRef.createNestApplication();
    // main.ts installs this before any guard runs; without it every cookie is
    // invisible to JwtGuard and the whole suite would 401.
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }

    await app.close();
  });

  /**
   * The throttler keeps an in-memory counter per handler and IP, and every
   * request in this file arrives from the same address. Without this reset the
   * auth endpoints would run out of budget partway through the file and tests
   * would start failing in whatever order they happened to run.
   */
  beforeEach(() => {
    const storage: unknown = app.get(ThrottlerStorage);

    if (
      typeof storage === "object" &&
      storage !== null &&
      "storage" in storage &&
      storage.storage instanceof Map
    ) {
      storage.storage.clear();
    }
  });

  // --- helpers -------------------------------------------------------------

  function server(): ReturnType<INestApplication["getHttpServer"]> {
    return app.getHttpServer();
  }

  /** Unique per run so a rerun never collides with leftover rows. */
  function uniqueSuffix(): string {
    sequence += 1;
    return `${Date.now()}${sequence}`.slice(-9).padStart(9, "0");
  }

  interface TestAccount {
    userId: string;
    phone: string;
    email: string;
    accessCookie: string;
    refreshCookie: string;
  }

  async function registerAccount(): Promise<TestAccount> {
    const suffix = uniqueSuffix();
    const phone = `+998${suffix}`;
    const email = `kidir.e2e.${suffix}@example.com`;

    await request(server())
      .post("/auth/otp/phone/verify")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ phone, code: VALID_CODE })
      .expect(204);

    const response = await request(server())
      .post("/auth/register")
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ phone, email, password: PASSWORD, fullName: "E2E Foydalanuvchi", role: "CLIENT" })
      .expect(201);

    const userId = String((response.body as { user: { id: string } }).user.id);
    createdUserIds.push(userId);

    return {
      userId,
      phone,
      email,
      accessCookie: cookiePair(findSetCookie(response, ACCESS_COOKIE)),
      refreshCookie: cookiePair(findSetCookie(response, REFRESH_COOKIE)),
    };
  }

  // --- cookies -------------------------------------------------------------

  describe("POST /auth/login", () => {
    it("delivers the session in httpOnly SameSite=Lax cookies", async () => {
      const account = await registerAccount();

      const response = await request(server())
        .post("/auth/login")
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ identifier: account.phone, password: PASSWORD })
        .expect(200);

      const access = findSetCookie(response, ACCESS_COOKIE);
      const refresh = findSetCookie(response, REFRESH_COOKIE);

      for (const cookie of [access, refresh]) {
        expect(cookie).toContain("HttpOnly");
        expect(cookie).toContain("SameSite=Lax");
      }

      // The refresh cookie is scoped to /auth so a 30-day credential does not
      // ride along with every request in the app.
      expect(refresh).toContain("Path=/auth");
      expect(access).toContain("Path=/");
    });

    it("keeps both tokens out of the response body", async () => {
      const account = await registerAccount();

      const response = await request(server())
        .post("/auth/login")
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ identifier: account.phone, password: PASSWORD })
        .expect(200);

      expect(Object.keys(response.body as object)).toEqual(["user"]);

      // A JWT is three base64url segments and always starts "eyJ"; searching the
      // serialised body catches one hidden at any depth or under any key.
      const serialised = JSON.stringify(response.body);
      expect(serialised).not.toContain("eyJ");
      expect(serialised).not.toContain("accessToken");
      expect(serialised).not.toContain("refreshToken");
      expect(serialised).not.toContain("passwordHash");
    });

    it("answers a wrong password with the same code as an unknown account", async () => {
      const account = await registerAccount();

      const wrongPassword = await request(server())
        .post("/auth/login")
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ identifier: account.phone, password: "butunlay-boshqa-1" })
        .expect(401);

      const unknownAccount = await request(server())
        .post("/auth/login")
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ identifier: `+998${uniqueSuffix()}`, password: PASSWORD })
        .expect(401);

      expectErrorEnvelope(wrongPassword.body, ERROR_CODES.INVALID_CREDENTIALS);
      expectErrorEnvelope(unknownAccount.body, ERROR_CODES.INVALID_CREDENTIALS);
      expect(unknownAccount.body).toEqual(wrongPassword.body);
      expect(setCookieList(unknownAccount)).toHaveLength(0);
    });
  });

  // --- CSRF ----------------------------------------------------------------

  describe("CSRF header", () => {
    it("refuses a mutation that arrives without X-Requested-With", async () => {
      const response = await request(server())
        .post("/auth/login")
        .send({ identifier: "+998901234567", password: PASSWORD })
        .expect(403);

      expectErrorEnvelope(response.body, ERROR_CODES.CSRF_HEADER_MISSING);
    });

    it("refuses an authenticated mutation without the header as well", async () => {
      const account = await registerAccount();

      const response = await request(server())
        .patch("/users/me")
        .set("Cookie", account.accessCookie)
        .send({ bio: "salom" })
        .expect(403);

      expectErrorEnvelope(response.body, ERROR_CODES.CSRF_HEADER_MISSING);
    });

    it("refuses an empty header value, so the check cannot be satisfied trivially", async () => {
      const response = await request(server())
        .post("/auth/login")
        .set("X-Requested-With", "   ")
        .send({ identifier: "+998901234567", password: PASSWORD })
        .expect(403);

      expectErrorEnvelope(response.body, ERROR_CODES.CSRF_HEADER_MISSING);
    });

    it("lets a safe method through without the header", async () => {
      const account = await registerAccount();

      await request(server()).get("/auth/me").set("Cookie", account.accessCookie).expect(200);
    });
  });

  // --- authentication ------------------------------------------------------

  describe("protected endpoints", () => {
    it("rejects a request that carries no cookie", async () => {
      const response = await request(server()).get("/auth/me").expect(401);

      expectErrorEnvelope(response.body, ERROR_CODES.UNAUTHORIZED);
    });

    it("rejects a forged access cookie", async () => {
      const response = await request(server())
        .get("/auth/me")
        .set("Cookie", `${ACCESS_COOKIE}=not-a-jwt`)
        .expect(401);

      expectErrorEnvelope(response.body, ERROR_CODES.UNAUTHORIZED);
    });

    it("rejects the refresh cookie used as an access cookie", async () => {
      const account = await registerAccount();
      const refreshValue = account.refreshCookie.split("=").slice(1).join("=");

      const response = await request(server())
        .get("/auth/me")
        .set("Cookie", `${ACCESS_COOKIE}=${refreshValue}`)
        .expect(401);

      expectErrorEnvelope(response.body, ERROR_CODES.UNAUTHORIZED);
    });

    it("accepts the access cookie the login handed out", async () => {
      const account = await registerAccount();

      const response = await request(server())
        .get("/auth/me")
        .set("Cookie", account.accessCookie)
        .expect(200);

      expect((response.body as { id: string }).id).toBe(account.userId);
    });

    it("stops serving a suspended account mid-session", async () => {
      const account = await registerAccount();
      await prisma.user.update({ where: { id: account.userId }, data: { status: "SUSPENDED" } });

      const response = await request(server())
        .get("/auth/me")
        .set("Cookie", account.accessCookie)
        .expect(403);

      expectErrorEnvelope(response.body, ERROR_CODES.ACCOUNT_SUSPENDED);
    });
  });

  // --- rate limiting -------------------------------------------------------

  describe("rate limiting", () => {
    it("answers RATE_LIMITED once the per-minute login budget is spent", async () => {
      const account = await registerAccount();
      const attempt = (): request.Test =>
        request(server())
          .post("/auth/login")
          .set("X-Requested-With", "XMLHttpRequest")
          .send({ identifier: account.phone, password: PASSWORD });

      const statuses: number[] = [];
      for (let index = 0; index < AUTH_RATE_LIMIT_PER_MIN + 1; index += 1) {
        statuses.push((await attempt()).status);
      }

      expect(statuses.slice(0, AUTH_RATE_LIMIT_PER_MIN)).toEqual(
        new Array<number>(AUTH_RATE_LIMIT_PER_MIN).fill(200),
      );

      const blocked = await attempt();
      expect(statuses[AUTH_RATE_LIMIT_PER_MIN]).toBe(429);
      expect(blocked.status).toBe(429);
      expectErrorEnvelope(blocked.body, ERROR_CODES.RATE_LIMITED);
    });
  });

  // --- public profile ------------------------------------------------------

  describe("GET /users/:id", () => {
    it("never exposes the phone, the email or the password hash", async () => {
      const viewer = await registerAccount();
      const subject = await registerAccount();

      const response = await request(server())
        .get(`/users/${subject.userId}`)
        .set("Cookie", viewer.accessCookie)
        .expect(200);

      const keys = Object.keys(response.body as object);
      expect(keys).not.toContain("phone");
      expect(keys).not.toContain("email");
      expect(keys).not.toContain("passwordHash");
      expect(keys).not.toContain("googleId");
      expect(keys).not.toContain("status");

      const serialised = JSON.stringify(response.body);
      expect(serialised).not.toContain(subject.phone);
      expect(serialised).not.toContain(subject.email);
      expect(serialised).not.toContain("$argon2");
    });

    it("requires a session, so the worker base cannot be scraped anonymously", async () => {
      const subject = await registerAccount();

      const response = await request(server()).get(`/users/${subject.userId}`).expect(401);

      expectErrorEnvelope(response.body, ERROR_CODES.UNAUTHORIZED);
    });
  });

  // --- error envelope ------------------------------------------------------

  describe("error responses", () => {
    it("wraps a validation failure in the standard envelope", async () => {
      const response = await request(server())
        .post("/auth/login")
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ identifier: "", password: "" })
        .expect(400);

      expectErrorEnvelope(response.body, ERROR_CODES.VALIDATION_ERROR);
    });

    it("wraps a not-found in the standard envelope", async () => {
      const viewer = await registerAccount();

      const response = await request(server())
        .get("/users/0193b7f0-0000-7000-8000-000000000000")
        .set("Cookie", viewer.accessCookie)
        .expect(404);

      expectErrorEnvelope(response.body, ERROR_CODES.NOT_FOUND);
    });

    it("wraps a conflict in the standard envelope", async () => {
      const existing = await registerAccount();
      const phone = `+998${uniqueSuffix()}`;

      await request(server())
        .post("/auth/otp/phone/verify")
        .set("X-Requested-With", "XMLHttpRequest")
        .send({ phone, code: VALID_CODE })
        .expect(204);

      const response = await request(server())
        .post("/auth/register")
        .set("X-Requested-With", "XMLHttpRequest")
        .send({
          phone,
          email: existing.email,
          password: PASSWORD,
          fullName: "Boshqa Odam",
          role: "CLIENT",
        })
        .expect(409);

      expectErrorEnvelope(response.body, ERROR_CODES.EMAIL_ALREADY_REGISTERED);
    });

    it("never leaks an internal message through a malformed path parameter", async () => {
      const viewer = await registerAccount();

      const response = await request(server())
        .get("/users/not-a-uuid")
        .set("Cookie", viewer.accessCookie)
        .expect(400);

      expectErrorEnvelope(response.body, ERROR_CODES.VALIDATION_ERROR);
    });
  });

  // --- session lifecycle over HTTP -----------------------------------------

  describe("POST /auth/logout", () => {
    it("clears both cookies and ends the family", async () => {
      const account = await registerAccount();

      const response = await request(server())
        .post("/auth/logout")
        .set("X-Requested-With", "XMLHttpRequest")
        .set("Cookie", [account.accessCookie, account.refreshCookie])
        .expect(204);

      // Clearing is an expiry in the past, and it has to name the same path the
      // cookie was set with or the browser keeps the live credential.
      const cleared = setCookieList(response);
      expect(cleared).toHaveLength(2);
      expect(cleared.every((cookie) => cookie.includes("Expires=Thu, 01 Jan 1970"))).toBe(true);

      const refreshed = await request(server())
        .post("/auth/refresh")
        .set("X-Requested-With", "XMLHttpRequest")
        .set("Cookie", account.refreshCookie)
        .expect(401);

      expectErrorEnvelope(refreshed.body, ERROR_CODES.REFRESH_REUSE_DETECTED);
    });
  });
});
