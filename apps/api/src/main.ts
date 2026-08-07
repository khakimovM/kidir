import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { env } from "./config/env";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Without this, every request behind a reverse proxy reports the proxy's
  // address: the 5/min auth limit would be shared by the whole platform
  // instead of per client, and the ip recorded on each refresh row — the trail
  // a stolen session leaves — would be the same value for everyone.
  app.set("trust proxy", env.TRUST_PROXY_HOPS);

  // Redis and Prisma both close themselves on shutdown, but Nest only calls
  // those hooks if they are enabled: without this, SIGTERM from `docker
  // compose down` drops the Redis connection mid-command instead of quitting.
  app.enableShutdownHooks();

  // Auth tokens live only in httpOnly cookies, so they must be parsed before
  // any guard runs.
  app.use(cookieParser());

  // credentials:true is what lets the browser attach those cookies; the
  // origin list stays explicit because "*" is not allowed alongside it.
  // X-Requested-With is the CSRF header every mutation must carry.
  app.enableCors({
    origin: [env.WEB_URL, env.ADMIN_URL],
    credentials: true,
    allowedHeaders: ["Content-Type", "X-Requested-With"],
  });

  await app.listen(env.API_PORT);
}

void bootstrap();
