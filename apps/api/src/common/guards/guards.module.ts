import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtGuard } from "./jwt.guard";
import { RolesGuard } from "./roles.guard";

/**
 * Makes `JwtGuard` and `RolesGuard` resolvable from any module.
 *
 * `@UseGuards(JwtGuard)` resolves the instance from the injector of the module
 * that declares the controller, so without a global provider every feature
 * module would have to re-import JwtModule just to protect a route — and the
 * one that forgot would fail at runtime, on a protected endpoint.
 *
 * JwtModule is registered without a secret on purpose: every sign and verify
 * call passes its own, so an access token can never be validated with the
 * refresh secret or the other way round.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [JwtGuard, RolesGuard],
  exports: [JwtGuard, RolesGuard],
})
export class GuardsModule {}
