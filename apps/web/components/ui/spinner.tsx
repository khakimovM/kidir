import { cn } from "@/lib/cn";

export interface SpinnerProps {
  /** 14px inside buttons, 20px standalone. */
  size?: "sm" | "md";
  className?: string;
  /** Announced to screen readers; pass `null` inside an already-labelled control. */
  label?: string | null;
}

export function Spinner({ size = "sm", className, label = "Yuklanmoqda" }: SpinnerProps) {
  return (
    <span
      role={label === null ? undefined : "status"}
      aria-label={label ?? undefined}
      className={cn(
        "inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent",
        size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5",
        className,
      )}
    />
  );
}
