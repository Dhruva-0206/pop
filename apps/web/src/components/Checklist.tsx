"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Vertical checklist for a multi-step wait (the payment). `current` is the 0-based active step; steps before it are done.
 * Each finished step shows how long it took, the active one says "Now". Squares match the order tracker:
 * filled = done or now, outlined = not yet. The state is also spelled out in words for screen readers.
 */
export function Checklist({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  const started = useRef<number[]>([]);
  const [took, setTook] = useState<Record<number, number>>({});
  useEffect(() => {
    const now = Date.now();
    if (current >= 0 && started.current[current] === undefined) started.current[current] = now;
    // A step is done when a later one starts; record how long it took (display only).
    setTook((t) => {
      const next = { ...t };
      for (let i = 0; i < current; i++) {
        if (next[i] === undefined) next[i] = started.current[i] !== undefined ? Math.max(1, Math.round((now - started.current[i]) / 1000)) : 0;
      }
      return next;
    });
  }, [current]);

  return (
    <ol className="checklist" aria-label={label} aria-live="polite">
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "now" : "next";
        return (
          <li key={s} className={`check check-${state}`}>
            <span className="track-mark" aria-hidden="true" />
            <span className="check-label">{s}</span>
            <span className="check-note">
              {state === "done" ? (took[i] ? `Done, ${took[i]} s` : "Skipped") : state === "now" ? "Now, about 5 s" : ""}
              <span className="sr-only">{state === "done" ? " (done)" : state === "now" ? " (in progress)" : " (next)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
