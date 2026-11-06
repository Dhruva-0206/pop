import Link from "next/link";
import { APP_NAME } from "@pop/shared";
import { Fact, Money, Receipt, ReceiptSection, Stamp, Tracker, type TrackStep } from "@/components/receipt";

// The demo listing's own terms (scripts/seed-seller.ts): ₹899, ship within 3 minutes, deliver within 5 minutes of shipping.
const EXAMPLE_STEPS: TrackStep[] = [
  { label: "Paid", state: "done", note: "Done" },
  { label: "Shipped", state: "now" },
  { label: "Delivered", state: "next" },
  { label: "Seller paid", state: "next" },
];

const HOW: { step: string; line: string }[] = [
  { step: "Paid", line: "Your money waits in the PoP contract, not with the seller. Your browser makes a 6-word delivery code and keeps it." },
  { step: "Shipped", line: "The seller must ship by a deadline. If they miss it, anyone can trigger your full refund, with nobody's approval, ours included." },
  { step: "Delivered", line: "The courier asks for your code at the door. The courier can report a refused handover but can never move money." },
  { step: "Seller paid", line: "After a short window to report a problem, the seller gets the price minus a 1% fee. You can then leave one review." },
];

export default function Home() {
  return (
    <div className="page-wide stack">
      <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12">
        <div className="stack max-w-prose">
          <h1 className="text-2xl md:text-3xl">Pay an Instagram seller. If it is not shipped in time, the money comes back to you automatically.</h1>
          <p className="text-lg text-ink-2">
            {APP_NAME} is a protected checkout for sellers on Instagram and WhatsApp. The seller is paid only when you give the delivery code at your door.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className="btn btn-primary" href="/p/jhumka-01">
              Try a test checkout
            </Link>
            <Link className="btn btn-secondary" href="/onboard">
              Sell with {APP_NAME}
            </Link>
          </div>
          <p className="text-sm text-muted">This is a test network. Test USDT has no value and nothing you do here moves real money.</p>
        </div>

        <div className="desk -mx-4 px-4 py-6 sm:mx-0 sm:rounded-card sm:px-6">
          <p className="mb-3 text-sm text-ink-2">Example order: what a buyer sees after paying</p>
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
        <p className="max-w-prose text-ink-2">
          If you report a problem, PoP decides: refund, pay the seller, or split. If nobody decides in time, you are refunded. Reviews need World ID, so each person gets one review per seller.
        </p>
      </section>

      <section className="grid gap-8 border-t pt-8 md:grid-cols-2">
        <div className="stack-sm">
          <h2 className="text-xl">For sellers</h2>
          <p className="text-ink-2">
            Put a short code in your Instagram bio, sign one product offer in your wallet, and share the link or QR code. Your record is public at{" "}
            <span className="mono">/verify/yourhandle</span>, so a new buyer can check it before paying.
          </p>
          <p>
            <Link href="/onboard">Start onboarding</Link>
          </p>
        </div>
        <div className="stack-sm">
          <h2 className="text-xl">Check our work</h2>
          <p className="text-ink-2">Every contract address, transaction, review entry and test count is on one page, with a query you can run yourself.</p>
          <p>
            <Link href="/proof">Open the proof page</Link>
          </p>
        </div>
      </section>

      <section className="stack-sm border-t pt-6" aria-labelledby="tools">
        <h2 id="tools" className="text-base">
          Team tools for the demo
        </h2>
        <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <li>
            <Link className="inline-flex min-h-11 items-center" href="/dashboard">
              Seller dashboard
            </Link>
          </li>
          <li>
            <Link className="inline-flex min-h-11 items-center" href="/courier">
              Simulated courier
            </Link>
          </li>
          <li>
            <Link className="inline-flex min-h-11 items-center" href="/arbiter">
              Arbiter and staff
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
