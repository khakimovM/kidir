"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Input, type InputProps } from "./input";

export type PasswordInputProps = Omit<InputProps, "type">;

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-24", className)}
        autoComplete={props.autoComplete ?? "current-password"}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-pressed={visible}
        className={cn(
          "absolute top-1/2 right-2 -translate-y-1/2 rounded-control px-2 py-1",
          "text-12 text-text-muted transition-colors duration-200 hover:text-text",
        )}
      >
        {visible ? "Yashirish" : "Ko'rsatish"}
      </button>
    </div>
  );
}
