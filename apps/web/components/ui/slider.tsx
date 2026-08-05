"use client";

import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/cn";
import { useFieldControl } from "./field";

export type SliderProps = Omit<ComponentPropsWithRef<"input">, "type">;

/**
 * Native range input. `accent-color` gives the thumb and the filled track the
 * product accent, plus keyboard support and disabled styling for free.
 */
export function Slider({ className, min = 0, max = 100, step = 5, ...props }: SliderProps) {
  const fieldProps = useFieldControl();

  return (
    <input
      {...fieldProps}
      type="range"
      min={min}
      max={max}
      step={step}
      className={cn(
        "h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-sunken accent-accent",
        "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-55",
        className,
      )}
      {...props}
    />
  );
}
