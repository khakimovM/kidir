import { Module } from "@nestjs/common";

/**
 * OWNER: infra terminal (feature/phase-1-providers).
 *
 * Must bind the `OtpService` abstract class to the Redis-backed
 * implementation and export it, so AuthModule can inject `OtpService`
 * directly:
 *
 *   providers: [{ provide: OtpService, useClass: RedisOtpService }],
 *   exports: [OtpService],
 */
@Module({})
export class OtpModule {}
