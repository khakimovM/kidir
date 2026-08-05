import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";

/**
 * OWNER: backend terminal (feature/phase-1-auth-core).
 *
 * Onboarding steps and profile reads/writes, validated with the shared
 * `zUpdateProfile` / serialised through `zPublicUser` and `zSessionUser`.
 *
 * Exported because AuthModule reuses the same serialisation: `GET /auth/me`
 * and every auth response must describe the session user exactly the way the
 * profile endpoints do.
 */
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
