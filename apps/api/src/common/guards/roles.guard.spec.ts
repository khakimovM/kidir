import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ERROR_CODES, type ErrorCode, type UserRole, type UserStatus } from "@kidir/shared";
import { DomainException } from "../exceptions/domain.exception";
import { Public } from "../decorators/public.decorator";
import { Roles } from "../decorators/roles.decorator";
import type { AuthenticatedUser } from "./authenticated-user";
import { RolesGuard } from "./roles.guard";

/**
 * The metadata is read through a real `Reflector` from really decorated
 * classes, so `@Roles()` and `@Public()` are under test here too — a fake
 * metadata bag would still pass if a decorator wrote the wrong key.
 */
class OpenController {
  @Public()
  anonymous(): void {}
}

class AnyRoleController {
  everybody(): void {}
}

class EmptyRolesController {
  @Roles()
  nobodyNamed(): void {}
}

class ModeratorController {
  @Roles("MODERATOR", "SUPERADMIN")
  staffOnly(): void {}
}

@Roles("SUPERADMIN")
class SuperadminController {
  inherited(): void {}
}

interface Handler {
  target: new () => object;
  method: string;
}

function contextFor(handler: Handler, user?: AuthenticatedUser): ExecutionContext {
  const method = (handler.target.prototype as Record<string, () => void>)[handler.method];

  return {
    getHandler: () => method,
    getClass: () => handler.target,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function account(role: UserRole, status: UserStatus = "ACTIVE"): AuthenticatedUser {
  return { id: "0193b7f0-0000-7000-8000-000000000001", role, status };
}

function expectRejected(run: () => boolean, code: ErrorCode, status: number): void {
  try {
    run();
  } catch (error) {
    if (!(error instanceof DomainException)) {
      throw error;
    }

    expect(error.code).toBe(code);
    expect(error.getStatus()).toBe(status);
    return;
  }

  throw new Error(`${code} kutilgan edi, lekin xato tashlanmadi`);
}

describe("RolesGuard", () => {
  const guard = new RolesGuard(new Reflector());

  const anonymousRoute: Handler = { target: OpenController, method: "anonymous" };
  const roleAgnosticRoute: Handler = { target: AnyRoleController, method: "everybody" };
  const emptyRolesRoute: Handler = { target: EmptyRolesController, method: "nobodyNamed" };
  const staffRoute: Handler = { target: ModeratorController, method: "staffOnly" };
  const inheritedRoute: Handler = { target: SuperadminController, method: "inherited" };

  it("skips a public route entirely, even with no user attached", () => {
    expect(guard.canActivate(contextFor(anonymousRoute))).toBe(true);
  });

  /**
   * Reaching a protected handler with no user means `JwtGuard` was left off.
   * Failing closed turns that mistake into a 401 instead of an open endpoint.
   */
  it("refuses a protected route that has no user on the request", () => {
    expectRejected(
      () => guard.canActivate(contextFor(roleAgnosticRoute)),
      ERROR_CODES.UNAUTHORIZED,
      401,
    );
  });

  describe("account state", () => {
    it("refuses a suspended account", () => {
      expectRejected(
        () => guard.canActivate(contextFor(roleAgnosticRoute, account("CLIENT", "SUSPENDED"))),
        ERROR_CODES.ACCOUNT_SUSPENDED,
        403,
      );
    });

    it("refuses a banned account", () => {
      expectRejected(
        () => guard.canActivate(contextFor(roleAgnosticRoute, account("CLIENT", "BANNED"))),
        ERROR_CODES.ACCOUNT_BANNED,
        403,
      );
    });

    /**
     * The whole reason both guards are paired on every controller: a handler
     * with no `@Roles(...)` must still be closed to a suspended account.
     */
    it("checks the account state even where no role is required", () => {
      expectRejected(
        () => guard.canActivate(contextFor(emptyRolesRoute, account("SUPERADMIN", "SUSPENDED"))),
        ERROR_CODES.ACCOUNT_SUSPENDED,
        403,
      );
    });

    it("lets an active account through", () => {
      expect(guard.canActivate(contextFor(roleAgnosticRoute, account("CLIENT")))).toBe(true);
    });
  });

  describe("role comparison", () => {
    it("allows any role when the handler names none", () => {
      for (const role of ["CLIENT", "WORKER", "PM", "MODERATOR", "SUPERADMIN"] as const) {
        expect(guard.canActivate(contextFor(roleAgnosticRoute, account(role)))).toBe(true);
      }
    });

    it("treats an empty @Roles() list as no restriction", () => {
      expect(guard.canActivate(contextFor(emptyRolesRoute, account("CLIENT")))).toBe(true);
    });

    it.each(["MODERATOR", "SUPERADMIN"] as const)("admits a listed role (%s)", (role) => {
      expect(guard.canActivate(contextFor(staffRoute, account(role)))).toBe(true);
    });

    it.each(["CLIENT", "WORKER", "PM"] as const)("refuses an unlisted role (%s)", (role) => {
      expectRejected(
        () => guard.canActivate(contextFor(staffRoute, account(role))),
        ERROR_CODES.FORBIDDEN,
        403,
      );
    });

    it("honours @Roles applied to the controller class", () => {
      expect(guard.canActivate(contextFor(inheritedRoute, account("SUPERADMIN")))).toBe(true);
      expectRejected(
        () => guard.canActivate(contextFor(inheritedRoute, account("MODERATOR"))),
        ERROR_CODES.FORBIDDEN,
        403,
      );
    });
  });
});
