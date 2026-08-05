"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { SessionUser, UserRole } from "@kidir/shared";
import { Card, Spinner } from "@/components/ui";
import { useSession } from "@/hooks/use-session";

export interface OnboardingGuardProps {
  /** Roles allowed on this step; anyone else is sent to the home page. */
  allow?: readonly UserRole[];
  children: (user: SessionUser, refresh: () => Promise<void>) => ReactNode;
}

/**
 * Onboarding steps are for signed-in users only. This is convenience routing,
 * not access control — the API enforces the real rules on every request.
 */
export function OnboardingGuard({ allow, children }: OnboardingGuardProps) {
  const router = useRouter();
  const { session, refresh } = useSession();

  const user = session.status === "authenticated" ? session.user : null;
  const roleAllowed = user ? (allow ? allow.includes(user.role) : true) : true;

  useEffect(() => {
    if (session.status === "anonymous") {
      router.replace("/kirish");
      return;
    }
    if (!roleAllowed) {
      router.replace("/");
    }
  }, [session.status, roleAllowed, router]);

  if (!user || !roleAllowed) {
    return (
      <Card padding="lg" className="flex justify-center py-12">
        <Spinner size="md" />
      </Card>
    );
  }

  return <>{children(user, refresh)}</>;
}
