import { Global, Module } from "@nestjs/common";

/**
 * OWNER: infra terminal (feature/phase-1-providers).
 *
 * Must provide and export `SMS_PROVIDER` and `MAIL_PROVIDER`, picking the
 * implementation from `env.SMS_PROVIDER` / `env.MAIL_PROVIDER`. Callers see
 * only the interface.
 */
@Global()
@Module({})
export class ProvidersModule {}
