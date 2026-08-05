"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { zSkills, type SessionUser, type SkillAssessment } from "@kidir/shared";
import { AuthHeader } from "@/components/features/auth/auth-header";
import { OnboardingGuard } from "@/components/features/auth/onboarding-guard";
import { Alert, Button, Card, Field, Input, Slider } from "@/components/ui";
import { usersApi } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-messages";
import { FORM_ERROR_KEY, validate } from "@/lib/schema";

/** Quick-add chips — a starting point, not a closed list. */
const SUGGESTIONS = [
  "TypeScript",
  "React",
  "Next.js",
  "Node.js",
  "NestJS",
  "PostgreSQL",
  "Flutter",
  "Figma",
  "Docker",
  "Python",
] as const;

const MAX_SKILLS = 20;
const DEFAULT_LEVEL = 60;

function levelLabel(level: number): string {
  if (level <= 25) return "Boshlang'ich";
  if (level <= 50) return "O'rta";
  if (level <= 75) return "Yaxshi";
  return "Chuqur";
}

export function SkillsForm() {
  return (
    <OnboardingGuard allow={["WORKER", "PM"]}>
      {(user) => <SkillsStep user={user} />}
    </OnboardingGuard>
  );
}

function SkillsStep({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [skills, setSkills] = useState<SkillAssessment[]>(user.skills);
  const [draftName, setDraftName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const addSkill = (rawName: string): void => {
    const name = rawName.trim();
    if (name.length === 0) {
      return;
    }
    if (skills.length >= MAX_SKILLS) {
      setError(`Ko'pi bilan ${MAX_SKILLS} ta stack qo'sha olasiz.`);
      return;
    }
    if (skills.some((skill) => skill.name.toLowerCase() === name.toLowerCase())) {
      setError(`"${name}" allaqachon ro'yxatda.`);
      return;
    }

    setError(null);
    setSkills((current) => [...current, { name, level: DEFAULT_LEVEL }]);
    setDraftName("");
  };

  const setLevel = (index: number, level: number): void => {
    setSkills((current) =>
      current.map((skill, position) => (position === index ? { ...skill, level } : skill)),
    );
  };

  const removeSkill = (index: number): void => {
    setSkills((current) => current.filter((_, position) => position !== index));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (skills.length === 0) {
      setError("Kamida bitta stack qo'shing.");
      return;
    }

    const parsed = validate(zSkills, skills);
    if (!parsed.ok) {
      setError(parsed.errors[FORM_ERROR_KEY] ?? "Stacklar ro'yxatida xatolik bor.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await usersApi.updateProfile({ skills: parsed.data });
      router.push("/onboarding/portfolio");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  const available = SUGGESTIONS.filter(
    (suggestion) => !skills.some((skill) => skill.name.toLowerCase() === suggestion.toLowerCase()),
  );

  return (
    <Card padding="lg">
      <AuthHeader
        step={{ current: 3, total: 4 }}
        title="Texnologiyalaringiz"
        description="Ishlaydigan stacklaringizni qo'shing va har biriga daraja bering."
      />

      <Alert variant="info" title="Bu — o'z bahoyingiz (self-assessment)" className="mb-6">
        Darajani o&apos;zingiz belgilaysiz, platforma uni tekshirmaydi. Buyurtmachi va jamoa buni
        shunday — sizning bahoyingiz sifatida ko&apos;radi.
      </Alert>

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
        <Field
          label="Stack qo'shish"
          hint={`Ko'pi bilan ${MAX_SKILLS} ta. Qo'shilgan: ${skills.length}`}
        >
          <div className="flex gap-2">
            <Input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                // Enter adds a stack instead of submitting the whole step.
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSkill(draftName);
                }
              }}
              placeholder="Masalan: Laravel"
              maxLength={50}
            />
            <Button variant="secondary" onClick={() => addSkill(draftName)}>
              Qo&apos;shish
            </Button>
          </div>
        </Field>

        {available.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {available.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => addSkill(suggestion)}
                className="rounded-full border border-border px-3 py-1 text-12 text-text-muted transition-colors duration-200 hover:border-border-strong hover:bg-neutral-weak hover:text-text"
              >
                + {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        {skills.length > 0 ? (
          <ul className="flex flex-col gap-5 border-t border-border pt-6">
            {skills.map((skill, index) => (
              <li key={skill.name}>
                <Field
                  label={skill.name}
                  hint={`${skill.level}% — ${levelLabel(skill.level)} (o'z bahosi)`}
                >
                  <div className="flex items-center gap-4">
                    <Slider
                      value={skill.level}
                      onChange={(event) => setLevel(index, Number(event.target.value))}
                      aria-label={`${skill.name} darajasi`}
                    />
                    <button
                      type="button"
                      onClick={() => removeSkill(index)}
                      className="shrink-0 rounded-control px-2 py-1 text-12 text-text-muted transition-colors duration-200 hover:text-danger"
                    >
                      O&apos;chirish
                    </button>
                  </div>
                </Field>
              </li>
            ))}
          </ul>
        ) : null}

        <Button type="submit" loading={submitting} fullWidth>
          Davom etish
        </Button>
      </form>
    </Card>
  );
}
