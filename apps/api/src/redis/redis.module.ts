import { Global, Module } from "@nestjs/common";

/**
 * OWNER: infra terminal (feature/phase-1-providers).
 *
 * Must provide and export `REDIS_CLIENT` (an ioredis instance built from
 * `env.REDIS_URL`, disconnected on shutdown). Global so OTP, BullMQ and the
 * chat gateway can inject it without re-importing.
 */
@Global()
@Module({})
export class RedisModule {}
