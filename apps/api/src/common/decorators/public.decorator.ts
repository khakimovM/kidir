import { SetMetadata, type CustomDecorator } from "@nestjs/common";

export const IS_PUBLIC_KEY = "kidir:isPublic";

/**
 * Opts a handler out of `JwtGuard`. Guards stay applied at the controller
 * level so the default is "authenticated" — a route is only reachable
 * anonymously when it says so out loud.
 *
 * Note this does not opt out of `CsrfGuard`: an unauthenticated mutation
 * (login, register, refresh) still sets cookies, so it still needs the header.
 */
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC_KEY, true);
