import Link from "next/link";
import { APP_NAME } from "@pop/shared";

const STEPS = [
  { title: "You pay", body: "Your payment goes into a PoP contract, not to the seller. Your browser creates a 6-word delivery code and keeps it. Only a fingerprint of the code is stored." },
  { title: "The seller must ship by a deadline", body: "If they miss it, anyone can trigger a full refund. It needs nobody's approval, ours included." },
  { title: "The courier asks for your code at the door", body: "When the code is entered, the order counts as delivered. The courier can report a refused handover, but can never release or refund money." },
  { title: "You have a short window to report a problem", body: "If you report one, PoP decides: refund, pay the seller, or split. If nobody decides in time, you are refunded." },
  { title: "The seller is paid, and you can review", body: "After the window the seller receives the price minus a 1% fee. You can then leave one review, and World ID checks that you are a real person. One review per person per seller." },
];

export default function Home() {
  return (
    <div className="page-wide stack">
      <section className="stack max-w-prose">
        <h1 className="text-2xl md:text-3xl">Pay an Instagram seller. If the order doesn&apos;t arrive, you get your money back.</h1>
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
      </section>

      <section className="stack">
        <h2 className="text-xl">How an order works</h2>
        <ol className="stack-sm max-w-prose">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card">
              <h3>
                {i + 1}. {s.title}
              </h3>
              <p className="text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="stack max-w-prose">
        <h2 className="text-xl">For sellers</h2>
        <p className="text-ink-2">
          Put a short code in your Instagram bio, sign one product offer in your wallet, and share the link or QR code. Your record (orders completed, disputes lost, reviews) is public
          at <span className="mono">/verify/yourhandle</span>, so a new buyer can see it before paying.
        </p>
        <p>
          <Link href="/onboard">Start onboarding</Link>
        </p>
      </section>

      <section className="stack max-w-prose">
        <h2 className="text-xl">Check our work</h2>
        <p className="text-ink-2">Every contract address, transaction, review entry and test count is on one page, with a query you can run yourself.</p>
        <p>
          <Link href="/proof">Open the proof page</Link>
        </p>
      </section>

      <section className="stack-sm max-w-prose border-t pt-6">
        <h2 className="text-base">Team tools for the demo</h2>
        <ul className="space-y-1 text-sm">
          <li>
            <Link href="/dashboard">Seller dashboard</Link>
          </li>
          <li>
            <Link href="/courier">Simulated courier</Link>
          </li>
          <li>
            <Link href="/arbiter">Arbiter and staff</Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
