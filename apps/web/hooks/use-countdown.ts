"use client";

import { useCallback, useEffect, useState } from "react";

export interface Countdown {
  /** Whole seconds remaining; 0 means the action is available again. */
  secondsLeft: number;
  /** Restart the countdown from now. */
  start: (seconds: number) => void;
  /** Restart from an absolute epoch-ms deadline (survives page transitions). */
  startAt: (deadlineMs: number) => void;
}

/**
 * Deadline-based rather than tick-based, so a backgrounded tab (where timers
 * are throttled) still shows the correct remaining time when it wakes up.
 */
export function useCountdown(initialDeadlineMs?: number): Countdown {
  const [deadline, setDeadline] = useState<number | null>(initialDeadlineMs ?? null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (deadline === null) {
      setSecondsLeft(0);
      return;
    }

    const tick = (): void => {
      setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [deadline]);

  const startAt = useCallback((deadlineMs: number) => {
    setDeadline(deadlineMs);
  }, []);

  const start = useCallback((seconds: number) => {
    setDeadline(Date.now() + seconds * 1000);
  }, []);

  return { secondsLeft, start, startAt };
}
