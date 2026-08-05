"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent, type ChangeEvent } from "react";
import { cn } from "@/lib/cn";
import { useFieldControl, useFieldInvalid } from "./field";

/** OTP codes are six digits everywhere in the product (`zOtpCode`). */
export const OTP_LENGTH = 6;

export interface OtpInputProps {
  /** Digits entered so far, 0-6 characters. */
  value: string;
  onChange: (value: string) => void;
  /** Fired once the sixth digit lands — lets the form submit itself. */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = false,
  className,
}: OtpInputProps) {
  const fieldProps = useFieldControl();
  const invalid = useFieldInvalid();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const focusBox = (index: number): void => {
    const target = inputs.current[Math.min(Math.max(index, 0), OTP_LENGTH - 1)];
    target?.focus();
    target?.select();
  };

  const commit = (next: string): void => {
    const trimmed = next.slice(0, OTP_LENGTH);
    onChange(trimmed);
    if (trimmed.length === OTP_LENGTH) {
      onComplete?.(trimmed);
    }
  };

  const handleChange = (index: number, event: ChangeEvent<HTMLInputElement>): void => {
    const typed = onlyDigits(event.target.value);

    if (typed.length === 0) {
      // The box was cleared with Delete, or emptied by selecting and retyping.
      commit(value.slice(0, index) + value.slice(index + 1));
      return;
    }

    // The code is always a gapless string, so a digit typed past the end lands
    // in the first free box. Autofill spills into the boxes that follow.
    const at = Math.min(index, value.length);
    const next = (value.slice(0, at) + typed + value.slice(at + typed.length)).slice(0, OTP_LENGTH);

    commit(next);
    focusBox(at + typed.length);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (value[index]) {
        commit(value.slice(0, index) + value.slice(index + 1));
        return;
      }
      // Empty box: erase the previous digit and step back.
      commit(value.slice(0, Math.max(index - 1, 0)) + value.slice(index));
      focusBox(index - 1);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBox(index - 1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>): void => {
    const pasted = onlyDigits(event.clipboardData.getData("text"));
    if (pasted.length === 0) {
      return;
    }

    // A pasted code always fills from the first box, whichever box has focus.
    event.preventDefault();
    const next = pasted.slice(0, OTP_LENGTH);
    commit(next);
    focusBox(next.length);
  };

  return (
    <div
      role="group"
      aria-describedby={fieldProps["aria-describedby"]}
      className={cn("flex gap-2", className)}
    >
      {Array.from({ length: OTP_LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(element) => {
            inputs.current[index] = element;
          }}
          id={index === 0 ? fieldProps.id : undefined}
          value={value[index] ?? ""}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => {
            // Clicking a box beyond the entered digits jumps back to the gap.
            if (index > value.length) {
              focusBox(value.length);
              return;
            }
            event.target.select();
          }}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          // One-time-code autofill only needs to be advertised once.
          autoComplete={index === 0 ? "one-time-code" : "off"}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={OTP_LENGTH}
          aria-label={`${index + 1}-raqam`}
          aria-invalid={invalid ? true : undefined}
          className={cn(
            "h-12 w-full min-w-0 rounded-control border bg-surface text-center font-heading text-20 text-text",
            "transition-colors duration-200 outline-none",
            "hover:border-border-strong",
            "focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-muted",
            invalid ? "border-danger" : "border-border",
          )}
        />
      ))}
    </div>
  );
}
