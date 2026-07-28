import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { env } from "./config/env";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: [env.WEB_URL, env.ADMIN_URL], credentials: true });
  await app.listen(env.API_PORT);
}

void bootstrap();
