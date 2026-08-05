/**
 * Turns what a person typed into the `+998XXXXXXXXX` shape `zPhone` expects.
 * Accepts "90 123 45 67", "998901234567", "+998 90 123-45-67".
 * Anything it cannot normalise is returned trimmed, so the shared schema — not
 * this helper — decides what is valid.
 */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");

  if (digits.length === 9) {
    return `+998${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("998")) {
    return `+${digits}`;
  }

  return input.trim();
}

/** `+998901234567` → `+998 90 123 45 67`. */
export function formatPhone(phone: string): string {
  const match = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  if (!match) {
    return phone;
  }

  return `+998 ${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
}

/** `+998901234567` → `+998 90 *** ** 67` for confirmation screens. */
export function maskPhone(phone: string): string {
  const match = /^\+998(\d{2})\d{5}(\d{2})$/.exec(phone);
  if (!match) {
    return phone;
  }

  return `+998 ${match[1]} *** ** ${match[2]}`;
}

/** `aziz@example.com` → `az***@example.com`. */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) {
    return email;
  }

  const name = email.slice(0, at);
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}***${email.slice(at)}`;
}

/** Seconds → `1:05`, for resend timers. */
export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
