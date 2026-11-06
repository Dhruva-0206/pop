import type { ReactNode } from "react";

/**
 * Presentational pieces of the receipt (see docs/design-direction.md). No data fetching and no state here:
 * pages pass the values they already have. Works in server and client components.
 */

export type StampTone = "ink" | "accent" | "warn" | "danger" | "muted";

/** The order status as a stamp: one word in a bordered box. The word is the signal; colour only repeats it. */
export function Stamp({ children, tone = "ink" }: { children: ReactNode; tone?: StampTone }) {
  return <span className={`stamp stamp-${tone}`}>{children}</span>;
}

/** Rupees first and large, test USDT second and smaller. */
export function Money({ inr, usdt, size = "lg" }: { inr: string; usdt?: string; size?: "lg" | "md" }) {
  return (
    <span className="money">
      <span className={size === "lg" ? "money-inr text-2xl" : "money-inr text-lg"}>{inr}</span>
      {usdt && (
        <>
          {/* visually hidden: keeps "₹899" and "1.00 test USDT" apart in page text and for screen readers */}
          <span className="sr-only">, </span>
          <span className="money-usdt">{usdt} test USDT</span>
        </>
      )}
    </span>
  );
}

/** A receipt line: label left, value right, in tabular figures. */
export function Fact({ label, children, mono = true }: { label: ReactNode; children: ReactNode; mono?: boolean }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd className={mono ? "mono" : undefined}>{children}</dd>
    </div>
  );
}

export type TrackStep = { label: string; state: "done" | "now" | "next" | "skipped"; note?: string };

const SR: Record<TrackStep["state"], string> = { done: "done", now: "current step", next: "not yet", skipped: "skipped" };

/**
 * Four-step tracker. Done: filled square and a time. Now: filled square and the word "Now". Next: outlined square.
 * Skipped: outlined square and the word "Skipped". The shape and the word carry the meaning, never the colour alone.
 */
export function Tracker({ steps, label = "Order progress" }: { steps: TrackStep[]; label?: string }) {
  return (
    <ol className="tracker" aria-label={label}>
      {steps.map((s, i) => (
        <li key={i} className={`track track-${s.state}`} aria-current={s.state === "now" ? "step" : undefined}>
          <span className="track-mark" aria-hidden="true" />
          <span className="track-label">{s.label}</span>
          <span className="track-note">
            {s.state === "now" ? "Now" : s.state === "skipped" ? "Skipped" : s.note ?? ""}
            <span className="sr-only"> ({SR[s.state]})</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** mm:ss in IBM Plex Mono. Screen readers get words; it does not announce every second. */
export function Countdown({ seconds, doneText }: { seconds: number; doneText: string }) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <span className={seconds > 0 ? "countdown" : "block text-xl font-semibold text-ink"} aria-label={seconds > 0 ? `${m} minutes ${s} seconds left` : doneText}>
      {seconds > 0 ? `${m}:${String(s).padStart(2, "0")}` : doneText}
    </span>
  );
}

/** The paper column. Sections inside are separated by hairlines; `TearLine` marks the tear-off part. */
export function Receipt({ children, label }: { children: ReactNode; label: string }) {
  return (
    <article className="receipt" aria-label={label}>
      {children}
    </article>
  );
}

export function ReceiptSection({ children, className = "", labelledBy }: { children: ReactNode; className?: string; labelledBy?: string }) {
  return (
    <section className={`receipt-section ${className}`} aria-labelledby={labelledBy}>
      {children}
    </section>
  );
}

export function TearLine() {
  return <div className="tear" aria-hidden="true" />;
}
