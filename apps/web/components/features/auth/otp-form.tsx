"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ERROR_CODES, zOtpCode, type OtpRequestResponse } from "@kidir/shared";
import { Alert, Button, Field, OtpInput, OTP_LENGTH } from "@/components/ui";
import { useCountdown } from "@/hooks/use-countdown";
import { isApiError } from "@/lib/api-client";
import { OTP_MAX_ATTEMPTS, OTP_RESEND_FALLBACK_SECONDS } from "@/lib/constants";
import { errorMessage } from "@/lib/error-messages";
import { formatCountdown } from "@/lib/format";
import { FORM_ERROR_KEY, validate } from "@/lib/schema";

export interface OtpFormProps {
  label: string;
  /** Where the code was sent, already masked. */
  hint: ReactNode;
  verify: (code: string) => Promise<void>;
  resend: () => Promise<OtpRequestResponse>;
  onVerified: () => void | Promise<void>;
  /** Epoch ms after which a resend is allowed, carried from the previous step. */
  resendAvailableAt?: number;
  /** Ask for a code as soon as the form appears (the email step does). */
  sendOnMount?: boolean;
}

export function OtpForm({
  label,
  hint,
  verify,
  resend,
  onVerified,
  resendAvailableAt,
  sendOnMount = false,
}: OtpFormProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(OTP_MAX_ATTEMPTS);

  const { secondsLeft, start } = useCountdown(resendAvailableAt);

  const sendCode = useCallback(
    async (initial: boolean) => {
      setResending(true);
      setError(null);
      setNotice(null);

      try {
        const { retryAfterSeconds } = await resend();
        start(retryAfterSeconds > 0 ? retryAfterSeconds : OTP_RESEND_FALLBACK_SECONDS);
        setAttemptsLeft(OTP_MAX_ATTEMPTS);
        setCode("");
        setNotice(initial ? "Kod yuborildi." : "Yangi kod yuborildi.");
      } catch (cause) {
        if (isApiError(cause) && cause.is(ERROR_CODES.OTP_ALREADY_SENT)) {
          // Still valid, just too soon to send another one.
          start(OTP_RESEND_FALLBACK_SECONDS);
        }
        setError(errorMessage(cause));
      } finally {
        setResending(false);
      }
    },
    [resend, start],
  );

  const requestedOnMount = useRef(false);
  useEffect(() => {
    if (!sendOnMount || requestedOnMount.current) {
      return;
    }
    requestedOnMount.current = true;
    void sendCode(true);
  }, [sendOnMount, sendCode]);

  const submit = useCallback(
    async (candidate: string) => {
      const parsed = validate(zOtpCode, candidate);
      if (!parsed.ok) {
        setError(parsed.errors[FORM_ERROR_KEY] ?? "Kodni to'liq kiriting.");
        return;
      }

      setVerifying(true);
      setError(null);
      setNotice(null);

      try {
        await verify(parsed.data);
        await onVerified();
      } catch (cause) {
        setCode("");

        if (isApiError(cause)) {
          if (cause.is(ERROR_CODES.OTP_INVALID)) {
            setAttemptsLeft((left) => Math.max(0, left - 1));
          } else if (cause.is(ERROR_CODES.OTP_TOO_MANY_ATTEMPTS)) {
            setAttemptsLeft(0);
          }
        }

        setError(errorMessage(cause));
      } finally {
        setVerifying(false);
      }
    },
    [verify, onVerified],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void submit(code);
  };

  // Only meaningful once at least one attempt was spent, and while some remain.
  const showAttempts = attemptsLeft > 0 && attemptsLeft < OTP_MAX_ATTEMPTS;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {notice ? <Alert variant="success">{notice}</Alert> : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}

      <Field
        label={label}
        hint={hint}
        error={showAttempts ? `Yana ${attemptsLeft} urinish qoldi.` : undefined}
      >
        <OtpInput
          value={code}
          onChange={(next) => {
            setCode(next);
            setError(null);
          }}
          onComplete={(next) => void submit(next)}
          disabled={verifying}
          autoFocus
        />
      </Field>

      <div className="flex flex-col gap-3">
        <Button type="submit" loading={verifying} disabled={code.length < OTP_LENGTH} fullWidth>
          Tasdiqlash
        </Button>

        <Button
          variant="ghost"
          onClick={() => void sendCode(false)}
          loading={resending}
          disabled={secondsLeft > 0 || verifying}
          fullWidth
        >
          {secondsLeft > 0
            ? `Qayta yuborish — ${formatCountdown(secondsLeft)}`
            : "Kodni qayta yuborish"}
        </Button>
      </div>
    </form>
  );
}
