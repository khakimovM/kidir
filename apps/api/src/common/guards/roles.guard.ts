import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ERROR_CODES, type UserRole } from "@kidir/shared";
import { DomainException } from "../exceptions/domain.exception";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { isPublicRoute } from "./jwt.guard";
import type { RequestWithUser } from "./authenticated-user";

/**
 * Runs after `JwtGuard` and answers two separate questions: is this account
 * still allowed to act at all, and does it hold one of the roles this handler
 * requires.
 *
 * The account-state check runs even on handlers with no `@Roles(...)`, which
 * is the point of pairing the two guards everywhere: a suspended user must not
 * be able to keep using the endpoints that happen to be role-agnostic.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (isPublicRoute(this.reflector, context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (user === undefined) {
      // JwtGuard is missing from this handler. Fail closed rather than
      // treating "nobody" as "allowed".
      throw DomainException.unauthorized(ERROR_CODES.UNAUTHORIZED, "Avtorizatsiya talab qilinadi");
    }

    if (user.status === "SUSPENDED") {
      throw new DomainException(
        ERROR_CODES.ACCOUNT_SUSPENDED,
        "Hisobingiz vaqtincha to'xtatilgan",
        HttpStatus.FORBIDDEN,
      );
    }

    if (user.status === "BANNED") {
      throw new DomainException(
        ERROR_CODES.ACCOUNT_BANNED,
        "Hisobingiz bloklangan",
        HttpStatus.FORBIDDEN,
      );
    }

    const required = this.reflector.getAllAndOverride<readonly UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (required === undefined || required.length === 0) {
      return true;
    }

    if (!required.includes(user.role)) {
      throw DomainException.forbidden("Bu amal uchun ruxsatingiz yo'q");
    }

    return true;
  }
}
