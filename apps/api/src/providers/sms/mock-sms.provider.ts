import { Injectable, Logger } from "@nestjs/common";
import { env } from "../../config/env";
import type { SmsProvider } from "./sms-provider.interface";

/**
 * Local-development SMS: the message is written to the log, which is where a
 * developer reads the OTP code from. This is the one place allowed to log a
 * code — every other layer treats it as a secret.
 *
 * Selected by `SMS_PROVIDER=mock`, the v1 default (no Eskiz account yet).
 */
@Injectable()
export class MockSmsProvider implements SmsProvider {
  private readonly logger = new Logger(MockSmsProvider.name);

  constructor() {
    if (env.NODE_ENV === "production") {
      this.logger.warn(
        "MockSmsProvider is active in production: no SMS is delivered and OTP codes are written to the log. Set SMS_PROVIDER=eskiz.",
      );
    }
  }

  send(to: string, text: string): Promise<void> {
    this.logger.log(`SMS to ${to}: ${text}`);
    return Promise.resolve();
  }
}
