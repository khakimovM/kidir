import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ERROR_CODES } from "@kidir/shared";
import { DomainException } from "../exceptions/domain.exception";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { env } from "../../config/env";
import { ACCESS_COOKIE } from "../../auth/auth.constants";
import { readCookie } from "../../auth/auth.cookies";
import type { RequestWithUser } from "./authenticated-user";

/**
 * Authenticates a request from the access-token cookie.
 *
 * The token is read from the cookie only — never from an Authorization header.
 * Accepting both would re-open the XSS exposure the cookie design exists to
 * close, since a header token has to be reachable by JavaScript to be sent.
 *
 * The account is re-read from the database on every request: the JWT proves
 * *who* the caller is, the database decides what they currently are. A deleted
 * account stops working immediately instead of at token expiry.
 */
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (isPublicRoute(this.reflector, context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = readCookie(request, ACCESS_COOKIE);

    if (token === undefined) {
      throw unauthorized("Avtorizatsiya talab qilinadi");
    }

    const userId = await this.verify(token);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, role: true, status: true },
    });

    if (user === null) {
      throw unauthorized("Foydalanuvchi topilmadi");
    }

    request.user = user;
    return true;
  }

  private async verify(token: string): Promise<string> {
    let payload: Record<string, unknown>;

    try {
      payload = await this.jwt.verifyAsync<Record<string, unknown>>(token, {
        secret: env.JWT_ACCESS_SECRET,
      });
    } catch {
      // Expired and forged tokens are answered identically: the client's only
      // correct reaction to either is to call /auth/refresh.
      throw unauthorized("Sessiya yaroqsiz yoki muddati tugagan");
    }

    const subject = payload.sub;
    if (typeof subject !== "string" || subject.length === 0) {
      throw unauthorized("Sessiya yaroqsiz yoki muddati tugagan");
    }

    return subject;
  }
}

export function isPublicRoute(reflector: Reflector, context: ExecutionContext): boolean {
  return (
    reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) === true
  );
}

function unauthorized(message: string): DomainException {
  return DomainException.unauthorized(ERROR_CODES.UNAUTHORIZED, message);
}
