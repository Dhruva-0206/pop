"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { checkoutAbi } from "@pop/shared";
import { publicClientOf, useConfig } from "@/lib/client/config";
import { getTestAccount, loadCode, walletOf } from "@/lib/client/wallet";
import Link from "next/link";
import { STATE_LABEL, priceLabel, usdt, when } from "@/lib/client/format";
import { TestModeBanner, TxLink } from "@/components/Banners";
import { FinalizeButton } from "@/components/FinalizeButton";
import { ReviewBox } from "@/components/ReviewBox";
import { Details, ErrorBox, Notice, PageSkeleton } from "@/components/ui";
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

/** mm:ss for a countdown. */
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

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
  if (!d || !cfg) return <PageSkeleton />;
  const o = d.order;
  const isBuyer = Boolean(me) && me.toLowerCase() === o.buyer.toLowerCase();
  // The next deadline for the current state, straight from the contract's order fields.
  const next =
    o.state === "Funded"
      ? { label: "The seller must ship within", target: o.shipBy, help: "If it isn't shipped in time, you are refunded automatically." }
      : o.state === "Shipped"
        ? { label: "It must arrive within", target: o.deliverBy, help: "If it doesn't arrive in time, you are refunded automatically." }
        : o.state === "Delivered"
          ? { label: "Time left to report a problem", target: o.releaseAt, help: "Something wrong? Report it before this ends. Afterwards the seller is paid." }
          : o.state === "Disputed"
            ? { label: "PoP is reviewing this order. A decision is due within", target: o.arbiterDeadline, help: "If nobody decides in time, you are refunded automatically." }
            : null;
  const done = ["Released", "Refunded", "Split"].includes(o.state);
  const timeline = [
    { label: "Paid", at: o.fundedAt, done: true },
    { label: "Shipped", at: o.shippedAt, done: o.shippedAt > 0 },
    { label: "Delivered (your code was entered at the door)", at: o.deliveredAt, done: o.deliveredAt > 0 },
    { label: o.state === "Refunded" ? "Complete: refunded to you" : o.state === "Split" ? "Complete: settled by review" : "Complete: seller paid", at: 0, done },
  ];
  const words = code ? code.split(" ") : [];
  const left = next ? Math.max(0, next.target - chainNow) : 0;

  return (
    <div className="page stack">
      <TestModeBanner cfg={cfg} />

      <section className="stack-sm">
        <p className="text-sm text-muted">
          Order #{o.orderId}
          {d.listing ? (
            <>
              {" "}
              from <Link href={`/verify/${d.listing.sellerHandle}`}>@{d.listing.sellerHandle}</Link>
            </>
          ) : null}
        </p>
        <h1>{d.listing?.title ?? "Your order"}</h1>
        {d.listing && <p className="text-lg font-semibold">{priceLabel(d.listing.priceInr, o.amount, cfg.tokenDecimals)}</p>}
      </section>

      <section aria-labelledby="status" className="card stack-sm">
        <h2 id="status">Status</h2>
        <p className="text-xl font-semibold" aria-live="polite">
          {STATE_LABEL[o.state] ?? o.state}
        </p>
        {next && (
          <div className="panel stack-sm">
            <p className="text-sm text-ink-2">{next.label}</p>
            <p className="mono text-2xl font-medium" aria-label={left > 0 ? `${Math.floor(left / 60)} minutes ${left % 60} seconds left` : "time is up"}>
              {left > 0 ? clock(left) : o.canFinalize ? "Time is up" : "Time is up, confirming"}
            </p>
            <p className="text-sm text-ink-2">{left > 0 || o.canFinalize ? next.help : "Waiting for the network to confirm the new time, about 5 seconds."}</p>
          </div>
        )}
        {!isBuyer && <Notice tone="info">You are looking at this order from a browser that didn&apos;t place it. The delivery code and buyer actions are only on the buyer&apos;s device.</Notice>}
      </section>

      {code && ["Funded", "Shipped"].includes(o.state) && (
        <section aria-labelledby="code" className="card stack-sm">
          <h2 id="code">Your delivery code</h2>
          <p className="text-ink-2">Give these six words to the courier only when the parcel is in your hand. Take a screenshot now: the code is stored only on this device.</p>
          <ol className="grid grid-cols-3 gap-2" aria-label="Delivery code, six words in order">
            {words.map((w, i) => (
              <li key={i} className="rounded-control border px-2 py-2 text-center">
                <span className="block text-xs text-muted">{i + 1}</span>
                <span className="mono text-base font-medium">{w}</span>
              </li>
            ))}
          </ol>
          {qr && (
            <Details summary="Show the code as a QR code">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="The delivery code as a QR code" className="mx-auto" width={200} height={200} />
            </Details>
          )}
        </section>
      )}

      {(isBuyer || next) && (
        <section aria-labelledby="actions" className="stack-sm">
          <h2 id="actions" className="sr-only">
            What you can do now
          </h2>
          {isBuyer && o.state === "Shipped" && (
            <button disabled={busy} onClick={() => send("confirmReceived")} className="btn btn-primary btn-block">
              {busy ? "Sending, about 5 seconds" : "I received it"}
            </button>
          )}
          {isBuyer && o.state === "Delivered" && o.releaseAt > chainNow && <DisputeBox cfg={cfg} orderId={o.orderId} onDone={load} />}
          {isBuyer && o.state === "Released" && d.listing && <ReviewBox cfg={cfg} orderId={o.orderId} sellerHandle={d.listing.sellerHandle} />}
          {next && (
            <div className="stack-sm">
              <FinalizeButton cfg={cfg} orderId={o.orderId} onDone={load} enabled={o.canFinalize} auto={autoFin && !!isBuyer} />
              {isBuyer && (
                <label className="flex min-h-11 items-center gap-3 text-sm text-ink-2">
                  <input type="checkbox" className="h-5 w-5" checked={autoFin} onChange={(e) => setAutoFin(e.target.checked)} />
                  Settle for me when the timer ends. This sends one transaction, and only when the contract allows it.
                </label>
              )}
            </div>
          )}
          {isBuyer && credit > BigInt(0) && (
            <button disabled={busy} onClick={() => send("withdraw")} className="btn btn-primary btn-block">
              {busy ? "Sending, about 5 seconds" : `Move ${usdt(credit, cfg.tokenDecimals)} test USDT back to my wallet`}
            </button>
          )}
          {msg && (
            <p role="status" className="text-sm text-ink-2">
              {msg}
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="timeline" className="card stack-sm">
        <h2 id="timeline">Progress</h2>
        <ol className="stack-sm">
          {timeline.map((s, i) => (
            <li key={s.label} className={s.done ? "text-ink" : "text-muted"}>
              <span className="font-semibold">{i + 1}. {s.label}</span>
              <span className="block text-sm">{s.done ? `Done${s.at ? `, ${when(s.at)}` : ""}` : "Not yet"}</span>
            </li>
          ))}
        </ol>
        <Details summary="Show details">
          <p>
            <TxLink cfg={cfg} hash={d.meta?.fundTx} label="Your payment" />
          </p>
          {d.meta?.courierStatus && <p>Courier (simulated): {d.meta.courierStatus}</p>}
          {d.meta?.trackingNo && <p>Tracking number: {d.meta.trackingNo}</p>}
        </Details>
      </section>

      {d.listing?.returnUrl && (
        <p className="text-center">
          <a href={d.listing.returnUrl}>Back to {d.listing.merchantName ?? "the store"}</a>
        </p>
      )}
    </div>
  );
}
