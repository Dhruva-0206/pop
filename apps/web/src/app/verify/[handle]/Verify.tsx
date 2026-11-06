"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { short, when } from "@/lib/client/format";
import { useConfig } from "@/lib/client/config";
import { TestModeBanner } from "@/components/Banners";
import { Details, ErrorBox, Notice, PageSkeleton } from "@/components/ui";
import { Fact, Stamp } from "@/components/receipt";

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
    const banned = data.reason === "banned";
    return (
      <div className="page-wide stack">
        <TestModeBanner cfg={cfg} />
        <div role="alert" className="notice notice-danger stack max-w-2xl p-6">
          <div className="flex flex-wrap items-center gap-3 text-base">
            <Stamp tone="danger">{banned ? "Banned" : "Unknown"}</Stamp>
            <span className="mono text-base">@{data.handle}</span>
          </div>
          <h1 className="text-danger md:text-3xl">Not a registered seller</h1>
          <p className="text-base">
            <span className="mono">@{data.handle}</span> is not a registered PoP seller{banned ? ", and this handle has been banned" : ""}. Orders from this account cannot be protected.
          </p>
          <p className="text-base font-semibold">Do not pay this account through PoP links you did not get from the seller&apos;s own profile.</p>
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
    <div className="page-wide stack">
      <TestModeBanner cfg={cfg} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:gap-12">
        <div className="stack">
          <section className="stack-sm">
            <div className="flex flex-wrap items-center gap-3 text-base">
              <Stamp tone="accent">Registered</Stamp>
              <span className="text-sm text-ink-2">{TIER[data.handleTier] ?? "Handle check unknown"}</span>
            </div>
            <h1 className="break-words md:text-3xl">@{data.handle}</h1>
          </section>

          <section aria-labelledby="orders" className="stack-sm border-t pt-6">
            <h2 id="orders" className="sr-only">
              Protected orders
            </h2>
            <p>
              <span className="mono block text-3xl font-medium text-ink md:text-[3rem] md:leading-[3.5rem]">
                {completed} of {total}
              </span>
              <span className="text-lg text-ink">protected {plural(total, "order", "orders")} completed</span>
            </p>
            <p className="text-sm text-muted">Read from the PoP contract, not from the seller.</p>
            {total === 0 && <p className="text-ink-2">No protected orders yet.</p>}
          </section>

          <section aria-labelledby="reviews" className="stack-sm border-t pt-6">
            <h2 id="reviews">Reviews from verified people</h2>
            <p className="text-sm text-muted">Stored on Arkiv. One review per person per seller, and only after a completed order.</p>
            {rv.error && <Notice tone="warn">{rv.error} The counts above are still correct.</Notice>}
            {!rv.error && rv.verified.count === 0 && <p className="text-ink-2">No reviews yet. The first buyer to complete an order can leave one.</p>}
            {rv.verified.count > 0 && (
              <>
                <p>
                  <span className="mono text-2xl font-medium text-ink">{rv.verified.average?.toFixed(1)}</span>{" "}
                  <span className="text-ink-2">
                    out of 5, from {rv.verified.count} {plural(rv.verified.count, "review", "reviews")}
                  </span>
                </p>
                <ul>
                  {rv.verified.items.map((r) => (
                    <li key={r.key} className="stack-sm border-t py-4">
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
              <p className="text-xs text-muted">
                {rv.dev.count} developer test {plural(rv.dev.count, "review was", "reviews were")} written without a World ID proof. {plural(rv.dev.count, "It is", "They are")} not counted above.
              </p>
            )}
          </section>
        </div>

        <aside className="stack lg:pt-2" aria-label="Order breakdown">
          <dl className="facts">
            <Fact label="All protected orders">{total}</Fact>
            {b && (
              <>
                <Fact label="Seller paid">{b.released}</Fact>
                <Fact label="Refunded to the buyer">{b.refunded}</Fact>
                <Fact label="Split after a report">{b.split}</Fact>
                <Fact label="Still in progress">{b.open}</Fact>
              </>
            )}
            <Fact label="Disputes the buyer won">{lost}</Fact>
          </dl>
          <Details summary="Show details">
            <p>
              Seller wallet: <span className="mono">{short(data.wallet)}</span>
            </p>
            <p>
              A review counts only if PoP&apos;s writer wallet <span className="mono">{short(data.attestor)}</span> created it, it is locked (read-only) on Arkiv, and its payment is a real order on this contract.
            </p>
            {(rv.ignoredUnmatched ?? 0) > 0 && <p>{rv.ignoredUnmatched} entries ignored because their payment is not a protected order on this contract.</p>}
            {rv.ignoredNotReadonly > 0 && <p>{rv.ignoredNotReadonly} entries ignored because they were not locked.</p>}
            <p>
              <Link href="/proof">See the proof page</Link>
            </p>
          </Details>
        </aside>
      </div>
    </div>
  );
}
