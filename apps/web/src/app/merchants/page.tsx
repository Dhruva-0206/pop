import Link from "next/link";

export const metadata = { title: "For websites" };

// Copied from apps/demo-store (src/lib/pop.ts, src/app/api/checkout/route.ts, src/app/api/pop/webhook/route.ts, src/app/PayButton.tsx), trimmed of logging.
const SNIPPET = `// server: one PoP client with your keys
import { PoP } from "@pop/checkout-sdk/server";
const pop = new PoP({ baseUrl, apiKey, webhookSecret, merchantPk });

// server: POST /api/checkout
const s = await pop.createSession({ title, priceInr, priceUsdt, merchantRef: cartId, returnUrl });
return Response.json({ url: s.url });

// server: POST /api/pop/webhook
const raw = await req.text();
const ev = pop.verifyWebhook(raw, req.headers.get("pop-signature"));
const { state, amount } = await pop.confirmOnChain(ev);

// browser: the Pay with PoP button
import { startPayWithPoP } from "@pop/checkout-sdk/browser";
startPayWithPoP("/api/checkout");`;

// The columns of /api/seller/orders.csv, in order.
const CSV_COLS = [
  "order_id",
  "state",
  "listing_id",
  "title",
  "merchant_ref",
  "buyer_wallet",
  "amount_test_usdt",
  "funded_at_utc",
  "shipped_at_utc",
  "delivered_at_utc",
  "fund_tx",
  "ship_tx",
  "deliver_tx",
  "settle_event",
  "settle_tx",
  "explorer_base",
];

export default function Merchants() {
  return (
    <div className="page-wide stack">
      <section className="stack-sm max-w-prose">
        <h1 className="text-2xl md:text-3xl">Add Pay with PoP to your website</h1>
        <p className="text-lg text-ink-2">Checkout is the easy part. PoP handles what happens after: delivery, refunds, receipts and reviews.</p>
      </section>

      <section className="stack-sm border-t pt-6" aria-labelledby="code">
        <h2 id="code" className="text-xl">
          About 15 lines of integration code
        </h2>
        <pre className="mono overflow-x-auto rounded-card border bg-surface p-4 text-xs leading-5 md:text-sm" tabIndex={0} aria-label="Integration code">
          <code>{SNIPPET}</code>
        </pre>
        <p className="text-ink-2">
          Kurta Co., a separate app, uses exactly these calls.{" "}
          <a className="inline-flex min-h-11 items-center" href="https://kurta-store.vercel.app">
            Open Kurta Co.
          </a>
        </p>
      </section>

      <section className="stack-sm border-t pt-6" aria-labelledby="hooks">
        <h2 id="hooks" className="text-xl">
          Order webhooks
        </h2>
        <p className="max-w-prose text-ink-2">
          <span className="mono">order.funded</span>, <span className="mono">order.shipped</span>, <span className="mono">order.delivered</span>,{" "}
          <span className="mono">order.released</span>, <span className="mono">order.refunded</span>. Each is signed with HMAC-SHA256 in the <span className="mono">PoP-Signature</span>{" "}
          header, and the store checks it against the chain before it trusts it.
        </p>
      </section>

      <section className="stack-sm border-t pt-6" aria-labelledby="receipt">
        <h2 id="receipt" className="text-xl">
          An onchain receipt for every order
        </h2>
        <p className="max-w-prose text-ink-2">Payment, shipping, delivery and payout or refund are transactions on Whitechain Sepolia that anyone can look up.</p>
      </section>

      <section className="stack-sm border-t pt-6" aria-labelledby="refunds">
        <h2 id="refunds" className="text-xl">
          Refunds
        </h2>
        <p className="max-w-prose text-ink-2">
          Automatic when a ship-by or deliver-by deadline is missed, decided by the arbiter in a dispute, and forced for a banned seller. There is no merchant-initiated refund button in
          this version.
        </p>
      </section>

      <section className="stack-sm border-t pt-6" aria-labelledby="csv">
        <h2 id="csv" className="text-xl">
          Export for your accountant
        </h2>
        <p className="max-w-prose text-ink-2">One CSV row per order, with these columns:</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {CSV_COLS.map((c) => (
            <li key={c} className="mono text-sm text-ink-2">
              {c}
            </li>
          ))}
        </ul>
      </section>

      <section className="stack-sm border-t pt-6" aria-labelledby="why">
        <h2 id="why" className="text-xl">
          Why USDT on Whitechain
        </h2>
        <p className="max-w-prose text-ink-2">
          On UPI or cards, a refund depends on the seller agreeing or a slow dispute. Here the refund rule lives in a contract nobody can switch off, and every order has a public receipt.
          Rupee payments would need a licensed on-ramp partner; this demo uses test USDT only.
        </p>
        <p>
          <Link className="inline-flex min-h-11 items-center" href="/proof">
            See the contracts and receipts on the proof page
          </Link>
        </p>
      </section>
    </div>
  );
}
