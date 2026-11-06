import Link from "next/link";
import { Fact, Money, Receipt, ReceiptSection, Stamp, Tracker, type TrackStep } from "@/components/receipt";

// The demo listing's own terms (scripts/seed-seller.ts): ₹899, ship within 3 minutes, deliver within 5 minutes of shipping.
const EXAMPLE_STEPS: TrackStep[] = [
  { label: "Paid", state: "done", note: "Done" },
  { label: "Shipped", state: "now" },
  { label: "Delivered", state: "next" },
  { label: "Seller paid", state: "next" },
];

const RULES: { title: string; line: string }[] = [
  { title: "No parcel, no payout.", line: "The seller is paid only after the customer's 6-word delivery code is entered at the door, or the customer confirms it arrived. If there is a dispute, PoP's arbiter decides." },
  { title: "Late means refunded.", line: "Miss the ship-by or deliver-by time and anyone can trigger a full refund. Not even PoP can stop it." },
  {
    title: "No review without a receipt.",
    line: "Only a buyer with a completed order can review, once per person per shop. World ID checks it's a real, unique person, and the review is stored on Arkiv, where any app can read it and nobody can edit it.",
  },
];

const COMPARE: { row: string; cod: string; pop: string }[] = [
  { row: "Buyer pays", cod: "At the door, in cash", pop: "Upfront, in USDT" },
  { row: "If the parcel never comes", cod: "Buyer keeps their money", pop: "Full refund, automatically" },
  { row: "If the buyer refuses the parcel", cod: "Seller pays shipping both ways", pop: "The buyer has already paid; a refusal goes to a dispute" },
  { row: "Seller's track record", cod: "Nothing a buyer can check", pop: "Public, built from paid orders only" },
];

const HOW: { step: string; line: string }[] = [
  { step: "Paid", line: "The customer pays in USDT. The payment is locked to this order's rules, not sent to the seller yet, and their browser makes a 6-word delivery code." },
  { step: "Shipped", line: "The seller ships before the ship-by time. If they don't, anyone can trigger the refund." },
  { step: "Delivered", line: "The customer reads the code to the courier at the door. The courier can never move money." },
  { step: "Seller paid", line: "After a short window to report a problem, the seller is paid, minus a 1% fee. The customer can leave one review." },
];

