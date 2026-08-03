export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Outbound email. v1 uses GmailSmtpMailProvider (nodemailer); MockMailProvider
 * logs instead, so local development needs no credentials.
 *
 * Business code injects `MAIL_PROVIDER` and must never import an
 * implementation directly.
 */
export interface MailProvider {
  send(message: MailMessage): Promise<void>;
}

export const MAIL_PROVIDER = "MAIL_PROVIDER";
