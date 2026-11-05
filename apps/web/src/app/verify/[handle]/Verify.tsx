"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { short, when } from "@/lib/client/format";
import { useConfig } from "@/lib/client/config";
import { TestModeBanner } from "@/components/Banners";

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

const TIER = ["Unverified handle", "Handle checked by PoP staff", "Handle cryptographically proven"];
const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

export default function Verify() {
  const { handle } = useParams<{ handle: string }>();
  const { cfg } = useConfig();
  const [data, setData] = useState<Ok | NotOk | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/verify/${encodeURIComponent(handle)}`, { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 404 || r.ok) setData(await r.json());
        else setErr("Couldn't load this seller record. Try again in a moment.");
      })
      .catch(() => setErr("Couldn't load this seller record. Try again in a moment."));
  }, [handle]);

  if (err) return <main className="mx-auto max-w-md p-6 text-red-700">{err}</main>;
  if (!data) return <main className="mx-auto max-w-md p-6 text-neutral-500">Checking @{handle}…</main>;

  if (!data.registered) {
    return (
      <main className="mx-auto max-w-md space-y-4 p-4">
        <TestModeBanner cfg={cfg} />
        <div className="space-y-2 rounded-xl border-2 border-red-600 bg-red-50 p-5 text-red-900">
          <div className="text-2xl font-bold">Not a registered seller</div>
          <div>
            <span className="font-mono">@{data.handle}</span> is not a registered PoP seller
            {data.reason === "banned" ? ", and this handle has been banned" : ""}.
          </div>
          <div className="text-sm">Do not pay this seller through PoP. Orders from them cannot be protected.</div>
        </div>
      </main>
    );
  }

  const c = data.counters;
  const completed = Number(c.completed);
  const lost = Number(c.lostDisputes);
  const total = c.totalOrders;
  const rv = data.reviews;
  const b = c.breakdown;

  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <TestModeBanner cfg={cfg} />

      <div className="space-y-1 rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4">
        <div className="text-xl font-bold">@{data.handle} is a registered PoP seller</div>
        <div className="text-sm">{TIER[data.handleTier] ?? "Unknown"}</div>
        <div className="font-mono text-xs text-neutral-500">wallet {short(data.wallet)}</div>
      </div>

      <div className="space-y-2 rounded-xl border p-4 text-sm">
        <div className="font-semibold">Protected orders (read from the contract)</div>
        <div>
          <span className="text-lg font-semibold">{completed}</span> of {total} protected order{total === 1 ? "" : "s"} completed
        </div>
        <div>
          <span className="font-semibold">{lost}</span> of {total} were disputes the buyer won
        </div>
        {b && total > 0 && (
          <div className="text-xs text-neutral-600">
            Of {total}: {b.released} paid out · {b.refunded} refunded · {b.split} split · {b.open} still in progress
          </div>
        )}
        {total === 0 && <div className="text-xs text-neutral-600">No protected orders yet.</div>}
      </div>

      <div className="space-y-2 rounded-xl border p-4 text-sm">
        <div className="font-semibold">Reviews from verified humans (read from Arkiv)</div>
        {rv.error && <div className="text-amber-700">{rv.error}</div>}
        {!rv.error && rv.verified.count === 0 && <div className="text-neutral-600">No reviews yet.</div>}
        {rv.verified.count > 0 && (
          <>
            <div>
              <span className="text-lg font-semibold">{rv.verified.average?.toFixed(1)}</span> / 5 from {rv.verified.count} review
              {rv.verified.count === 1 ? "" : "s"}
            </div>
            <div className="text-xs text-neutral-600">
              {rv.verified.count} review{rv.verified.count === 1 ? "" : "s"} from {completed} completed order{completed === 1 ? "" : "s"}.
              One review per person per seller.
            </div>
            <ul className="space-y-2">
              {rv.verified.items.map((r) => (
                <li key={r.key} className="rounded border p-2">
                  <div className="text-amber-600" aria-label={`${r.rating} out of 5`}>
                    {stars(r.rating)}
                  </div>
                  {r.text && <div className="whitespace-pre-wrap">{r.text}</div>}
                  <div className="text-xs text-neutral-500">
                    Order #{r.orderId} · {when(r.createdAt)} · entry {short(r.key)}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        {rv.dev.count > 0 && (
          <div className="rounded border border-dashed border-neutral-400 bg-neutral-50 p-2 text-xs text-neutral-600">
            {rv.dev.count} developer test review{rv.dev.count === 1 ? "" : "s"} written without a World ID proof. Not counted above.
          </div>
        )}
        {(rv.ignoredUnmatched ?? 0) > 0 && (
          <div className="text-xs text-neutral-500">
            {rv.ignoredUnmatched} entries ignored because their payment is not a protected order on this contract.
          </div>
        )}
        {rv.ignoredNotReadonly > 0 && (
          <div className="text-xs text-neutral-500">{rv.ignoredNotReadonly} entries ignored because they were not locked (readonly).</div>
        )}
      </div>

      <div className="text-xs text-neutral-500">
        Reviews are only counted if PoP&apos;s writer wallet {short(data.attestor)} created them and they are locked (readonly) on Arkiv.
      </div>
    </main>
  );
}
