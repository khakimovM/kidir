"use client";

import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/cn";
import { useFieldControl, useFieldInvalid } from "./field";
import { CONTROL_CLASSES, CONTROL_INVALID_CLASSES } from "./input";

export type TextareaProps = ComponentPropsWithRef<"textarea">;

export function Textarea({ className, rows = 4, ...props }: TextareaProps) {
  const fieldProps = useFieldControl();
  const invalid = useFieldInvalid();

  return (
    <textarea
      {...fieldProps}
      rows={rows}
      className={cn(
        CONTROL_CLASSES,
        "resize-y py-2 leading-relaxed",
        invalid && CONTROL_INVALID_CLASSES,
        className,
      )}
      {...props}
    />
  );
}
