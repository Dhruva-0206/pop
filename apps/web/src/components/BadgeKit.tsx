"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

type Theme = "light" | "dark";
type Tab = "website" | "instagram" | "link";
const TABS: { id: Tab; label: string }[] = [
  { id: "website", label: "Website" },
  { id: "instagram", label: "Instagram bio" },
  { id: "link", label: "Link only" },
];

/** Clipboard with a textarea fallback for browsers that block the async API (plain http, older WebViews). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    ta.remove();
    return ok;
  }
}

function CopyButton({ text, label, what, onCopied }: { text: string; label: string; what: string; onCopied: (msg: string) => void }) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className="btn btn-secondary"
      disabled={!text}
      onClick={async () => {
        const ok = await copyText(text);
        onCopied(ok ? `${what} copied.` : `Could not copy. Select the ${what.toLowerCase()} and copy it by hand.`);
        if (!ok) return;
        setDone(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setDone(false), 2000);
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

/** One copyable value: a label, the text in a read-only box, and its Copy button. Without `onCopied` it announces the result itself. */
export function CopyField({ id, label, value, copyLabel, what, rows = 1, onCopied }: { id: string; label: string; value: string; copyLabel: string; what: string; rows?: number; onCopied?: (m: string) => void }) {
  const [said, setSaid] = useState("");
  const report =
    onCopied ??
    ((m: string) => {
      setSaid("");
      setTimeout(() => setSaid(m), 30);
    });
  return (
    <div className="stack-sm">
      <label className="text-sm font-semibold text-ink" htmlFor={id}>
        {label}
      </label>
      {rows > 1 ? (
        <textarea id={id} readOnly rows={rows} className="field mono text-sm" value={value} onFocus={(e) => e.currentTarget.select()} />
      ) : (
        <input id={id} readOnly className="field mono text-sm" value={value} onFocus={(e) => e.currentTarget.select()} />
      )}
      <div>
        <CopyButton text={value} label={copyLabel} what={what} onCopied={report} />
      </div>
      {!onCopied && (
        <p aria-live="polite" className="sr-only">
          {said}
        </p>
      )}
    </div>
  );
}

/**
 * "Your badge": live preview (light or dark), then the ways to show it: a website snippet, an Instagram bio line, or the bare record link.
 * Every link goes to the seller's public record on this site, never to a payment, so a copied picture proves nothing on its own.
 */
export function BadgeKit({ handle, payLink, qr, level = 2 }: { handle: string; payLink?: string; qr?: string; level?: 2 | 3 }) {
  const Heading = level === 2 ? "h2" : "h3";
  const [origin, setOrigin] = useState("");
  const [theme, setTheme] = useState<Theme>("light");
  const [tab, setTab] = useState<Tab>("website");
  const [said, setSaid] = useState("");
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ website: null, instagram: null, link: null });

  useEffect(() => setOrigin(window.location.origin), []);

  const badgeSrc = `/api/badge/${handle}${theme === "dark" ? "?theme=dark" : ""}`;
  const record = origin ? `${origin}/verify/${handle}` : "";
  const snippet = origin
    ? `<a href="${record}?from=badge"><img src="${origin}${badgeSrc}" alt="Protected by PoP: @${handle}'s order record" height="60"></a>`
    : "";
  const bio = record ? `Protected by PoP · check my record: ${record}` : "";
  const announce = (m: string) => {
    // Clear first so the same message is announced again on a second copy.
    setSaid("");
    setTimeout(() => setSaid(m), 30);
  };

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    const i = TABS.findIndex((t) => t.id === tab);
    const next = e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[TABS[next].id]?.focus();
  }

  return (
    <section aria-labelledby="badge-kit" className="stack border-t pt-6">
      <div className="stack-sm">
        <Heading id="badge-kit" className="text-lg">
          Your badge
        </Heading>
        <p className="text-ink-2">It shows your live record from the PoP contract and links buyers to your public record page.</p>
      </div>

      <div className="stack-sm">
        <div role="group" aria-label="Badge colour" className="flex gap-2">
          {(["light", "dark"] as const).map((t) => (
            <button key={t} type="button" aria-pressed={theme === t} className={`btn ${theme === t ? "btn-primary" : "btn-secondary"}`} onClick={() => setTheme(t)}>
              {t === "light" ? "Light" : "Dark"}
            </button>
          ))}
        </div>
        <div className={`flex min-h-24 items-center justify-center rounded-card border p-3 sm:p-4 ${theme === "dark" ? "bg-ink" : "bg-bg"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a live SVG from our own route, the same file sellers embed */}
          <img key={badgeSrc} src={badgeSrc} alt={`Badge preview, ${theme}: Protected by PoP, @${handle}'s order record`} height={60} className="h-auto max-h-[60px] w-auto max-w-full" />
        </div>
      </div>

      <div className="stack-sm">
        <div role="tablist" aria-label="Where to show your badge" className="flex flex-wrap gap-2 border-b pb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`badge-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`badge-panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className={`btn ${tab === t.id ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setTab(t.id)}
              onKeyDown={onTabKey}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "website" && (
          <div role="tabpanel" id="badge-panel-website" aria-labelledby="badge-tab-website" className="stack-sm pt-2">
            <p className="text-sm text-ink-2">Paste this into your site&apos;s HTML where buyers will see it, for example next to the price.</p>
            <CopyField id="badge-snippet" label="Badge code" value={snippet} copyLabel="Copy code" what="Badge code" rows={4} onCopied={announce} />
          </div>
        )}

        {tab === "instagram" && (
          <div role="tabpanel" id="badge-panel-instagram" aria-labelledby="badge-tab-instagram" className="stack pt-2">
            <p className="text-sm text-ink-2">Instagram cannot show pictures in a bio. Put the record line in your bio, and the payment QR in a story highlight.</p>
            <CopyField id="badge-bio" label="Line for your bio" value={bio} copyLabel="Copy bio line" what="Bio line" rows={3} onCopied={announce} />
            {payLink && <CopyField id="badge-paylink" label="Your payment link" value={payLink} copyLabel="Copy payment link" what="Payment link" onCopied={announce} />}
            {/* eslint-disable-next-line @next/next/no-img-element -- a data URL made in the browser */}
            {qr && <img src={qr} alt="QR code for your payment link" width={160} height={160} />}
          </div>
        )}

        {tab === "link" && (
          <div role="tabpanel" id="badge-panel-link" aria-labelledby="badge-tab-link" className="stack-sm pt-2">
            <p className="text-sm text-ink-2">Use this anywhere you can put a link: WhatsApp, a website footer, an email signature.</p>
            <CopyField id="badge-record" label="Your public record" value={record} copyLabel="Copy link" what="Record link" onCopied={announce} />
          </div>
        )}
      </div>

      <p aria-live="polite" className="text-sm text-ink-2 min-h-5">
        {said}
      </p>
      <p className="text-sm text-ink-2">Anyone can copy a picture. Buyers should click the badge: the record only counts on this site&apos;s address, with your handle.</p>
      <p>
        <a href={`/verify/${handle}`}>See your public record</a>
      </p>
    </section>
  );
}
