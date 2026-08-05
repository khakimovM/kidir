import { Injectable, Logger } from "@nestjs/common";
import { env } from "../../config/env";
import type { MailMessage, MailProvider } from "./mail-provider.interface";

/**
 * Local-development email: the message is written to the log instead of being
 * sent, so no SMTP credentials are needed to run the OTP flow.
 *
 * Selected by `MAIL_PROVIDER=mock`.
 */
@Injectable()
export class MockMailProvider implements MailProvider {
  private readonly logger = new Logger(MockMailProvider.name);

  constructor() {
    if (env.NODE_ENV === "production") {
      this.logger.warn(
        "MockMailProvider is active in production: no email is delivered and OTP codes are written to the log. Set MAIL_PROVIDER=gmail.",
      );
    }
  }

  send(message: MailMessage): Promise<void> {
    this.logger.log(`Mail to ${message.to} — ${message.subject}: ${message.text}`);
    return Promise.resolve();
  }
}
