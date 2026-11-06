"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { decodeEventLog, erc20Abi, type Hex } from "viem";
import { checkoutAbi, deliveryCodeHash, termsHash, type Terms } from "@pop/shared";
import { publicClientOf, useConfig } from "@/lib/client/config";
import { getTestAccount, saveCode, walletOf } from "@/lib/client/wallet";
import { newDeliveryCode } from "@/lib/client/code";
import { inr, short, usdt, when } from "@/lib/client/format";
import { TestModeBanner } from "@/components/Banners";
import { Details, ErrorBox, Notice, PageSkeleton } from "@/components/ui";
import { Checklist } from "@/components/Checklist";
import { Money } from "@/components/receipt";
import { friendlyPayError } from "@/lib/client/errors";
import { orderRegisterMessage } from "@/lib/messages";

type ListingResp = {
  listing: {
    id: string;
    title: string;
    imageUrl?: string;
    sellerHandle: string;
    sellerWallet: string;
    priceUnits: string;
    priceInr: number;
    terms: Terms;
    termsHash: string;
    offer: Record<string, string | number>;
    offerSig: Hex;
  };
  termsHashMatches: boolean;
  sellerStanding: { active: boolean; handleTier: number; completed: string; lostDisputes: string };
};

const TIER = ["Unverified handle", "Handle checked by PoP staff", "Handle cryptographically proven"];

