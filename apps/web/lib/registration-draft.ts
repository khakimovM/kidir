import { zPhone, zSelfServiceRole, type SelfServiceRole } from "@kidir/shared";

const STORAGE_KEY = "kidir:registration";

/**
 * Registration spans four pages, so the choices made along the way have to
 * survive a reload.
 *
 * Only non-secret routing data is kept: never a password, and never a token —
 * access and refresh tokens are httpOnly cookies this code cannot read anyway.
 * sessionStorage (not localStorage) means it dies with the tab.
 */
export interface RegistrationDraft {
  role: SelfServiceRole;
  phone: string;
  /** Set once the SMS code was accepted by the server. */
  phoneVerified: boolean;
  /** Epoch ms; carries the resend cooldown across the page transition. */
  resendAvailableAt?: number;
}

export function readRegistrationDraft(): RegistrationDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const candidate = parsed as Record<string, unknown>;
  const role = zSelfServiceRole.safeParse(candidate.role);
  const phone = zPhone.safeParse(candidate.phone);

  if (!role.success || !phone.success) {
    return null;
  }

  return {
    role: role.data,
    phone: phone.data,
    phoneVerified: candidate.phoneVerified === true,
    resendAvailableAt:
      typeof candidate.resendAvailableAt === "number" ? candidate.resendAvailableAt : undefined,
  };
}

export function writeRegistrationDraft(draft: RegistrationDraft): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function clearRegistrationDraft(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(STORAGE_KEY);
}
