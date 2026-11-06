"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { short, when } from "@/lib/client/format";
import { useConfig } from "@/lib/client/config";
import { TestModeBanner } from "@/components/Banners";
import { Details, ErrorBox, Notice, PageSkeleton } from "@/components/ui";

type Review = { key: string; orderId: string; rating: number; createdAt: number; text: string; owner: string };
type Ok = {
  registered: true;
  handle: string;
  wallet: string;
  handleTier: number;
  counters: {
    totalOrders: number;
    completed: string;
    lostDisputes: string;
    breakdown: { released: number; refunded: number; split: number; open: number } | null;
  };
  reviews: {
    verified: { count: number; average: number | null; items: Review[] };
    dev: { count: number; items: Review[] };
    ignoredNotReadonly: number;
    ignoredUnmatched?: number;
    error?: string;
  };
  attestor: string;
};
type NotOk = { registered: false; handle: string; reason: "unknown" | "banned" };

const TIER = ["Handle not checked", "Handle checked by PoP staff", "Handle proven cryptographically"];
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export default function Verify() {
  const { handle } = useParams<{ handle: string }>();
  const { cfg } = useConfig();
  const [data, setData] = useState<Ok | NotOk | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/verify/${encodeURIComponent(handle)}`, { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 404 || r.ok) setData(await r.json());
        else setErr("The seller record service answered with an error.");
      })
      .catch(() => setErr("The request did not reach the server."));
  }, [handle]);

  if (err) {
    return (
      <div className="page stack">
        <ErrorBox what="Couldn't load this seller record." why={err} next="Refresh the page in a minute. If it keeps failing, don't pay this seller yet." />
      </div>
    );
  }
  if (!data) return <PageSkeleton />;

  if (!data.registered) {
    return (
      <div className="page stack">
        <TestModeBanner cfg={cfg} />
        <div role="alert" className="notice notice-danger stack-sm">
          <h1 className="text-danger">Not a registered seller</h1>
          <p>
            <span className="mono">@{data.handle}</span> is not a registered PoP seller{data.reason === "banned" ? ", and this handle has been banned" : ""}.
          </p>
          <p>Do not pay this seller through PoP. Orders from them cannot be protected.</p>
        </div>
      </div>
    );
  }

  const c = data.counters;
  const completed = Number(c.completed);
  const lost = Number(c.lostDisputes);
  const total = c.totalOrders;
  const rv = data.reviews;
  const b = c.breakdown;

  return (
    <div className="page stack">
      <TestModeBanner cfg={cfg} />

      <section className="stack-sm">
        <h1>@{data.handle}</h1>
        <Notice tone="info" title="Registered PoP seller">
          {TIER[data.handleTier] ?? "Handle check unknown"}.
        </Notice>
      </section>

      <section aria-labelledby="orders" className="card stack-sm">
        <h2 id="orders">Protected orders</h2>
        <p className="text-sm text-muted">Read from the contract, not from the seller.</p>
        <p className="text-2xl font-semibold">
          {completed} of {total} <span className="text-base font-normal text-ink-2">{plural(total, "order completed", "orders completed")}</span>
        </p>
        <p>
          <strong>{lost}</strong> of {total} {plural(total, "was a dispute", "were disputes")} the buyer won.
        </p>
        {b && total > 0 && (
          <p className="text-sm text-ink-2">
            Of {total}: {b.released} paid out, {b.refunded} refunded, {b.split} split, {b.open} still in progress.
          </p>
        )}
        {total === 0 && <p className="text-sm text-ink-2">No protected orders yet.</p>}
      </section>

      <section aria-labelledby="reviews" className="card stack-sm">
        <h2 id="reviews">Reviews from verified people</h2>
        <p className="text-sm text-muted">Stored on Arkiv. One review per person per seller, and only after a completed order.</p>
        {rv.error && <Notice tone="warn">{rv.error} The counts above are still correct.</Notice>}
        {!rv.error && rv.verified.count === 0 && <p className="text-ink-2">No reviews yet. The first buyer to complete an order can leave one.</p>}
        {rv.verified.count > 0 && (
          <>
            <p className="text-2xl font-semibold">
              {rv.verified.average?.toFixed(1)} <span className="text-base font-normal text-ink-2">out of 5, from {rv.verified.count} {plural(rv.verified.count, "review", "reviews")}</span>
            </p>
            <ul className="stack-sm">
              {rv.verified.items.map((r) => (
                <li key={r.key} className="rounded-control border p-3">
                  <p className="font-semibold">{r.rating} out of 5</p>
                  {r.text && <p className="whitespace-pre-wrap break-words">{r.text}</p>}
                  <p className="mono text-xs text-muted">
                    Order #{r.orderId}, {when(r.createdAt)}, entry {short(r.key)}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
        {rv.dev.count > 0 && (
          <Notice tone="warn">
            {rv.dev.count} developer test {plural(rv.dev.count, "review was", "reviews were")} written without a World ID proof. {plural(rv.dev.count, "It is", "They are")} not counted above.
          </Notice>
        )}
        <Details summary="Show details">
          <p>Seller wallet: <span className="mono">{short(data.wallet)}</span></p>
          <p>
            A review counts only if PoP&apos;s writer wallet <span className="mono">{short(data.attestor)}</span> created it, it is locked (read-only) on Arkiv, and its payment is a real order on this contract.
          </p>
          {(rv.ignoredUnmatched ?? 0) > 0 && <p>{rv.ignoredUnmatched} entries ignored because their payment is not a protected order on this contract.</p>}
          {rv.ignoredNotReadonly > 0 && <p>{rv.ignoredNotReadonly} entries ignored because they were not locked.</p>}
          <p>
            <Link href="/proof">See the proof page</Link>
          </p>
        </Details>
      </section>
    </div>
  );
}
