/**
 * Outbound SMS. v1 ships MockSmsProvider (writes the message to the log, no
 * account needed); EskizSmsProvider takes over once the Eskiz.uz contract is
 * signed, without any change to calling code.
 *
 * Business code injects `SMS_PROVIDER` and must never import an
 * implementation directly.
 */
export interface SmsProvider {
  /** @param to E.164 Uzbek number, `+998XXXXXXXXX`. */
  send(to: string, text: string): Promise<void>;
}

export const SMS_PROVIDER = "SMS_PROVIDER";
