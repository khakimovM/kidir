"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionUser } from "@kidir/shared";
import { authApi } from "@/lib/api-client";

export type SessionState =
  { status: "loading" } | { status: "authenticated"; user: SessionUser } | { status: "anonymous" };

export interface UseSessionResult {
  session: SessionState;
  /** Re-reads `/auth/me`, e.g. after a step changes the profile. */
  refresh: () => Promise<void>;
  /** Applies a fresh user locally without another round trip. */
  setUser: (user: SessionUser) => void;
}

/**
 * Reads the signed-in user from `/auth/me`. There is nothing to read locally:
 * the tokens are httpOnly cookies, so the server is the only source of truth
 * about who is signed in.
 */
export function useSession(): UseSessionResult {
  const [session, setSession] = useState<SessionState>({ status: "loading" });

  const refresh = useCallback(async () => {
    try {
      const user = await authApi.getSession();
      setSession({ status: "authenticated", user });
    } catch {
      // Any failure here means "not usable as a session" — the pages decide
      // where to send the visitor.
      setSession({ status: "anonymous" });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setUser = useCallback((user: SessionUser) => {
    setSession({ status: "authenticated", user });
  }, []);

  return { session, refresh, setUser };
}
