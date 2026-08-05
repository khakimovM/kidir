import { Global, Inject, Logger, Module, type OnApplicationShutdown } from "@nestjs/common";
import { Redis } from "ioredis";
import { env } from "../config/env";
import { REDIS_CLIENT } from "./redis.constants";

const logger = new Logger("RedisModule");

/**
 * Redis is cache, queue, presence and short-lived OTP state — never a source
 * of truth. A dead Redis must therefore degrade the app, not stop it booting:
 * the `error` listener swallows connection failures (an unhandled `error`
 * event on an ioredis client would take the process down) while ioredis keeps
 * reconnecting in the background.
 *
 * Consecutive identical failures are logged once so a Redis outage does not
 * bury every other log line under the same reconnect message.
 */
function createRedisClient(): Redis {
  const client = new Redis(env.REDIS_URL, {
    // A command must not hang forever while the connection is down: after a
    // few retries it rejects, the caller sees a 500, and the request ends.
    maxRetriesPerRequest: 3,
    retryStrategy: (attempt: number) => Math.min(attempt * 200, 5_000),
  });

  let lastError: string | undefined;

  client.on("error", (error: Error) => {
    if (error.message !== lastError) {
      lastError = error.message;
      logger.error(`Redis connection error: ${error.message}`);
    }
  });

  client.on("ready", () => {
    lastError = undefined;
    logger.log("Redis connection ready");
  });

  return client;
}

@Global()
@Module({
  providers: [{ provide: REDIS_CLIENT, useFactory: createRedisClient }],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    try {
      // Drains in-flight commands; `disconnect()` would drop them.
      await this.client.quit();
    } catch {
      // Already down or mid-reconnect — quit() rejects, and there is nothing
      // left to close gracefully.
      this.client.disconnect();
    }
  }
}
