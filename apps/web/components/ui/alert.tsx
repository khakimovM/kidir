import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AlertVariant = "info" | "success" | "warning" | "danger";

const VARIANTS: Record<AlertVariant, string> = {
  info: "border-border bg-neutral-weak text-text",
  success: "border-success/25 bg-success-weak text-success",
  warning: "border-warning/25 bg-warning-weak text-warning",
  danger: "border-danger/25 bg-danger-weak text-danger",
};

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children?: ReactNode;
  className?: string;
}

export function Alert({ variant = "info", title, children, className }: AlertProps) {
  return (
    <div
      // Errors interrupt; the rest are announced politely.
      role={variant === "danger" ? "alert" : "status"}
      className={cn(
        "rounded-control border px-4 py-3 text-14 leading-normal",
        VARIANTS[variant],
        className,
      )}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      {children ? <div className={cn(title && "mt-1")}>{children}</div> : null}
    </div>
  );
}
