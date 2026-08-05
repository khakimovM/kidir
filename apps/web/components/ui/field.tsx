"use client";

import { createContext, useContext, useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface FieldContextValue {
  controlId: string;
  describedBy?: string;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * Wiring for the control inside a `Field`: id, `aria-describedby` and
 * `aria-invalid` come from the field so every input is labelled correctly
 * without the caller repeating ids. Outside a `Field` it is a no-op.
 */
export function useFieldControl(): {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
} {
  const context = useContext(FieldContext);
  if (!context) {
    return {};
  }

  return {
    id: context.controlId,
    "aria-describedby": context.describedBy,
    "aria-invalid": context.invalid ? true : undefined,
  };
}

/** True when the surrounding field is in an error state. */
export function useFieldInvalid(): boolean {
  return useContext(FieldContext)?.invalid ?? false;
}

export interface FieldProps {
  label: string;
  /** Static guidance shown under the control. */
  hint?: ReactNode;
  /** Validation message; replaces nothing, but marks the control invalid. */
  error?: string;
  /** Renders a muted "ixtiyoriy" tag next to the label. */
  optional?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, error, optional = false, children, className }: FieldProps) {
  const controlId = useId();
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;

  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider value={{ controlId, describedBy, invalid: Boolean(error) }}>
      <div className={cn("flex flex-col gap-2", className)}>
        <label htmlFor={controlId} className="flex items-baseline gap-2 text-14 font-medium">
          {label}
          {optional ? <span className="text-12 text-text-muted">ixtiyoriy</span> : null}
        </label>

        {children}

        {hint ? (
          <p id={hintId} className="text-12 leading-normal text-text-muted">
            {hint}
          </p>
        ) : null}

        {error ? (
          <p id={errorId} className="text-12 leading-normal text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}
