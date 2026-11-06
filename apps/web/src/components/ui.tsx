import type { ReactNode } from "react";

/** Status message. Danger is announced at once (role="alert"); others are polite (role="status"). Always has words, never color alone. */
export function Notice({ tone = "info", title, children }: { tone?: "info" | "warn" | "danger"; title?: string; children?: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`notice notice-${tone}`}>
      {title && <strong className="block">{title}</strong>}
      {children}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

/** Loading state for a whole page: skeleton blocks in the shape of the content, no spinner. */
export function PageSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className={`${wide ? "page-wide" : "page"} stack`} aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-44 w-full" />
    </div>
  );
}

/** An error that says what happened, why, and what to do next. */
export function ErrorBox({ what, why, next }: { what: string; why?: string; next: string }) {
  return (
    <div role="alert" className="notice notice-danger">
      <strong className="block">{what}</strong>
      {why && <span className="block">{why}</span>}
      <span className="block">{next}</span>
    </div>
  );
}

/**
 * Numbered step list with a progress bar. `current` is the 0-based index of the active step (steps.length means all done).
 * The state of each step is spelled out in words ("done", "in progress", "next") so it never depends on color.
 */
export function Progress({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  const pct = Math.round((Math.min(current, steps.length) / steps.length) * 100);
  return (
    <div className="stack-sm" aria-live="polite">
      <div className="bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <ol className="space-y-1 text-sm">
        {steps.map((s, i) => (
          <li key={s} className={i === current ? "font-semibold text-ink" : i < current ? "text-ink-2" : "text-muted"}>
            {i + 1}. {s}
            <span className="text-muted">{i < current ? " (done)" : i === current ? " (in progress)" : " (next)"}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Progressive disclosure for technical details. */
export function Details({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details>
      <summary>{summary}</summary>
      <div className="stack-sm pb-2 text-sm text-ink-2">{children}</div>
    </details>
  );
}
