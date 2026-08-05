import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { DomainException } from "../exceptions/domain.exception";
import { ERROR_CODES } from "@kidir/shared";
import type { AuthenticatedUser, RequestWithUser } from "../guards/authenticated-user";

/**
 * The caller identified by `JwtGuard`. Never trust a user id coming from the
 * body or the path — this is the only source.
 *
 * It throws rather than returning undefined: reaching a handler without a user
 * means the guard was forgotten, and silently continuing with `undefined`
 * would turn that mistake into an authorization hole.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (user === undefined) {
      throw DomainException.unauthorized(ERROR_CODES.UNAUTHORIZED, "Avtorizatsiya talab qilinadi");
    }

    return user;
  },
);
