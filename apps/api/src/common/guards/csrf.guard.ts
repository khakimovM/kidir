import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { ERROR_CODES } from "@kidir/shared";
import { DomainException } from "../exceptions/domain.exception";

const CSRF_HEADER = "x-requested-with";

/** Safe methods do not change state, so they need no CSRF proof. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Global CSRF defence, the second half of the SameSite=Lax design
 * (docs/PLAN.md 7.3).
 *
 * A cross-site form post carries cookies but cannot set a custom header: doing
 * so forces a CORS preflight, and the API's allow-list only names the web and
 * admin origins. So the presence of `X-Requested-With` on a mutation is proof
 * the request came from our own front-end code, not from an attacker's page.
 *
 * The value is not inspected — it is presence, not content, that carries the
 * guarantee. Registered as APP_GUARD so a new controller is covered by
 * default; there is no opt-out decorator, because a mutation that wants one is
 * almost always a mistake.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    const header = request.headers[CSRF_HEADER];
    const value = Array.isArray(header) ? header[0] : header;

    if (typeof value !== "string" || value.trim().length === 0) {
      throw new DomainException(
        ERROR_CODES.CSRF_HEADER_MISSING,
        "X-Requested-With sarlavhasi majburiy",
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
