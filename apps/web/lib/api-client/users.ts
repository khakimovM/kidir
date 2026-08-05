import type { SessionUser, UpdateProfile } from "@kidir/shared";
import { api } from "./client";

/**
 * Onboarding saves one step at a time, so every field of `UpdateProfile` is
 * optional and each call sends only what that step collected.
 */
export function updateProfile(input: UpdateProfile): Promise<SessionUser> {
  return api.patch<SessionUser>("/users/me", input);
}
