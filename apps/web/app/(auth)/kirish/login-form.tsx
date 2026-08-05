"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { zLogin } from "@kidir/shared";
import { AuthHeader } from "@/components/features/auth/auth-header";
import { Alert, Button, buttonClasses, Card, Field, Input, PasswordInput } from "@/components/ui";
import { authApi } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-messages";
import { normalizePhone } from "@/lib/format";
import { validate, type FieldErrors } from "@/lib/schema";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("sabab") === "sessiya";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFormError(null);

    // An identifier without "@" is a phone: accept "90 123 45 67" too.
    const parsed = validate(zLogin, {
      identifier: identifier.includes("@") ? identifier.trim() : normalizePhone(identifier),
      password,
    });

    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      await authApi.login(parsed.data);
      // Tokens arrived as httpOnly cookies; nothing to store on this side.
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card padding="lg">
      <AuthHeader
        title="Kirish"
        description="Telefon raqam yoki email bilan hisobingizga kiring."
      />

      {sessionExpired ? (
        <Alert variant="warning" className="mb-6">
          Sessiya muddati tugadi. Iltimos, qaytadan kiring.
        </Alert>
      ) : null}

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
        <Field label="Telefon yoki email" error={errors.identifier}>
          <Input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="+998 90 123 45 67"
            autoComplete="username"
            autoFocus
          />
        </Field>

        <Field label="Parol" error={errors.password}>
          <PasswordInput
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </Field>

        <Button type="submit" loading={submitting} fullWidth>
          Kirish
        </Button>
      </form>

      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-border" />
        <span className="text-12 text-text-muted">yoki</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* A real link, not fetch: the server redirects to Google with its own `state`. */}
      <a
        href={authApi.GOOGLE_SIGN_IN_URL}
        className={buttonClasses({ variant: "secondary", fullWidth: true })}
      >
        Google bilan kirish
      </a>
      <p className="mt-2 text-12 text-text-muted">
        Google orqali kirish faqat buyurtmachilar uchun.
      </p>

      <p className="mt-6 text-14 text-text-muted">
        Hisobingiz yo&apos;qmi?{" "}
        <Link href="/royxatdan-otish" className="font-medium text-accent hover:underline">
          Ro&apos;yxatdan o&apos;tish
        </Link>
      </p>
    </Card>
  );
}
