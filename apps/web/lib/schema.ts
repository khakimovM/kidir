/**
 * Structural helpers over the zod schemas exported by `@kidir/shared`.
 *
 * They are deliberately structural: the web app validates with the shared
 * contracts and never restates a type or imports zod on its own.
 */

/** The type a schema produces, e.g. `SchemaOutput<typeof zRegister>`. */
export type SchemaOutput<Schema> = Schema extends { parse: (...args: never[]) => infer Output }
  ? Output
  : never;

interface SafeParseSuccess<Output> {
  success: true;
  data: Output;
}

interface SafeParseIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

interface SafeParseFailure {
  success: false;
  error: { readonly issues: readonly SafeParseIssue[] };
}

export interface ValidatableSchema<Output> {
  safeParse(value: unknown): SafeParseSuccess<Output> | SafeParseFailure;
}

/** Field name → first message for that field. */
export type FieldErrors = Record<string, string>;

/** Where issues that belong to the form as a whole are filed. */
export const FORM_ERROR_KEY = "_form";

export type ValidationResult<Output> =
  { ok: true; data: Output } | { ok: false; errors: FieldErrors };

/**
 * Runs a shared schema over form state and flattens the issues into one
 * message per field — the shape the `Field` component consumes.
 *
 * Issues without a path (whole-object refinements) collect under `_form`.
 */
export function validate<Output>(
  schema: ValidatableSchema<Output>,
  value: unknown,
): ValidationResult<Output> {
  const result = schema.safeParse(value);

  if (result.success) {
    return { ok: true, data: result.data };
  }

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : FORM_ERROR_KEY;
    // First issue wins: showing one clear message beats stacking three.
    errors[key] ??= issue.message;
  }

  return { ok: false, errors };
}
