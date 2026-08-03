import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { CommonModule } from "./common/common.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { ProvidersModule } from "./providers/providers.module";
import { OtpModule } from "./otp/otp.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { HealthModule } from "./health/health.module";

/**
 * Written once during the phase 1 foundation so the parallel terminals never
 * edit the same file. Registering a module here is the orchestrator's job — a
 * feature branch should only touch its own folder.
 *
 * The throttler default is a blanket ceiling; auth endpoints tighten it to
 * 5/min with their own @Throttle, and the real limits come from the config
 * table rather than these constants.
 */
@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    CommonModule,
    PrismaModule,
    RedisModule,
    ProvidersModule,
    OtpModule,
    AuthModule,
    UsersModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
