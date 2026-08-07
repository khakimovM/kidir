import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ERROR_CODES } from "@kidir/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { env } from "../../config/env";
import { ACCESS_COOKIE } from "../../auth/auth.constants";
import { DomainException } from "../exceptions/domain.exception";
import { Public } from "../decorators/public.decorator";
import type { RequestWithUser } from "./authenticated-user";
import { JwtGuard } from "./jwt.guard";

/**
 * Prisma is not mocked (.claude/rules/testing.md): the point of this guard is
 * that the *database* decides what a caller currently is, so a fake repository
 * would remove the only thing worth asserting.
 */
class OpenController {
  @Public()
  anonymous(): void {}
}

class ProtectedController {
  guarded(): void {}
}

describe("JwtGuard", () => {
  let prisma: PrismaService;
  let jwt: JwtService;
  let guard: JwtGuard;

  const createdUserIds: string[] = [];
  let sequence = 0;

  beforeAll(() => {
    prisma = new PrismaService();
    jwt = new JwtService({});
    guard = new JwtGuard(new Reflector(), jwt, prisma);
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }

    await prisma.$disconnect();
  });

  // --- helpers -------------------------------------------------------------

  function contextFor(cookies: Record<string, string>, isPublic = false): ExecutionContext {
    const request: Partial<RequestWithUser> = { cookies } as Partial<RequestWithUser>;
    const target = isPublic ? OpenController : ProtectedController;
    const handler = isPublic
      ? OpenController.prototype.anonymous
      : ProtectedController.prototype.guarded;

    return {
      getHandler: () => handler,
      getClass: () => target,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  /** The request object the guard writes onto, so the test can read it back. */
  function requestOf(context: ExecutionContext): RequestWithUser {
    return context.switchToHttp().getRequest<RequestWithUser>();
  }

  async function createUser(
    overrides: { status?: "ACTIVE" | "SUSPENDED" | "BANNED"; deletedAt?: Date } = {},
  ): Promise<string> {
    sequence += 1;
    const suffix = `${Date.now()}${sequence}`.slice(-9).padStart(9, "0");

    const user = await prisma.user.create({
      data: {
        phone: `+998${suffix}`,
        email: `kidir.guard.${suffix}@example.com`,
        fullName: "Guard Test",
        role: "WORKER",
        status: overrides.status ?? "ACTIVE",
        deletedAt: overrides.deletedAt ?? null,
      },
      select: { id: true },
    });

    createdUserIds.push(user.id);
    return user.id;
  }

  function signAccessToken(
    payload: Record<string, unknown>,
    secret = env.JWT_ACCESS_SECRET,
  ): string {
    return jwt.sign(payload, { secret, expiresIn: 900 });
  }

  async function expectUnauthorized(context: ExecutionContext): Promise<void> {
    try {
      await guard.canActivate(context);
    } catch (error) {
      if (!(error instanceof DomainException)) {
        throw error;
      }

      expect(error.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(error.getStatus()).toBe(401);
      return;
    }

    throw new Error("UNAUTHORIZED kutilgan edi, lekin xato tashlanmadi");
  }

  // --- tests ---------------------------------------------------------------

  it("lets a @Public() route through without looking at cookies", async () => {
    await expect(guard.canActivate(contextFor({}, true))).resolves.toBe(true);
  });

  it("rejects a request with no access cookie", async () => {
    await expectUnauthorized(contextFor({}));
  });

  it("rejects an empty access cookie", async () => {
    await expectUnauthorized(contextFor({ [ACCESS_COOKIE]: "" }));
  });

  it("rejects a request whose cookie bag is missing entirely", async () => {
    const context = {
      getHandler: () => ProtectedController.prototype.guarded,
      getClass: () => ProtectedController,
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;

    await expectUnauthorized(context);
  });

  it("rejects a token that is not a jwt at all", async () => {
    await expectUnauthorized(contextFor({ [ACCESS_COOKIE]: "not-a-jwt" }));
  });

  /**
   * The refresh secret must not open an access-protected route. Signing every
   * token kind with its own secret is what keeps the two apart, so this is the
   * assertion that would catch someone "simplifying" to a single secret.
   */
  it("rejects a token signed with the refresh secret", async () => {
    const userId = await createUser();
    const foreign = signAccessToken({ sub: userId }, env.JWT_REFRESH_SECRET);

    await expectUnauthorized(contextFor({ [ACCESS_COOKIE]: foreign }));
  });

  it("rejects an expired token", async () => {
    const userId = await createUser();
    const expired = jwt.sign({ sub: userId }, { secret: env.JWT_ACCESS_SECRET, expiresIn: -10 });

    await expectUnauthorized(contextFor({ [ACCESS_COOKIE]: expired }));
  });

  it("rejects a well-signed token that carries no subject", async () => {
    await expectUnauthorized(contextFor({ [ACCESS_COOKIE]: signAccessToken({ role: "CLIENT" }) }));
  });

  it("rejects a subject that is not a string", async () => {
    await expectUnauthorized(contextFor({ [ACCESS_COOKIE]: signAccessToken({ sub: 42 }) }));
  });

  it("rejects an empty subject", async () => {
    await expectUnauthorized(contextFor({ [ACCESS_COOKIE]: signAccessToken({ sub: "" }) }));
  });

  it("rejects a token for a user that no longer exists", async () => {
    const token = signAccessToken({ sub: "0193b7f0-0000-7000-8000-0000000000ff" });

    await expectUnauthorized(contextFor({ [ACCESS_COOKIE]: token }));
  });

  /** A soft-deleted account is indistinguishable from a missing one. */
  it("rejects a token for a soft-deleted user", async () => {
    const userId = await createUser({ deletedAt: new Date() });

    await expectUnauthorized(contextFor({ [ACCESS_COOKIE]: signAccessToken({ sub: userId }) }));
  });

  it("attaches id, role and status read from the database", async () => {
    const userId = await createUser();
    const context = contextFor({ [ACCESS_COOKIE]: signAccessToken({ sub: userId }) });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(requestOf(context).user).toEqual({ id: userId, role: "WORKER", status: "ACTIVE" });
  });

  /**
   * The token says nothing about status, so a moderator's suspension has to be
   * visible on the very next request. `RolesGuard` is what turns this into a
   * refusal — the guard's job is only to report the current truth.
   */
  it("reports the current status rather than the one the token was minted with", async () => {
    const userId = await createUser();
    const token = signAccessToken({ sub: userId });

    await prisma.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } });

    const context = contextFor({ [ACCESS_COOKIE]: token });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(requestOf(context).user?.status).toBe("SUSPENDED");
  });

  /**
   * A role claim travels inside the access token, but the guard must not trust
   * it: the database is the authority.
   */
  it("ignores a role claim baked into the token", async () => {
    const userId = await createUser();
    const context = contextFor({
      [ACCESS_COOKIE]: signAccessToken({ sub: userId, role: "SUPERADMIN" }),
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(requestOf(context).user?.role).toBe("WORKER");
  });
});
