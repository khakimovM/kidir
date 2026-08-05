import { Module } from "@nestjs/common";
import { OtpService } from "./otp.contract";
import { RedisOtpService } from "./redis-otp.service";

/**
 * AuthModule injects the abstract `OtpService`; the Redis implementation is
 * bound here and nowhere else. Redis, Prisma and the SMS/mail providers all
 * come from global modules, so nothing has to be imported.
 */
@Module({
  providers: [{ provide: OtpService, useClass: RedisOtpService }],
  exports: [OtpService],
})
export class OtpModule {}