export default function Checkout() {
  const { listingId } = useParams<{ listingId: string }>();
  const router = useRouter();
  const { cfg } = useConfig();
  const [data, setData] = useState<ListingResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [buyer, setBuyer] = useState<string>("");
  const [bal, setBal] = useState<{ usdt: bigint; gas: bigint } | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [step, setStep] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    fetch(`/api/listings/${listingId}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? setData(await r.json()) : setErr("This product link isn't active.")))
      .catch(() => setErr("Couldn't load this product."));
  }, [listingId]);

  const refreshBalance = useCallback(async () => {
    if (!cfg) return;
    const acct = getTestAccount(cfg, "buyer")!;
    setBuyer(acct.address);
    const pc = publicClientOf(cfg);
    const [u, g] = await Promise.all([
      pc.readContract({ address: cfg.token, abi: erc20Abi, functionName: "balanceOf", args: [acct.address] }),
      pc.getBalance({ address: acct.address }),
    ]);
    setBal({ usdt: u, gas: g });
  }, [cfg]);

  useEffect(() => {
    refreshBalance().catch(() => {});
  }, [refreshBalance]);

  async function pay() {
    if (!cfg || !data) return;
    if (!form.name || form.phone.length < 5 || form.address.length < 5) {
      setTried(true);
      setStep("");
      return;
    }
    setBusy(true);
    try {
      const l = data.listing;
      const price = BigInt(l.priceUnits);
      const pc = publicClientOf(cfg);
      const acct = getTestAccount(cfg, "buyer")!;
      const w = walletOf(cfg, acct);

      // 1) Test wallet top-up (TEST MODE only).
      if (!bal || bal.usdt < price || bal.gas === BigInt(0)) {
        setStep("Adding test funds to your test wallet");
        const f = await fetch("/api/faucet", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ address: acct.address }),
        });
        if (!f.ok) throw new Error((await f.json()).error ?? "Test faucet failed");
        await refreshBalance();
      }

      // 2) The delivery code is created here, in your browser. Only its hash goes on-chain.
      const words = newDeliveryCode();
      const codeHash = deliveryCodeHash(cfg.chainId, cfg.checkout, words);
      sessionStorage.setItem("pop:pending-code", words);

      // 3) Approve exactly the price, then pay the seller-signed offer.
      const allowance = await pc.readContract({
        address: cfg.token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [acct.address, cfg.checkout],
      });
      if (allowance < price) {
        setStep("Step 1 of 2: allowing PoP to take exactly this amount");
        const a = await w.writeContract({
          address: cfg.token,
          abi: erc20Abi,
          functionName: "approve",
          args: [cfg.checkout, price],
          account: acct,
          chain: w.chain,
        });
        await pc.waitForTransactionReceipt({ hash: a });
      }
      setStep("Step 2 of 2: paying the seller's offer");
      const o = l.offer;
      const offer = {
        seller: o.seller as Hex,
        listingId: o.listingId as Hex,
        termsHash: o.termsHash as Hex,
        externalRef: o.externalRef as Hex,
        price: BigInt(o.price),
        shipWithin: Number(o.shipWithin),
        deliverWithin: Number(o.deliverWithin),
        maxUnits: Number(o.maxUnits),
        validUntil: BigInt(o.validUntil),
        version: BigInt(o.version),
      };
      const tx = await w.writeContract({
        address: cfg.checkout,
        abi: checkoutAbi,
        functionName: "pay",
        args: [offer, l.offerSig, codeHash],
        account: acct,
        chain: w.chain,
      });
      const rc = await pc.waitForTransactionReceipt({ hash: tx });
      if (rc.status !== "success") throw new Error("Payment failed");
      let orderId = "";
      for (const log of rc.logs) {
        try {
          const ev = decodeEventLog({ abi: checkoutAbi, data: log.data, topics: log.topics });
          if (ev.eventName === "OrderFunded") orderId = ev.args.orderId.toString();
        } catch {
          /* other contract's log */
        }
      }
      if (!orderId) throw new Error("Paid, but couldn't read the order number");
      saveCode(cfg, orderId, words);
      sessionStorage.removeItem("pop:pending-code");

      // 4) Server reads the receipt itself and stores the order (delivery details encrypted).
      setStep("Saving your order");
      const signature = await acct.signMessage({ message: orderRegisterMessage(tx, form) });
      const reg = await fetch("/api/orders/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txHash: tx, signature, delivery: form }),
      });
      if (!reg.ok) throw new Error(`Paid (order #${orderId}), but saving delivery details failed. Open /o/${orderId}.`);
      router.push(`/o/${orderId}?new=1`);
    } catch (e) {
      setStep(friendlyPayError(e));
    } finally {
      setBusy(false);
    }
  }

  if (err) {
    return (
      <div className="page stack">
        <ErrorBox what="This product link isn't active." why={err === "This product link isn't active." ? "The seller may have removed it, or the link is mistyped." : undefined} next="Ask the seller for a new link." />
      </div>
    );
  }
  if (!data || !cfg) return <PageSkeleton />;
  const l = data.listing;
  const s = data.sellerStanding;
  const shipH = Math.round(l.terms.shipWithinSec / 60);
  const delH = Math.round(l.terms.deliverWithinSec / 60);
  const recomputed = termsHash(l.terms);
  const priceUsdt = usdt(l.priceUnits, cfg.tokenDecimals);
  const done = Number(s.completed);
  const lost = Number(s.lostDisputes);
  const stage = !busy ? -1 : step.startsWith("Adding") ? 0 : step.startsWith("Step 1") ? 1 : step.startsWith("Step 2") ? 2 : 3;
  const bad = {
    name: tried && !form.name.trim(),
    phone: tried && form.phone.length < 5,
    address: tried && form.address.length < 5,
  };

  return (
    <div className="page-wide stack">
      <TestModeBanner cfg={cfg} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-x-12">
        <div className="stack lg:col-start-1">
          <section className="flex items-start gap-4" aria-labelledby="product">
            {l.imageUrl && <div className="product-pic" role="img" aria-label={`Picture of ${l.title}`} style={{ backgroundImage: `url(${JSON.stringify(l.imageUrl)})` }} />}
            <div className="stack-sm min-w-0">
              <p className="text-sm text-ink-2">
                Sold by <Link href={`/verify/${l.sellerHandle}`}>@{l.sellerHandle}</Link>
              </p>
              <h1 id="product">{l.title}</h1>
              <Money inr={inr(l.priceInr)} usdt={priceUsdt} />
            </div>
          </section>

          {s.active ? (
            <p className="text-ink-2">
              <strong className="text-ink">@{l.sellerHandle}</strong>: {done} protected {done === 1 ? "order" : "orders"} completed, {lost} {lost === 1 ? "dispute" : "disputes"} lost.{" "}
              {TIER[s.handleTier] ?? "Unknown handle check"}. <Link href={`/verify/${l.sellerHandle}`}>See the record</Link>
            </p>
          ) : (
            <Notice tone="danger" title="Not an active PoP seller">
              This seller is unknown or banned. Do not pay.
            </Notice>
          )}

        </div>

        <aside className="stack lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-1" aria-labelledby="protect">
          <div className="stack-sm">
            <h2 id="protect">How this payment is protected</h2>
            <dl className="rules">
              <div>
                <dt>Ship by</dt>
                <dd>
                  Within {shipH} {shipH === 1 ? "minute" : "minutes"} of paying. If not, you are refunded automatically.
                </dd>
              </div>
              <div>
                <dt>Deliver by</dt>
                <dd>
                  Within {delH} {delH === 1 ? "minute" : "minutes"} of shipping. If not, you are refunded automatically.
                </dd>
              </div>
              <div>
                <dt>Seller paid when</dt>
                <dd>You give your delivery code at the door and the short window to report a problem has passed.</dd>
              </div>
            </dl>
            <p className="text-sm text-muted">Demo timings are in minutes. Real orders use days.</p>
          </div>
          <Details summary="Show details">
            <p>
              Terms fingerprint <span className="mono">{short(l.termsHash)}</span>: {recomputed === l.termsHash ? "matches the terms above." : "DOES NOT MATCH the terms above. Do not pay."}
            </p>
            <p>
              Your test wallet: <span className="mono">{short(buyer)}</span>, holding {bal ? `${usdt(bal.usdt, cfg.tokenDecimals)} test USDT` : "checking balance"}.
            </p>
            <p>This offer is valid until {when(Number(l.offer.validUntil))}.</p>
          </Details>
        </aside>

        <div className="lg:col-start-1">
          <form
            className="stack"
            aria-labelledby="deliver"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              pay();
            }}
          >
            <div className="border-t pt-6">
              <h2 id="deliver">Delivery details</h2>
              <p className="hint">Only the seller can read these. They are stored encrypted.</p>
            </div>
            <div>
              <label className="label" htmlFor="f-name">
                Full name
              </label>
              <input id="f-name" className="field" autoComplete="name" aria-invalid={bad.name} aria-describedby={bad.name ? "e-name" : undefined} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              {bad.name && (
                <p id="e-name" className="hint text-danger">
                  Enter your name so the courier knows who to ask for.
                </p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="f-phone">
                Phone number
              </label>
              <input id="f-phone" className="field" type="tel" inputMode="tel" autoComplete="tel" aria-invalid={bad.phone} aria-describedby={bad.phone ? "e-phone" : undefined} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              {bad.phone && (
                <p id="e-phone" className="hint text-danger">
                  Enter a phone number the courier can call.
                </p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="f-address">
                Delivery address
              </label>
              <textarea id="f-address" className="field" rows={3} autoComplete="street-address" aria-invalid={bad.address} aria-describedby={bad.address ? "e-address" : undefined} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              {bad.address && (
                <p id="e-address" className="hint text-danger">
                  Enter the full address, including the area and pin code.
                </p>
              )}
            </div>

            {busy ? (
              <Checklist label="Payment progress" current={stage} steps={["Add test funds if needed", "Allow this exact amount", "Pay the seller's offer", "Save your order"]} />
            ) : (
              step && <ErrorBox what="Your payment did not go through." why={step} next="Nothing was taken unless you see an order page. Check your details and press Pay again." />
            )}

            <p className="text-sm text-muted">Paying takes up to four steps of about 5 seconds each. Keep this page open.</p>
            <div className="paybar">
              <div className="min-w-0">
                <span className="block text-xs text-ink-2">Total</span>
                <Money inr={inr(l.priceInr)} usdt={priceUsdt} size="md" />
              </div>
              <button type="submit" disabled={busy || !s.active} className="btn btn-primary flex-1">
                {busy ? "Paying" : `Pay ${inr(l.priceInr)}`}
              </button>
            </div>
            <div className="paybar-space" aria-hidden="true" />
          </form>
        </div>
      </div>
    </div>
  );
}
