"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ERROR_CODES, zRegister } from "@kidir/shared";
import { AuthHeader } from "@/components/features/auth/auth-header";
import { Alert, Button, Card, Field, Input, PasswordInput, Spinner } from "@/components/ui";
import { authApi, isApiError } from "@/lib/api-client";
import { ROLE_LABELS } from "@/lib/constants";
import { errorMessage } from "@/lib/error-messages";
import { formatPhone } from "@/lib/format";
import {
  clearRegistrationDraft,
  readRegistrationDraft,
  type RegistrationDraft,
} from "@/lib/registration-draft";
import { validate, type FieldErrors } from "@/lib/schema";

export function RegisterDetailsForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<RegistrationDraft | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = readRegistrationDraft();
    if (!stored) {
      router.replace("/royxatdan-otish");
      return;
    }
    // The server checks this too; the redirect just keeps the wizard honest.
    if (!stored.phoneVerified) {
      router.replace("/royxatdan-otish/telefon-tasdiq");
      return;
    }
    setDraft(stored);
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!draft) {
      return;
    }

    setFormError(null);

    const parsed = validate(zRegister, {
      phone: draft.phone,
      role: draft.role,
      fullName: fullName.trim(),
      email: email.trim(),
      password,
    });

    if (!parsed.ok) {
      setErrors(parsed.errors);
      // Phone and role come from earlier steps: surface them at form level.
      setFormError(parsed.errors.phone ?? parsed.errors.role ?? null);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      await authApi.register(parsed.data);
      // Registration signs the user in via httpOnly cookies; the draft is done.
      clearRegistrationDraft();
      router.replace("/onboarding/email-tasdiq");
    } catch (cause) {
      setFormError(errorMessage(cause));

      if (isApiError(cause) && cause.is(ERROR_CODES.OTP_NOT_VERIFIED)) {
        // The phone verification window lapsed — the wizard has to start over.
        clearRegistrationDraft();
        router.replace("/royxatdan-otish");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!draft) {
    return (
      <Card padding="lg" className="flex justify-center py-12">
        <Spinner size="md" />
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <AuthHeader
        step={{ current: 3, total: 3 }}
        title="Ma'lumotlaringiz"
        description={`${ROLE_LABELS[draft.role]} · ${formatPhone(draft.phone)} tasdiqlandi`}
      />

      {formError ? (
        <Alert variant="danger" className="mb-6">
          {formError}
        </Alert>
      ) : null}

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="flex flex-col gap-5"
        noValidate
      >
        <Field label="To'liq ism" error={errors.fullName}>
          <Input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Alisher Karimov"
            autoComplete="name"
            autoFocus
          />
        </Field>

        <Field label="Email" hint="Tasdiqlash kodi shu manzilga yuboriladi." error={errors.email}>
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ism@example.com"
            autoComplete="email"
          />
        </Field>

        <Field
          label="Parol"
          hint="Kamida 10 belgi, ichida harf va raqam bo'lsin."
          error={errors.password}
        >
          <PasswordInput
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
        </Field>

        <Button type="submit" loading={submitting} fullWidth>
          Ro&apos;yxatdan o&apos;tish
        </Button>
      </form>
    </Card>
  );
}
