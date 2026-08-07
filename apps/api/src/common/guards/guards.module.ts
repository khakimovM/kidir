import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { JwtGuard } from "./jwt.guard";
import { RolesGuard } from "./roles.guard";

/**
 * Authenticates and authorises every route in the application.
 *
 * Both guards are registered as APP_GUARD, so a route is protected unless it
 * opts out with `@Public()`. Registering them per controller made the default
 * the other way round: a new controller that forgot `@UseGuards` was silently
 * open, and nothing failed to warn about it. With money, deals and disputes
 * arriving in later phases, one forgotten decorator is too cheap a mistake.
 *
 * Order matters and is the array order below: `JwtGuard` must populate
 * `request.user` before `RolesGuard` reads it. `useExisting` rather than
 * `useClass` so the globally applied guard is the same instance this module
 * already provides, instead of a second copy.
 *
 * JwtModule is registered without a secret on purpose: every sign and verify
 * call passes its own, so an access token can never be validated with the
 * refresh secret or the other way round. It stays exported because the guards
 * remain individually injectable for tests.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [
    JwtGuard,
    RolesGuard,
    { provide: APP_GUARD, useExisting: JwtGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
  ],
  exports: [JwtGuard, RolesGuard, JwtModule],
})
export class GuardsModule {}
