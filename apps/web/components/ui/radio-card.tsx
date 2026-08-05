"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface RadioCardProps extends Omit<ComponentPropsWithRef<"input">, "type" | "children"> {
  title: string;
  description?: ReactNode;
}

/**
 * A radio rendered as a selectable card. The real input stays in the DOM
 * (screen readers and keyboard navigation use it) and only the card is painted.
 */
export function RadioCard({ title, description, className, ...props }: RadioCardProps) {
  return (
    <label className={cn("block cursor-pointer has-disabled:cursor-not-allowed", className)}>
      <input type="radio" className="peer sr-only" {...props} />
      <span
        className={cn(
          "flex h-full flex-col gap-1 rounded-card border border-border bg-surface p-4",
          "transition-colors duration-200",
          "hover:border-border-strong hover:bg-neutral-weak",
          "peer-checked:border-accent peer-checked:bg-accent-weak peer-checked:hover:bg-accent-weak",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
          "peer-disabled:opacity-55 peer-disabled:hover:border-border peer-disabled:hover:bg-surface",
        )}
      >
        <span className="font-heading text-16 font-semibold tracking-[-0.02em]">{title}</span>
        {description ? (
          <span className="text-14 leading-normal text-text-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}
