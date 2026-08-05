/**
 * Narrows an optional env value that the config schema already guarantees.
 *
 * `env.ts` marks provider credentials optional (a mock deployment needs none)
 * and enforces them in a superRefine once the matching provider is selected,
 * which the type system cannot see. This turns that guarantee into a type,
 * and if the invariant is ever broken the process fails at construction —
 * loudly, at boot — instead of silently sending mail to nowhere.
 *
 * A plain Error is deliberate: this is bootstrap misconfiguration, not a
 * request, so there is no client to render a DomainException for.
 */
export function requiredEnv(name: string, value: string | number | undefined): string {
  if (value === undefined || value === "") {
    throw new Error(`${name} is required by the selected provider but is not set`);
  }

  return String(value);
}
