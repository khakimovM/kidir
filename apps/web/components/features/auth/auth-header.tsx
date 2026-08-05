import type { ReactNode } from "react";

export interface AuthHeaderProps {
  title: string;
  description?: ReactNode;
  /** Renders "Qadam 2 / 3" above the title. */
  step?: { current: number; total: number };
}

export function AuthHeader({ title, description, step }: AuthHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-2">
      {step ? (
        <p className="text-12 font-medium tracking-wide text-accent uppercase">
          Qadam {step.current} / {step.total}
        </p>
      ) : null}

      <h1 className="text-28">{title}</h1>

      {description ? <p className="text-14 leading-normal text-text-muted">{description}</p> : null}
    </header>
  );
}
