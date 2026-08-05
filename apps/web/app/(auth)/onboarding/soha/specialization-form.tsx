"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { zSpecialization, type SessionUser, type Specialization } from "@kidir/shared";
import { AuthHeader } from "@/components/features/auth/auth-header";
import { OnboardingGuard } from "@/components/features/auth/onboarding-guard";
import { Alert, Button, Card, RadioCard } from "@/components/ui";
import { usersApi } from "@/lib/api-client";
import { SPECIALIZATION_DESCRIPTIONS, SPECIALIZATION_LABELS } from "@/lib/constants";
import { errorMessage } from "@/lib/error-messages";
import { validate } from "@/lib/schema";

const SPECIALIZATIONS = zSpecialization.options;

export function SpecializationForm() {
  return (
    <OnboardingGuard allow={["WORKER", "PM"]}>
      {(user) => <SpecializationStep user={user} />}
    </OnboardingGuard>
  );
}

function SpecializationStep({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [specialization, setSpecialization] = useState<Specialization | null>(
    user.specialization ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const parsed = validate(zSpecialization, specialization);
    if (!parsed.ok) {
      setError("Mutaxassisligingizni tanlang.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await usersApi.updateProfile({ specialization: parsed.data });
      router.push("/onboarding/stacklar");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card padding="lg">
      <AuthHeader
        step={{ current: 2, total: 4 }}
        title="Asosiy mutaxassisligingiz"
        description="Loyihalarni sizga moslashtirish uchun kerak. Keyinchalik profildan o'zgartira olasiz."
      />

      {error ? (
        <Alert variant="danger" className="mb-6">
          {error}
        </Alert>
      ) : null}

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="flex flex-col gap-6"
        noValidate
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {SPECIALIZATIONS.map((option) => (
            <RadioCard
              key={option}
              name="specialization"
              value={option}
              checked={specialization === option}
              onChange={() => setSpecialization(option)}
              title={SPECIALIZATION_LABELS[option]}
              description={SPECIALIZATION_DESCRIPTIONS[option]}
            />
          ))}
        </div>

        <Button type="submit" loading={submitting} fullWidth>
          Davom etish
        </Button>
      </form>
    </Card>
  );
}
