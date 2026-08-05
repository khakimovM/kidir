import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-control font-body text-14 font-medium " +
  "whitespace-nowrap transition-colors duration-200 " +
  "disabled:pointer-events-none disabled:opacity-55";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-active",
  secondary:
    "border border-border bg-surface text-text hover:border-border-strong hover:bg-neutral-weak active:bg-neutral-weak",
  ghost: "text-text hover:bg-neutral-weak active:bg-neutral-weak",
};

const SIZES = {
  md: "h-10 px-4",
  sm: "h-8 px-3",
} as const;

/**
 * The button's look without the button element — for the rare anchor that has
 * to look like one (Google sign-in leaves the SPA, so it must be a real link).
 */
export function buttonClasses(options?: {
  variant?: ButtonVariant;
  size?: keyof typeof SIZES;
  fullWidth?: boolean;
  className?: string;
}): string {
  return cn(
    BASE,
    VARIANTS[options?.variant ?? "primary"],
    SIZES[options?.size ?? "md"],
    options?.fullWidth && "w-full",
    options?.className,
  );
}

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
  size?: keyof typeof SIZES;
  /** Swaps the leading content for a spinner and blocks further clicks. */
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      // A loading button stays focusable but must not fire again.
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading ? <Spinner label={null} /> : null}
      {children}
    </button>
  );
}
