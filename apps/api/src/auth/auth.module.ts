import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { GuardsModule } from "../common/guards/guards.module";
import { CsrfGuard } from "../common/guards/csrf.guard";
import { OtpModule } from "../otp/otp.module";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { TokenService } from "./token.service";
import { GoogleAuthService } from "./google-auth.service";

/**
 * OWNER: backend terminal (feature/phase-1-auth-core).
 *
 * Registration/login (argon2id), access + refresh cookies, refresh rotation
 * with reuse detection, Google OAuth, and the guards in ../common/guards.
 * Imports OtpModule for the phone/email codes.
 *
 * `CsrfGuard` is registered here rather than in app.module.ts because that
 * file belongs to the orchestrator; APP_GUARD from a feature module is applied
 * globally all the same, so every mutation in the app is covered.
 */
@Module({
  imports: [JwtModule.register({}), GuardsModule, UsersModule, OtpModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    GoogleAuthService,
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
