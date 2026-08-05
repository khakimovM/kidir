"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { ERROR_CODES, zVerifyEmailOtp, type SessionUser } from "@kidir/shared";
import { AuthHeader } from "@/components/features/auth/auth-header";
import { OnboardingGuard } from "@/components/features/auth/onboarding-guard";
import { OtpForm } from "@/components/features/auth/otp-form";
import { Alert, Card } from "@/components/ui";
import { ApiError, authApi } from "@/lib/api-client";
import { maskEmail } from "@/lib/format";
import { validate } from "@/lib/schema";

export function EmailVerifyForm() {
  return <OnboardingGuard>{(user) => <EmailVerifyStep user={user} />}</OnboardingGuard>;
}

function EmailVerifyStep({ user }: { user: SessionUser }) {
  const router = useRouter();
  const email = user.email;

  /** Workers still have specialization, stacks and portfolio ahead of them. */
  const nextStep = user.role === "WORKER" ? "/onboarding/soha" : "/";
  const totalSteps = user.role === "WORKER" ? 4 : 1;

  useEffect(() => {
    if (user.emailVerified) {
      router.replace(nextStep);
    }
  }, [user.emailVerified, nextStep, router]);

  const verify = useCallback(
    async (code: string) => {
      const parsed = validate(zVerifyEmailOtp, { email, code });
      if (!parsed.ok) {
        throw new ApiError(0, ERROR_CODES.VALIDATION_ERROR, "");
      }
      await authApi.verifyEmailOtp(parsed.data);
    },
    [email],
  );

  const resend = useCallback(() => {
    return authApi.requestEmailOtp({ email: email ?? "" });
  }, [email]);

  const handleVerified = useCallback(() => {
    router.replace(nextStep);
  }, [router, nextStep]);

  if (!email) {
    return (
      <Card padding="lg">
        <AuthHeader title="Email topilmadi" />
        <Alert variant="warning">
          Hisobingizga email biriktirilmagan.{" "}
          <Link href="/kirish" className="font-medium underline">
            Qaytadan kiring
          </Link>
          .
        </Alert>
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <AuthHeader
        step={{ current: 1, total: totalSteps }}
        title="Emailni tasdiqlang"
        description={`${maskEmail(email)} manziliga 6 xonali kod yubordik.`}
      />

      <OtpForm
        label="Email kod"
        hint="Xat kelmasa, spam papkasini ham tekshiring."
        verify={verify}
        resend={resend}
        onVerified={handleVerified}
        sendOnMount
      />
    </Card>
  );
}
