import { Injectable, Logger, type OnApplicationShutdown } from "@nestjs/common";
import { createTransport, type Transporter } from "nodemailer";
import { env } from "../../config/env";
import { requiredEnv } from "../required-env";
import type { MailMessage, MailProvider } from "./mail-provider.interface";

const SMTPS_PORT = 465;

/**
 * Gmail SMTP via nodemailer (v1-v2; see docs/PLAN.md 6.2). Callers depend on
 * `MAIL_PROVIDER`, so swapping in a transactional ESP later touches only this
 * folder.
 *
 * The transport is pooled and built once at construction: nodemailer keeps the
 * TLS connections open, so a burst of OTP emails does not pay a handshake per
 * message.
 */
@Injectable()
export class GmailSmtpMailProvider implements MailProvider, OnApplicationShutdown {
  private readonly logger = new Logger(GmailSmtpMailProvider.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor() {
    const port = Number(requiredEnv("SMTP_PORT", env.SMTP_PORT));

    this.from = requiredEnv("SMTP_FROM", env.SMTP_FROM);
    this.transporter = createTransport({
      host: requiredEnv("SMTP_HOST", env.SMTP_HOST),
      port,
      // 465 is implicit TLS; 587 starts plaintext and upgrades via STARTTLS.
      secure: port === SMTPS_PORT,
      auth: {
        user: requiredEnv("SMTP_USER", env.SMTP_USER),
        pass: requiredEnv("SMTP_PASSWORD", env.SMTP_PASSWORD),
      },
      pool: true,
    });
  }

  async send(message: MailMessage): Promise<void> {
    // The body can carry an OTP code, so nothing but the recipient and the
    // subject is ever logged.
    this.logger.log(`Sending mail to ${message.to} — ${message.subject}`);

    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  onApplicationShutdown(): void {
    this.transporter.close();
  }
}
