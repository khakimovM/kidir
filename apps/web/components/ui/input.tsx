"use client";

import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/cn";
import { useFieldControl, useFieldInvalid } from "./field";

/** Shared by input, textarea and select so every control looks identical. */
export const CONTROL_CLASSES =
  "w-full rounded-control border border-border bg-surface px-3 text-16 text-text " +
  "transition-colors duration-200 outline-none " +
  "placeholder:text-text-muted " +
  "hover:border-border-strong " +
  "focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-muted disabled:hover:border-border";

export const CONTROL_INVALID_CLASSES =
  "border-danger hover:border-danger focus-visible:border-danger focus-visible:outline-danger";

export type InputProps = ComponentPropsWithRef<"input">;

export function Input({ className, ...props }: InputProps) {
  const fieldProps = useFieldControl();
  const invalid = useFieldInvalid();

  return (
    <input
      {...fieldProps}
      className={cn(CONTROL_CLASSES, "h-10", invalid && CONTROL_INVALID_CLASSES, className)}
      {...props}
    />
  );
}
