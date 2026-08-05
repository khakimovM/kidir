import { Global, Module } from "@nestjs/common";
import { env } from "../config/env";
import { GmailSmtpMailProvider } from "./mail/gmail-smtp-mail.provider";
import { MAIL_PROVIDER } from "./mail/mail-provider.interface";
import { MockMailProvider } from "./mail/mock-mail.provider";
import { EskizSmsProvider } from "./sms/eskiz-sms.provider";
import { MockSmsProvider } from "./sms/mock-sms.provider";
import { SMS_PROVIDER } from "./sms/sms-provider.interface";

/**
 * The single place that knows which external implementation is live. Business
 * code injects `SMS_PROVIDER` / `MAIL_PROVIDER` and sees only the interface —
 * importing a concrete provider anywhere else is a review reject.
 *
 * Only the selected class is instantiated, so a mock deployment never
 * constructs the SMTP transport (and never needs credentials for it).
 */
@Global()
@Module({
  providers: [
    {
      provide: SMS_PROVIDER,
      useClass: env.SMS_PROVIDER === "eskiz" ? EskizSmsProvider : MockSmsProvider,
    },
    {
      provide: MAIL_PROVIDER,
      useClass: env.MAIL_PROVIDER === "gmail" ? GmailSmtpMailProvider : MockMailProvider,
    },
  ],
  exports: [SMS_PROVIDER, MAIL_PROVIDER],
})
export class ProvidersModule {}
