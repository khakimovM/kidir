"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ERROR_CODES, zVerifyPhoneOtp } from "@kidir/shared";
import { AuthHeader } from "@/components/features/auth/auth-header";
import { OtpForm } from "@/components/features/auth/otp-form";
import { Card, Spinner } from "@/components/ui";
import { ApiError, authApi } from "@/lib/api-client";
import { maskPhone } from "@/lib/format";
import {
  readRegistrationDraft,
  writeRegistrationDraft,
  type RegistrationDraft,
} from "@/lib/registration-draft";
import { validate } from "@/lib/schema";

export function PhoneVerifyForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<RegistrationDraft | null>(null);

  // sessionStorage only exists in the browser, so the draft is read after mount.
  useEffect(() => {
    const stored = readRegistrationDraft();
    if (!stored) {
      router.replace("/royxatdan-otish");
      return;
    }
    setDraft(stored);
  }, [router]);

  const phone = draft?.phone;

  const verify = useCallback(
    async (code: string) => {
      const parsed = validate(zVerifyPhoneOtp, { phone, code });
      if (!parsed.ok) {
        throw new ApiError(0, ERROR_CODES.VALIDATION_ERROR, "");
      }
      await authApi.verifyPhoneOtp(parsed.data);
    },
    [phone],
  );

  const resend = useCallback(() => {
    return authApi.requestPhoneOtp({ phone: phone ?? "" });
  }, [phone]);

  const handleVerified = useCallback(() => {
    if (!draft) {
      return;
    }
    writeRegistrationDraft({ ...draft, phoneVerified: true });
    router.push("/royxatdan-otish/malumot");
  }, [draft, router]);

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
        step={{ current: 2, total: 3 }}
        title="Telefonni tasdiqlang"
        description={
          <>
            {maskPhone(draft.phone)} raqamiga 6 xonali kod yubordik.{" "}
            <Link href="/royxatdan-otish" className="font-medium text-accent hover:underline">
              Raqamni o&apos;zgartirish
            </Link>
          </>
        }
      />

      <OtpForm
        label="SMS kod"
        hint="Kod 2 daqiqa amal qiladi."
        verify={verify}
        resend={resend}
        onVerified={handleVerified}
        resendAvailableAt={draft.resendAvailableAt}
      />
    </Card>
  );
}
