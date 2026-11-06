"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { checkoutAbi } from "@pop/shared";
import { publicClientOf, useConfig } from "@/lib/client/config";
import { getTestAccount, loadCode, walletOf } from "@/lib/client/wallet";
import Link from "next/link";
import { STAMP, STATE_LABEL, clockTime, inr, usdt, when } from "@/lib/client/format";
import { TestModeBanner, TxLink } from "@/components/Banners";
import { FinalizeButton } from "@/components/FinalizeButton";
import { ReviewBox } from "@/components/ReviewBox";
import { Details, ErrorBox, Notice, ReceiptSkeleton } from "@/components/ui";
import { Countdown, Fact, Money, Receipt, ReceiptSection, Stamp, TearLine, Tracker, type StampTone, type TrackStep } from "@/components/receipt";
import { DisputeBox } from "@/components/DisputeBox";

type Live = {
  orderId: string;
  buyer: string;
  seller: string;
  amount: string;
  state: string;
  fundedAt: number;
  shipBy: number;
  shippedAt: number;
  deliverBy: number;
  deliveredAt: number;
  disputedAt: number;
  releaseAt: number;
  arbiterDeadline: number;
  canFinalize: boolean;
  now: number;
};
type Resp = {
  order: Live;
  meta: { fundTx?: string; trackingNo?: string; courierStatus?: string } | null;
  listing: { title: string; priceInr: number; sellerHandle: string; merchantName?: string; returnUrl?: string } | null;
};

const TONE: Record<string, StampTone> = { Funded: "ink", Shipped: "ink", Delivered: "ink", Disputed: "warn", Released: "accent", Refunded: "muted", Split: "muted" };