export default function Home() {
  return (
    <div className="page-wide stack">
      <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12">
        <div className="stack max-w-prose">
          <h1 className="text-2xl md:text-3xl">Checkout is the easy part. PoP handles what happens after.</h1>
          <p className="text-lg text-ink-2">
            A USDT checkout for sellers on Instagram, WhatsApp, Facebook and small websites. Your customer pays upfront. You&apos;re paid when the parcel reaches their door. Miss a deadline
            and they&apos;re refunded automatically.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className="btn btn-primary" href="/onboard">
              Start selling
            </Link>
            <Link className="btn btn-secondary" href="/merchants">
              Add it to your website
            </Link>
          </div>
          <p>
            <Link className="inline-flex min-h-11 items-center" href="/p/jhumka-01">
              Or try it as a buyer
            </Link>
          </p>
          <p className="text-sm text-muted">This is a test network. Test USDT has no value and nothing you do here moves real money.</p>
        </div>

        <div className="desk -mx-4 px-4 py-6 sm:mx-0 sm:rounded-card sm:px-6">
          <p className="mb-3 text-sm text-ink-2">What your customer sees after paying</p>
          <Receipt label="Example order receipt">
            <ReceiptSection className="stack-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="mono pt-1 text-sm text-ink-2">Example order</p>
                <Stamp>Shipped</Stamp>
              </div>
              <p className="text-lg font-semibold text-ink">Silver jhumkas (oxidised, handmade)</p>
              <p className="text-sm text-ink-2">Sold by @meera.jewels</p>
              <Money inr="₹899" usdt="1.00" />
            </ReceiptSection>
            <ReceiptSection className="stack-sm">
              <Tracker steps={EXAMPLE_STEPS} label="Example order progress" />
              <p className="text-sm text-ink-2">If it is not delivered within 5 minutes of shipping, the buyer is refunded automatically.</p>
            </ReceiptSection>
            <ReceiptSection>
              <dl className="facts">
                <Fact label="Ship by">3 min after paying</Fact>
                <Fact label="Deliver by">5 min after shipping</Fact>
                <Fact label="Fee">1% from the seller</Fact>
              </dl>
            </ReceiptSection>
          </Receipt>
        </div>
      </section>

      <section className="stack border-t pt-8" aria-labelledby="rules">
        <h2 id="rules" className="text-xl">
          Three rules every order follows
        </h2>
        <ol className="stack max-w-prose">
          {RULES.map((r, i) => (
            <li key={r.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2">
              <span className="mono text-lg text-ink-2">{i + 1}.</span>
              <div className="stack-sm">
                <p className="text-lg font-semibold text-ink">{r.title}</p>
                <p className="text-ink-2">{r.line}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="stack border-t pt-8" aria-labelledby="cod">
        <h2 id="cod" className="text-xl">
          Better than cash on delivery, for both sides
        </h2>
        <div>
          <table className="w-full table-fixed border-collapse text-left text-sm md:text-base">
            <thead>
              <tr className="border-b">
                <td className="w-[34%] py-2 pr-2 md:pr-4" />
                <th scope="col" className="py-2 pr-2 font-semibold md:pr-4">
                  Cash on delivery
                </th>
                <th scope="col" className="py-2 font-semibold">
                  PoP
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((c) => (
                <tr key={c.row} className="border-b align-top">
                  <th scope="row" className="py-3 pr-2 font-semibold text-ink md:pr-4">
                    {c.row}
                  </th>
                  <td className="py-3 pr-2 text-ink-2 md:pr-4">{c.cod}</td>
                  <td className="py-3 text-ink">{c.pop}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="max-w-prose text-sm text-muted">
          In India, about 60 to 65% of online orders are cash on delivery, and 25 to 30% of those come back undelivered (ET Prime Research, 2024).
        </p>
      </section>

      <section className="grid gap-8 border-t pt-8 md:grid-cols-2">
        <div className="stack-sm">
          <h2 className="text-xl">Sell anywhere with one link</h2>
          <p className="text-ink-2">
            Share a payment link or QR in your Instagram bio, a WhatsApp chat, a Facebook post or a Telegram channel. Buyers can check your public record before they pay.
          </p>
          <div>
            <Link className="btn btn-primary" href="/onboard">
              Start selling
            </Link>
          </div>
        </div>
        <div className="stack-sm">
          <h2 className="text-xl">On your own website</h2>
          <p className="text-ink-2">
            Add Pay with PoP in about 15 lines of integration code. You get signed order webhooks, an onchain receipt for every order and a CSV export for your accountant.
          </p>
          <p>
            <Link className="inline-flex min-h-11 items-center" href="/merchants">
              See how it works
            </Link>
          </p>
        </div>
      </section>

      <section className="stack border-t pt-8" aria-labelledby="how">
        <h2 id="how" className="text-xl">
          How an order works
        </h2>
        <div className="hidden md:block">
          <Tracker steps={HOW.map((h) => ({ label: h.step, state: "done" as const }))} label="The four steps of an order" />
        </div>
        <ol className="grid gap-4 md:grid-cols-4 md:gap-0">
          {HOW.map((h, i) => (
            <li key={h.step} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2 md:block md:pr-6">
              <span className="mono text-sm text-ink-2 md:hidden">{i + 1}.</span>
              <p className="text-ink-2">
                <strong className="font-semibold text-ink md:sr-only">{h.step}: </strong>
                {h.line}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="stack-sm border-t pt-8">
        <h2 className="text-xl">Check our work</h2>
        <p className="max-w-prose text-ink-2">Every contract address, transaction, review entry and test count is on one page, with a query you can run yourself.</p>
        <p>
          <Link className="inline-flex min-h-11 items-center" href="/proof">
            Open the proof page
          </Link>
        </p>
      </section>
    </div>
  );
}
