import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { env } from "./config/env";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

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