export default function OrderView() {
  const { orderId } = useParams<{ orderId: string }>();
  const { cfg } = useConfig();
  const [d, setD] = useState<Resp | null>(null);
  const [err, setErr] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [qr, setQr] = useState("");
  const [me, setMe] = useState("");
  const [credit, setCredit] = useState<bigint>(BigInt(0));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoFin, setAutoFin] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [chainNow, setChainNow] = useState(0); // on-chain time, advanced locally between polls (display only)

  const load = useCallback(async () => {
    const r = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
    if (!r.ok) return setErr("Order not found.");
    const j: Resp = await r.json();
    setD(j);
    setFetchedAt(Date.now());
    setChainNow(j.order.now);
    if (cfg) {
      const acct = getTestAccount(cfg, "buyer", false);
      if (acct) {
        setMe(acct.address);
        const c = await publicClientOf(cfg).readContract({
          address: cfg.checkout,
          abi: checkoutAbi,
          functionName: "credit",
          args: [acct.address],
        });
        setCredit(c);
      }
    }
  }, [orderId, cfg]);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  // Smooth countdown between 3 s polls. Only the DISPLAY uses this; whether Settle is enabled comes from the contract (canFinalize).
  useEffect(() => {
    if (!d) return;
    const t = setInterval(() => setChainNow(d.order.now + Math.floor((Date.now() - fetchedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [d, fetchedAt]);

  useEffect(() => {
    if (!cfg) return;
    const w = loadCode(cfg, orderId);
    setCode(w);
    if (w) QRCode.toDataURL(w, { margin: 1, width: 220 }).then(setQr);
  }, [cfg, orderId]);

  async function send(fn: "confirmReceived" | "withdraw") {
    if (!cfg) return;
    setBusy(true);
    setMsg("");
    try {
      const acct = getTestAccount(cfg, "buyer")!;
      const w = walletOf(cfg, acct);
      const tx =
        fn === "confirmReceived"
          ? await w.writeContract({ address: cfg.checkout, abi: checkoutAbi, functionName: "confirmReceived", args: [BigInt(orderId)], account: acct, chain: w.chain })
          : await w.writeContract({ address: cfg.checkout, abi: checkoutAbi, functionName: "withdraw", account: acct, chain: w.chain });
      await publicClientOf(cfg).waitForTransactionReceipt({ hash: tx });
      setMsg(fn === "withdraw" ? "Done. The money is back in your test wallet." : "Thanks. Marked as received. The seller is paid after the short problem window.");
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message.split("\n")[0] : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (err) {
    return (
      <div className="page stack">
        <ErrorBox what="We couldn't find this order." why="The order number may be wrong, or the network is slow." next="Check the link you were given, or refresh in a few seconds." />
      </div>
    );
  }
  if (!d || !cfg) return <ReceiptSkeleton />;
  const o = d.order;
  const isBuyer = Boolean(me) && me.toLowerCase() === o.buyer.toLowerCase();
  // The next deadline for the current state, straight from the contract's order fields.
  const next =
    o.state === "Funded"
      ? { label: "Time left for the seller to ship", target: o.shipBy }
      : o.state === "Shipped"
        ? { label: "Time left for delivery", target: o.deliverBy }
        : o.state === "Delivered"
          ? { label: "Time left to report a problem", target: o.releaseAt }
          : o.state === "Disputed"
            ? { label: "Time left for PoP to decide", target: o.arbiterDeadline }
            : null;
  const done = ["Released", "Refunded", "Split"].includes(o.state);
  // The one rule that applies now, with its time. Refund and dispute exits are stated here, under the tracker.
  const rule =
    o.state === "Funded"
      ? `If it is not shipped by ${when(o.shipBy)}, you are refunded automatically.`
      : o.state === "Shipped"
        ? `If it is not delivered by ${when(o.deliverBy)}, you are refunded automatically.`
        : o.state === "Delivered"
          ? `Report a problem before ${when(o.releaseAt)}. After that the seller is paid.`
          : o.state === "Disputed"
            ? `PoP decides by ${when(o.arbiterDeadline)}. If nobody decides by then, you are refunded automatically.`
            : o.state === "Released"
              ? isBuyer
                ? "The seller was paid after the problem window closed. You can now review them below."
                : "The seller was paid after the problem window closed."
              : o.state === "Refunded"
                ? isBuyer
                  ? credit > BigInt(0)
                    ? "The full amount came back to you. It is waiting in PoP: move it to your test wallet below."
                    : "The full amount came back to you, in your test wallet."
                  : "The buyer got the full amount back."
                : o.state === "Split"
                  ? "PoP reviewed a report and split the payment between the buyer and the seller."
                  : "";
  const last = o.state === "Refunded" ? "Refunded" : o.state === "Split" ? "Split" : o.state === "Disputed" ? "PoP decides" : "Seller paid";
  const nowIdx = done ? -1 : o.state === "Disputed" ? 3 : o.state === "Delivered" ? 2 : o.state === "Shipped" ? 1 : 0;
  const steps: TrackStep[] = [
    { label: "Paid", at: o.fundedAt },
    { label: "Shipped", at: o.shippedAt },
    { label: "Delivered", at: o.deliveredAt },
    { label: last, at: 0 },
  ].map((s, i): TrackStep => {
    if (i === nowIdx) return { label: s.label, state: "now" };
    if (i < 3 && s.at > 0) return { label: s.label, state: "done", note: clockTime(s.at) };
    if (i === 3 && done) return { label: s.label, state: "done", note: "Done" };
    if (done || (o.state === "Disputed" && i < 3)) return { label: s.label, state: "skipped" };
    return { label: s.label, state: "next" };
  });
  const words = code ? code.split(" ") : [];
  const left = next ? Math.max(0, next.target - chainNow) : 0;
  const showCode = Boolean(code) && ["Funded", "Shipped"].includes(o.state);
  const amountUsdt = usdt(o.amount, cfg.tokenDecimals);
  const hasActions = isBuyer && (o.state === "Shipped" || (o.state === "Delivered" && o.releaseAt > chainNow) || (o.state === "Released" && !!d.listing) || credit > BigInt(0) || !!msg);

  return (
    <div className="desk">
      <div className="page-wide stack">
        <TestModeBanner cfg={cfg} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] lg:gap-10">
          <Receipt label={`Receipt for order ${o.orderId}`}>
            <ReceiptSection className="stack-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="mono pt-1 text-sm text-ink-2">Order #{o.orderId}</p>
                <div aria-live="polite">
                  <Stamp tone={TONE[o.state] ?? "ink"}>{STAMP[o.state] ?? o.state}</Stamp>
                  <span className="sr-only">{STATE_LABEL[o.state] ?? o.state}</span>
                </div>
              </div>
              <h1>{d.listing?.title ?? "Your order"}</h1>
              {d.listing && (
                <p className="text-sm text-ink-2">
                  Sold by <Link href={`/verify/${d.listing.sellerHandle}`}>@{d.listing.sellerHandle}</Link>
                </p>
              )}
              <div className="pt-2">{d.listing ? <Money inr={inr(d.listing.priceInr)} usdt={amountUsdt} /> : <Money inr={`${amountUsdt} test USDT`} />}</div>
            </ReceiptSection>

            <ReceiptSection className="stack">
              <Tracker steps={steps} />
              <p className="text-ink-2">{rule}</p>
              {next && (
                <div className="stack-sm">
                  <div>
                    <p className="text-sm text-ink-2">{next.label}</p>
                    <Countdown seconds={left} doneText={o.canFinalize ? "Time is up" : "Time is up, confirming"} />
                    {left === 0 && !o.canFinalize && <p className="hint">Waiting for the network to confirm the new time, about 5 seconds.</p>}
                  </div>
                  <FinalizeButton cfg={cfg} orderId={o.orderId} onDone={load} enabled={o.canFinalize} auto={autoFin && !!isBuyer} opensAt={when(next.target)} />
                  {isBuyer && (
                    <label className="flex min-h-11 items-center gap-3 text-sm text-ink-2">
                      <input type="checkbox" className="h-5 w-5 shrink-0" checked={autoFin} onChange={(e) => setAutoFin(e.target.checked)} />
                      Settle for me when the timer ends. This sends one transaction, and only when the contract allows it.
                    </label>
                  )}
                </div>
              )}
              {!isBuyer && o.state !== "Refunded" && o.state !== "Split" && (
                <Notice tone="neutral">You are viewing this order from a browser that didn&apos;t place it. The delivery code and the buyer&apos;s buttons are only on the buyer&apos;s device.</Notice>
              )}
            </ReceiptSection>

            <ReceiptSection>
              <h2 className="sr-only">Order facts</h2>
              <dl className="facts">
                <Fact label="Order number">#{o.orderId}</Fact>
                <Fact label="Amount">
                  {d.listing ? `${inr(d.listing.priceInr)} · ` : ""}
                  {amountUsdt} test USDT
                </Fact>
                <Fact label="Paid">{when(o.fundedAt)}</Fact>
                {o.shippedAt > 0 ? <Fact label="Shipped">{when(o.shippedAt)}</Fact> : !done && <Fact label="Ship by">{when(o.shipBy)}</Fact>}
                {o.deliveredAt > 0 ? <Fact label="Delivered">{when(o.deliveredAt)}</Fact> : o.shippedAt > 0 && !done && <Fact label="Deliver by">{when(o.deliverBy)}</Fact>}
                {o.state === "Delivered" && <Fact label="Problem window ends">{when(o.releaseAt)}</Fact>}
                {o.state === "Disputed" && <Fact label="Decision due">{when(o.arbiterDeadline)}</Fact>}
              </dl>
            </ReceiptSection>

            {showCode && (
              <>
                <TearLine />
                <ReceiptSection className="stack-sm" labelledBy="code">
                  <h2 id="code">Your delivery code</h2>
                  <p className="text-ink-2">Read these 6 words to the courier only when the parcel is in your hand.</p>
                  <ol className="mx-auto grid max-w-sm grid-cols-3 gap-2" aria-label="Delivery code, six words in order">
                    {words.map((w, i) => (
                      <li key={i} className="rounded-control border border-line-strong px-2 py-2 text-center">
                        <span className="block text-xs text-muted">{i + 1}</span>
                        <span className="mono text-base font-medium">{w}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="hint">Take a screenshot now. The code is kept only on this device.</p>
                  {qr && (
                    <Details summary="Show as QR">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qr} alt="The delivery code as a QR code" className="mx-auto" width={200} height={200} />
                    </Details>
                  )}
                </ReceiptSection>
              </>
            )}

            {hasActions && (
              <ReceiptSection className="stack-sm">
                <h2 className="sr-only">What you can do now</h2>
                {o.state === "Shipped" && (
                  <button disabled={busy} onClick={() => send("confirmReceived")} className="btn btn-primary btn-block">
                    {busy ? "Sending, about 5 seconds" : "I received it"}
                  </button>
                )}
                {o.state === "Delivered" && o.releaseAt > chainNow && <DisputeBox cfg={cfg} orderId={o.orderId} onDone={load} />}
                {o.state === "Released" && d.listing && <ReviewBox cfg={cfg} orderId={o.orderId} sellerHandle={d.listing.sellerHandle} />}
                {credit > BigInt(0) && (
                  <button disabled={busy} onClick={() => send("withdraw")} className="btn btn-primary btn-block">
                    {busy ? "Sending, about 5 seconds" : `Move ${usdt(credit, cfg.tokenDecimals)} test USDT back to my wallet`}
                  </button>
                )}
                {msg && (
                  <p role="status" className="text-sm text-ink-2">
                    {msg}
                  </p>
                )}
              </ReceiptSection>
            )}

            <ReceiptSection>
              <Details summary="Show details">
                <p>
                  <TxLink cfg={cfg} hash={d.meta?.fundTx} label="Your payment" />
                </p>
                {d.meta?.courierStatus && <p>Courier (simulated): {d.meta.courierStatus}</p>}
                {d.meta?.trackingNo && <p>Tracking number: {d.meta.trackingNo}</p>}
              </Details>
            </ReceiptSection>
          </Receipt>

          <aside className="stack-sm text-sm text-ink-2 lg:pt-2" aria-label="About this receipt">
            <p className="max-w-prose">The status, times and amounts on this receipt are read from the PoP contract every few seconds. Nobody at PoP can edit them.</p>
            {d.listing && (
              <p>
                <Link href={`/verify/${d.listing.sellerHandle}`}>See @{d.listing.sellerHandle}&apos;s record</Link>
              </p>
            )}
            {d.listing?.returnUrl && (
              <p>
                <a href={d.listing.returnUrl}>Back to {d.listing.merchantName ?? "the store"}</a>
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

