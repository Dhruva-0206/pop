import Link from "next/link";

export const metadata = { title: "Returns" };

const RULES = [
  {
    title: "Damaged or wrong item",
    body: "Report a problem inside the report window and paste a link to your unboxing video in the report. You get a full refund.",
  },
  {
    title: "Wrong size you chose",
    body: "The seller sends the right size and you pay the shipping for the exchange.",
  },
  {
    title: "Refused at the door, or you changed your mind",
    body: "If nothing is wrong with the item, the seller keeps the shipping cost both ways and the rest is refunded to you.",
  },
  {
    title: "No unboxing video",
    body: "Without an unboxing video there is no claim for a damaged item.",
  },
];

export default function Returns() {
  return (
    <div className="page stack">
      <section className="stack-sm max-w-prose">
        <h1 className="text-2xl md:text-3xl">Returns</h1>
        <p className="text-lg text-ink-2">
          If something goes wrong with an order, you report it on your order page inside the report window. The PoP arbiter reads the report and decides with these rules: a refund, a release to the seller, or a split.
        </p>
      </section>

      <dl className="stack max-w-prose border-t pt-6">
        {RULES.map((r) => (
          <div key={r.title} className="stack-sm">
            <dt className="font-semibold text-ink">{r.title}</dt>
            <dd className="text-ink-2">{r.body}</dd>
          </div>
        ))}
      </dl>

      <section className="stack-sm max-w-prose border-t pt-6">
        <h2 className="text-xl">Good to know</h2>
        <p className="text-ink-2">
          Unboxing videos are judged by the arbiter off chain. On this test network the report window is minutes; in production it would be days. If the seller never ships or the parcel is never delivered, you do not need to report anything: the refund is automatic.
        </p>
        <p>
          <Link href="/">Back to PoP</Link>
        </p>
      </section>
    </div>
  );
}
