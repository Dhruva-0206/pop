import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { getPop } from "@/lib/pop";
import { readReputation } from "@/lib/reputation";
import { PRODUCT } from "@/lib/product";
import PayButton from "./PayButton";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col justify-center gap-4 p-6">
      <div className="rounded bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">TEST MODE · test USDT has no value</div>
      <p className="text-sm font-semibold uppercase tracking-wide text-orange-700">Kurta Co.</p>
      <h1 className="text-3xl font-bold">
        {PRODUCT.title} · ₹{PRODUCT.priceInr.toLocaleString("en-IN")}
      </h1>
      <p className="text-neutral-600">{PRODUCT.priceUsdt} test USDT at the demo rate. Ships within 3 minutes (demo timings), or you are refunded automatically.</p>
      <Suspense fallback={<div className="rounded-xl border p-4 text-sm text-neutral-500">Loading our record…</div>}>
        <Record />
      </Suspense>
      <PayButton />
      <Link href="/orders" className="text-sm underline">
        My orders
      </Link>
    </main>
  );
}

/** Our protected-delivery record, read straight from the contracts and from Arkiv with this store's own key. */
async function Record() {
  await connection();
  let rep;
  try {
    rep = await readReputation(getPop().account.address);
  } catch {
    return <div className="rounded-xl border p-4 text-sm text-neutral-500">Our protected record is unavailable right now.</div>;
  }
  return (
    <div className="space-y-1 rounded-xl border p-4 text-sm">
      <div className="font-semibold">Our protected record</div>
      <div>
        {rep.completed} of {rep.totalOrders} protected orders completed · {rep.lostDisputes} disputes lost
      </div>
      <div>
        {rep.reviews.count > 0
          ? `${rep.reviews.average?.toFixed(1)} / 5 from ${rep.reviews.count} verified-human review${rep.reviews.count === 1 ? "" : "s"}`
          : "No verified-human reviews yet"}
      </div>
      {rep.reviews.latest.map((r) => (
        <div key={r.createdAt} className="text-neutral-600">
          {"★".repeat(r.rating)} {r.text}
        </div>
      ))}
      {rep.error && <div className="text-xs text-neutral-500">{rep.error}</div>}
      <div className="text-xs text-neutral-500">Read directly from the contracts and Arkiv by this store. Reviews count only if tied to a real payment.</div>
    </div>
  );
}
