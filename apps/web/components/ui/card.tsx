import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/cn";

export interface CardProps extends ComponentPropsWithRef<"div"> {
  /** `sm` = 16px padding, `md` = 24px, `lg` = 32px. */
  padding?: keyof typeof PADDING;
}

const PADDING = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
} as const;

export function Card({ padding = "md", className, children, ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-card border border-border bg-surface", PADDING[padding], className)}
      {...props}
    >
      {children}
    </div>
  );
}
