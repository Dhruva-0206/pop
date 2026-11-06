import { Suspense } from "react";
import { connection } from "next/server";
import { getPop } from "@/lib/pop";
import { readReputation } from "@/lib/reputation";
import { PRODUCT } from "@/lib/product";
import { Notice, Skeleton } from "@/components/ui";
import PayButton from "./PayButton";

const inr = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(n)}`;

export default function Home() {
  return (
    <div className="page-wide stack">
      <p className="text-sm text-warn">
        <strong>TEST MODE</strong> Test USDT has no value. Nothing here is a real payment.
      </p>

      <div className="grid gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-12">
        <div className="garment" role="img" aria-label={`Drawing of the ${PRODUCT.title.toLowerCase()}`} style={{ backgroundImage: "url(/kurta.svg)" }} />

        <div className="stack">
          <section className="stack-sm">
            <p className="text-sm text-ink-2">Kurta Co. · Hand-block cotton</p>
            <h1 className="display text-2xl md:text-3xl">{PRODUCT.title}</h1>
            <p>
              <span className="block text-2xl font-semibold text-ink">{inr(PRODUCT.priceInr)}</span>
              <span className="sr-only">, </span>
              <span className="mono text-sm text-ink-2">{PRODUCT.priceUsdt} test USDT at the demo rate</span>
            </p>
            <p className="prose-width text-ink-2">A demo product from Kurta Co., made up for this hackathon. There is no real kurta and nothing will be shipped.</p>
          </section>

          <section aria-labelledby="protect" className="stack-sm border-t pt-6">
            <h2 id="protect">How your payment is protected</h2>
            <dl className="stack-sm text-ink-2">
              <div>
                <dt className="inline font-semibold text-ink">Your money: </dt>
                <dd className="inline">it waits in a PoP contract, not with us.</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-ink">If we are late: </dt>
                <dd className="inline">if we don&apos;t ship within 3 minutes, you are refunded automatically. Demo timing; real orders use days.</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-ink">When we are paid: </dt>
                <dd className="inline">only after you give the delivery code at your door.</dd>
              </div>
            </dl>
          </section>

          <PayButton />

          <Suspense fallback={<RecordSkeleton />}>
            <Record />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function RecordSkeleton() {
  return (
    <div className="stack-sm border-t pt-6" aria-busy="true" aria-label="Loading our record">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-5 w-3/4" />
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
    <section aria-labelledby="record" className="stack-sm border-t pt-6">
      <h2 id="record">Our record</h2>
      <p>
        <span className="mono block text-3xl font-medium text-ink">
          {rep.completed} of {rep.totalOrders}
        </span>{" "}
        <span className="text-ink-2">
          protected orders completed, {rep.lostDisputes} {Number(rep.lostDisputes) === 1 ? "dispute" : "disputes"} lost
        </span>
      </p>
      <p className="text-ink-2">
        {rep.reviews.count > 0
          ? `${rep.reviews.average?.toFixed(1)} out of 5 from ${rep.reviews.count} ${rep.reviews.count === 1 ? "review" : "reviews"} by verified people.`
          : "No reviews by verified people yet."}
      </p>
      {rep.reviews.latest.map((r) => (
        <blockquote key={r.createdAt} className="border-l-2 border-accent pl-3">
          <span className="font-semibold">{r.rating} out of 5.</span> {r.text}
        </blockquote>
      ))}
      {rep.error && <p className="text-sm text-muted">{rep.error}</p>}
      <p className="text-sm text-muted">This store reads these numbers itself, from the contracts and from Arkiv. A review counts only if it is tied to a real payment.</p>
    </section>
  );
}
