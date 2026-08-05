"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  isAllowedPortfolioUrl,
  PORTFOLIO_ALLOWLIST_DOMAINS,
  zUpdateProfile,
  type SessionUser,
} from "@kidir/shared";
import { AuthHeader } from "@/components/features/auth/auth-header";
import { OnboardingGuard } from "@/components/features/auth/onboarding-guard";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { usersApi } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-messages";
import { validate, type FieldErrors } from "@/lib/schema";

const MAX_BIO = 1000;
const MAX_LINKS = 10;

/** Adds the scheme people leave out, so "github.com/ali" is still usable. */
function withScheme(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function PortfolioForm() {
  return (
    <OnboardingGuard allow={["WORKER", "PM"]}>
      {(user) => <PortfolioStep user={user} />}
    </OnboardingGuard>
  );
}

function PortfolioStep({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [bio, setBio] = useState(user.bio ?? "");
  const [links, setLinks] = useState<string[]>(user.portfolioLinks);
  const [draftLink, setDraftLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const addLink = (): void => {
    const candidate = withScheme(draftLink);
    if (candidate.length === 0) {
      return;
    }

    if (links.length >= MAX_LINKS) {
      setLinkError(`Ko'pi bilan ${MAX_LINKS} ta link qo'sha olasiz.`);
      return;
    }

    // The same allowlist the API enforces — checked here so the mistake is
    // caught before a round trip, not instead of the server check.
    if (!isAllowedPortfolioUrl(candidate)) {
      setLinkError("Link https bo'lishi va quyidagi saytlardan biriga tegishli bo'lishi kerak.");
      return;
    }

    if (links.includes(candidate)) {
      setLinkError("Bu link allaqachon qo'shilgan.");
      return;
    }

    setLinkError(null);
    setLinks((current) => [...current, candidate]);
    setDraftLink("");
  };

  const removeLink = (index: number): void => {
    setLinks((current) => current.filter((_, position) => position !== index));
  };

  const save = async (payload: { bio?: string; portfolioLinks?: string[] }): Promise<void> => {
    setFormError(null);

    const parsed = validate(zUpdateProfile, payload);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setFormError(parsed.errors.portfolioLinks ?? null);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      await usersApi.updateProfile(parsed.data);
      router.replace("/");
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmed = bio.trim();
    void save({
      // An empty bio is simply not sent — every field of the step is optional.
      ...(trimmed.length > 0 ? { bio: trimmed } : {}),
      portfolioLinks: links,
    });
  };

  return (
    <Card padding="lg">
      <AuthHeader
        step={{ current: 4, total: 4 }}
        title="O'zingiz haqingizda"
        description="Bu qadam ixtiyoriy, lekin to'ldirilgan profil buyurtmachida ishonch uyg'otadi."
      />

      {formError ? (
        <Alert variant="danger" className="mb-6">
          {formError}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <Field label="Bio" optional hint={`${bio.length} / ${MAX_BIO} belgi`} error={errors.bio}>
          <Textarea
            value={bio}
            onChange={(event) => setBio(event.target.value.slice(0, MAX_BIO))}
            placeholder="Qanday loyihalar ustida ishlaganingiz, kuchli tomonlaringiz…"
            rows={5}
          />
        </Field>

        <Field
          label="Portfolio linklari"
          optional
          hint={
            <>
              Faqat https va faqat quyidagi saytlar:{" "}
              <span className="text-text">{PORTFOLIO_ALLOWLIST_DOMAINS.join(", ")}</span>.
              Xavfsizlik uchun linklar sahifada ochib ko&apos;rsatilmaydi.
            </>
          }
          error={linkError ?? errors.portfolioLinks}
        >
          <div className="flex gap-2">
            <Input
              value={draftLink}
              onChange={(event) => {
                setDraftLink(event.target.value);
                setLinkError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addLink();
                }
              }}
              placeholder="https://github.com/foydalanuvchi"
              inputMode="url"
              maxLength={500}
            />
            <Button variant="secondary" onClick={addLink}>
              Qo&apos;shish
            </Button>
          </div>
        </Field>

        {links.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {links.map((link, index) => (
              <li
                key={link}
                className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface-sunken px-3 py-2"
              >
                <span className="truncate text-14">{link}</span>
                <button
                  type="button"
                  onClick={() => removeLink(index)}
                  className="shrink-0 rounded-control px-2 py-1 text-12 text-text-muted transition-colors duration-200 hover:text-danger"
                >
                  O&apos;chirish
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-col gap-3">
          <Button type="submit" loading={submitting} fullWidth>
            Yakunlash
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.replace("/")}
            disabled={submitting}
            fullWidth
          >
            Hozircha o&apos;tkazib yuborish
          </Button>
        </div>
      </form>
    </Card>
  );
}
