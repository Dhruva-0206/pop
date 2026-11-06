import { Suspense } from "react";
import { connection } from "next/server";
import { getPop } from "@/lib/pop";
import { readReputation } from "@/lib/reputation";
import { PRODUCT } from "@/lib/product";
import { Notice, Skeleton } from "@/components/ui";
import PayButton from "./PayButton";

export default function Home() {
  return (
    <div className="page stack">
      <Notice tone="warn">
        <strong>TEST MODE</strong> Test USDT has no value. Nothing here is a real payment.
      </Notice>

      <section className="stack-sm">
        <h1>{PRODUCT.title}</h1>
        <p className="text-2xl font-semibold">
          ₹{PRODUCT.priceInr.toLocaleString("en-IN")} <span className="text-base font-normal text-ink-2">({PRODUCT.priceUsdt} test USDT at the demo rate)</span>
        </p>
        <p className="prose-width text-ink-2">A demo product from Kurta Co., made up for this hackathon. There is no real kurta and nothing will be shipped.</p>
      </section>

      <section aria-labelledby="protect" className="card stack-sm">
        <h2 id="protect">How your payment is protected</h2>
        <ul className="list-disc space-y-1 pl-5 text-ink-2">
          <li>Your payment goes into a PoP contract, not to us.</li>
          <li>If we don&apos;t ship within 3 minutes, you are refunded automatically. (Demo timing. Real orders use days.)</li>
          <li>We are paid only when you give the delivery code at your door.</li>
        </ul>
      </section>

      <Suspense fallback={<Skeleton className="h-32 w-full" />}>
        <Record />
      </Suspense>

      <PayButton />
    </div>
  );
}

/** Our protected-delivery record, read straight from the contracts and from Arkiv with this store's own key. */
async function Record() {
  await connection();
  let rep;
  try {
    rep = await readReputation(getPop().account.address);
  } catch {
    return <Notice tone="warn">Our protected record is unavailable right now. You can still check it at PoP&apos;s proof page.</Notice>;
  }
  return (
    <section aria-labelledby="record" className="card stack-sm">
      <h2 id="record">Our record</h2>
      <p>
        <strong>{rep.completed}</strong> of {rep.totalOrders} protected orders completed, <strong>{rep.lostDisputes}</strong> disputes lost.
      </p>
      <p>
        {rep.reviews.count > 0
          ? `${rep.reviews.average?.toFixed(1)} out of 5 from ${rep.reviews.count} ${rep.reviews.count === 1 ? "review" : "reviews"} by verified people.`
          : "No reviews by verified people yet."}
      </p>
      {rep.reviews.latest.map((r) => (
        <p key={r.createdAt} className="rounded-control border p-3">
          <span className="font-semibold">{r.rating} out of 5.</span> {r.text}
        </p>
      ))}
      {rep.error && <p className="text-sm text-muted">{rep.error}</p>}
      <p className="text-sm text-muted">This store reads these numbers itself, from the contracts and from Arkiv. A review counts only if it is tied to a real payment.</p>
    </section>
  );
}
