import type { ExecutionContext } from "@nestjs/common";
import type { IncomingHttpHeaders } from "node:http";
import { ERROR_CODES } from "@kidir/shared";
import { DomainException } from "../exceptions/domain.exception";
import { CsrfGuard } from "./csrf.guard";

/**
 * The guard reads nothing but the method and one header, so the whole contract
 * is reachable without a server. The end-to-end proof that it is actually wired
 * in front of every mutation lives in `test/auth.e2e-spec.ts`.
 */
function httpContext(method: string, headers: IncomingHttpHeaders = {}): ExecutionContext {
  return {
    getType: () => "http",
    switchToHttp: () => ({ getRequest: () => ({ method, headers }) }),
  } as unknown as ExecutionContext;
}

function expectRejected(run: () => boolean): DomainException {
  try {
    run();
  } catch (error) {
    if (error instanceof DomainException) {
      expect(error.code).toBe(ERROR_CODES.CSRF_HEADER_MISSING);
      expect(error.getStatus()).toBe(403);
      return error;
    }

    throw error;
  }

  throw new Error("DomainException kutilgan edi, lekin xato tashlanmadi");
}

describe("CsrfGuard", () => {
  const guard = new CsrfGuard();

  describe("safe methods", () => {
    it.each(["GET", "HEAD", "OPTIONS"])("lets %s through without the header", (method) => {
      expect(guard.canActivate(httpContext(method))).toBe(true);
    });

    it("recognises a lowercase method name", () => {
      expect(guard.canActivate(httpContext("get"))).toBe(true);
    });
  });

  describe("mutations", () => {
    it.each(["POST", "PUT", "PATCH", "DELETE"])("accepts %s carrying the header", (method) => {
      const context = httpContext(method, { "x-requested-with": "XMLHttpRequest" });
      expect(guard.canActivate(context)).toBe(true);
    });

    it.each(["POST", "PUT", "PATCH", "DELETE"])("refuses %s without the header", (method) => {
      expectRejected(() => guard.canActivate(httpContext(method)));
    });

    it("refuses a header whose value is only whitespace", () => {
      expectRejected(() => guard.canActivate(httpContext("POST", { "x-requested-with": "   " })));
    });

    it("refuses a header sent with an empty value", () => {
      expectRejected(() => guard.canActivate(httpContext("POST", { "x-requested-with": "" })));
    });

    /**
     * A repeated header arrives as an array. Taking the first entry is what
     * stops `X-Requested-With: <empty>` followed by a second copy from being
     * read as one satisfied check.
     */
    it("reads the first value when the header is repeated", () => {
      const accepted = httpContext("POST", { "x-requested-with": ["fetch", ""] });
      expect(guard.canActivate(accepted)).toBe(true);

      expectRejected(() => guard.canActivate(httpContext("POST", { "x-requested-with": [""] })));
    });

    /** Presence is the proof, not the value: the browser cannot forge either. */
    it("does not care what the value says", () => {
      expect(guard.canActivate(httpContext("POST", { "x-requested-with": "kidir" }))).toBe(true);
    });
  });

  /**
   * Socket.IO frames carry no HTTP method, so the check does not apply — the
   * connection was already authenticated during the handshake.
   */
  it("ignores non-http contexts", () => {
    const wsContext = { getType: () => "ws" } as unknown as ExecutionContext;
    expect(guard.canActivate(wsContext)).toBe(true);
  });
});
