import type { ExecutionContext } from "@nestjs/common";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { ERROR_CODES } from "@kidir/shared";
import { DomainException } from "../exceptions/domain.exception";
import type { AuthenticatedUser, RequestWithUser } from "../guards/authenticated-user";
import { CurrentUser } from "./current-user.decorator";

type ParamFactory = (data: unknown, context: ExecutionContext) => AuthenticatedUser;

/**
 * `createParamDecorator` hides the factory inside route metadata, so the only
 * way to exercise it directly is to apply the decorator to a throwaway handler
 * and read it back out — the same shape Nest itself uses at request time.
 */
function factoryOf(): ParamFactory {
  class Probe {
    handler(@CurrentUser() _user: AuthenticatedUser): void {}
  }

  const metadata: unknown = Reflect.getMetadata(ROUTE_ARGS_METADATA, Probe, "handler");

  if (typeof metadata !== "object" || metadata === null) {
    throw new Error("route argument metadata topilmadi");
  }

  const entry = Object.values(metadata)[0];

  if (
    typeof entry !== "object" ||
    entry === null ||
    !("factory" in entry) ||
    typeof entry.factory !== "function"
  ) {
    throw new Error("param decorator factory topilmadi");
  }

  return entry.factory as ParamFactory;
}

function contextWith(user?: AuthenticatedUser): ExecutionContext {
  const request: Partial<RequestWithUser> = { user };

  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("@CurrentUser()", () => {
  const factory = factoryOf();

  const signedIn: AuthenticatedUser = {
    id: "0193b7f0-0000-7000-8000-000000000001",
    role: "PM",
    status: "ACTIVE",
  };

  it("hands the handler the user JwtGuard attached", () => {
    expect(factory(undefined, contextWith(signedIn))).toEqual(signedIn);
  });

  /**
   * Reaching a handler with no user means `JwtGuard` was forgotten. Returning
   * `undefined` would turn that mistake into an authorization hole further
   * down, where the id is used to decide what the caller may touch.
   */
  it("throws instead of returning undefined when no guard ran", () => {
    try {
      factory(undefined, contextWith());
    } catch (error) {
      if (!(error instanceof DomainException)) {
        throw error;
      }

      expect(error.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(error.getStatus()).toBe(401);
      return;
    }

    throw new Error("UNAUTHORIZED kutilgan edi, lekin xato tashlanmadi");
  });

  it("ignores the decorator argument, so @CurrentUser('id') cannot narrow it", () => {
    expect(factory("id", contextWith(signedIn))).toEqual(signedIn);
  });
});
