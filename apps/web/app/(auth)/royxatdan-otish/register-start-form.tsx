"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { zRequestPhoneOtp, zSelfServiceRole, type SelfServiceRole } from "@kidir/shared";
import { AuthHeader } from "@/components/features/auth/auth-header";
import { Alert, Button, Card, Field, Input, RadioCard } from "@/components/ui";
import { authApi } from "@/lib/api-client";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, OTP_RESEND_FALLBACK_SECONDS } from "@/lib/constants";
import { errorMessage } from "@/lib/error-messages";
import { normalizePhone } from "@/lib/format";
import { writeRegistrationDraft } from "@/lib/registration-draft";
import { validate, type FieldErrors } from "@/lib/schema";

const ROLES = zSelfServiceRole.options;

export function RegisterStartForm() {
  const router = useRouter();

  const [role, setRole] = useState<SelfServiceRole | null>(null);
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFormError(null);

    const parsedRole = validate(zSelfServiceRole, role);
    const parsedPhone = validate(zRequestPhoneOtp, { phone: normalizePhone(phone) });

    if (!parsedRole.ok || !parsedPhone.ok) {
      setErrors({
        ...(parsedPhone.ok ? {} : parsedPhone.errors),
        ...(parsedRole.ok ? {} : { role: "Rolni tanlang." }),
      });
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const { retryAfterSeconds } = await authApi.requestPhoneOtp(parsedPhone.data);

      writeRegistrationDraft({
        role: parsedRole.data,
        phone: parsedPhone.data.phone,
        phoneVerified: false,
        resendAvailableAt:
          Date.now() +
          (retryAfterSeconds > 0 ? retryAfterSeconds : OTP_RESEND_FALLBACK_SECONDS) * 1000,
      });

      router.push("/royxatdan-otish/telefon-tasdiq");
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card padding="lg">
      <AuthHeader
        step={{ current: 1, total: 3 }}
        title="Ro'yxatdan o'tish"
        description="Avval kim sifatida ishlashingizni tanlang, so'ng telefon raqamingizni tasdiqlaymiz."
      />

      {formError ? (
        <Alert variant="danger" className="mb-6">
          {formError}
        </Alert>
      ) : null}

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="flex flex-col gap-6"
        noValidate
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-14 font-medium">Rolingiz</legend>

          <div className="grid gap-3 sm:grid-cols-2">
            {ROLES.map((option) => (
              <RadioCard
                key={option}
                name="role"
                value={option}
                checked={role === option}
                onChange={() => setRole(option)}
                title={ROLE_LABELS[option]}
                description={ROLE_DESCRIPTIONS[option]}
              />
            ))}
          </div>

          {errors.role ? <p className="text-12 text-danger">{errors.role}</p> : null}
        </fieldset>

        <Field
          label="Telefon raqam"
          hint="SMS kod shu raqamga yuboriladi. Tasdiqlash barcha uchun majburiy."
          error={errors.phone}
        >
          <Input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+998 90 123 45 67"
            inputMode="tel"
            autoComplete="tel"
          />
        </Field>

        <Button type="submit" loading={submitting} fullWidth>
          Kodni yuborish
        </Button>
      </form>

      <p className="mt-6 text-14 text-text-muted">
        Hisobingiz bormi?{" "}
        <Link href="/kirish" className="font-medium text-accent hover:underline">
          Kirish
        </Link>
      </p>
    </Card>
  );
}
