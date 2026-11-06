"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { checkoutAbi } from "@pop/shared";
import { publicClientOf, useConfig } from "@/lib/client/config";
import { getTestAccount, loadCode, walletOf } from "@/lib/client/wallet";
import { STATE_LABEL, countdown, priceLabel, usdt, when } from "@/lib/client/format";
import { TestModeBanner, TxLink } from "@/components/Banners";
import { FinalizeButton } from "@/components/FinalizeButton";
import { ReviewBox } from "@/components/ReviewBox";

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
  listing: { title: string; priceInr: number; sellerHandle: string } | null;
};

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
      setMsg(fn === "withdraw" ? "Money returned to your test wallet." : "Thanks! Marked as received.");
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message.split("\n")[0] : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (err) return <main className="mx-auto max-w-md p-6 text-red-700">{err}</main>;
  if (!d || !cfg) return <main className="mx-auto max-w-md p-6 text-neutral-500">Loading…</main>;
  const o = d.order;
  const isBuyer = me && me.toLowerCase() === o.buyer.toLowerCase();
  // The next deadline for the current state, straight from the contract's order fields.
  const next =
    o.state === "Funded"
      ? { label: "Seller must ship within", target: o.shipBy, help: "If it isn't shipped in time, you're refunded automatically." }
      : o.state === "Shipped"
        ? { label: "Must arrive within", target: o.deliverBy, help: "If it doesn't arrive in time, you're refunded automatically." }
        : o.state === "Delivered"
          ? { label: "Time left to report a problem", target: o.releaseAt, help: "Something wrong? Report it before this ends; afterwards the seller is paid." }
          : o.state === "Disputed"
            ? { label: "PoP is reviewing this order. Decision due within", target: o.arbiterDeadline, help: "If there's no decision in time, you're refunded automatically." }
            : null;
  const steps = [
    { label: "Paid", at: o.fundedAt, done: true },
    { label: "Shipped", at: o.shippedAt, done: o.shippedAt > 0 },
    { label: "Delivered (your code at the door)", at: o.deliveredAt, done: o.deliveredAt > 0 },
    { label: "Complete", at: 0, done: ["Released", "Refunded", "Split"].includes(o.state) },
  ];

  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <TestModeBanner cfg={cfg} />
      <div className="rounded-xl border p-4">
        <div className="text-xs text-neutral-500">Order #{o.orderId}{d.listing ? ` · @${d.listing.sellerHandle}` : ""}</div>
        <h1 className="text-lg font-semibold">{d.listing?.title ?? "Your order"}</h1>
        {d.listing && <div>{priceLabel(d.listing.priceInr, o.amount, cfg.tokenDecimals)}</div>}
        <div className="mt-2 inline-block rounded bg-neutral-100 px-2 py-1 text-sm font-semibold">{STATE_LABEL[o.state] ?? o.state}</div>
        <div className="mt-1"><TxLink cfg={cfg} hash={d.meta?.fundTx} label="payment" /></div>
      </div>

      <ol className="space-y-2 rounded-xl border p-4 text-sm">
        {steps.map((s) => (
          <li key={s.label} className={s.done ? "text-emerald-700" : "text-neutral-400"}>
            {s.done ? "●" : "○"} {s.label} {s.at ? <span className="text-xs text-neutral-500">· {when(s.at)}</span> : null}
          </li>
        ))}
        {d.meta?.courierStatus && <li className="text-xs text-neutral-500">Courier (simulated): {d.meta.courierStatus}</li>}
        {d.meta?.trackingNo && <li className="text-xs text-neutral-500">Tracking: {d.meta.trackingNo}</li>}
      </ol>

      {next && (
        <div className="rounded-xl border p-4 text-sm" aria-live="off">
          <div className="text-xs text-neutral-500">{next.label}</div>
          <div className="font-mono text-2xl">{next.target > chainNow ? countdown(next.target, chainNow) : o.canFinalize ? "Time is up" : "Time is up, confirming on-chain…"}</div>
          <div className="mt-1 text-neutral-600">{next.help}</div>
        </div>
      )}

      {code && ["Funded", "Shipped"].includes(o.state) && (
        <div className="space-y-2 rounded-xl border-2 border-emerald-500 p-4 text-center">
          <div className="text-sm font-semibold">Your delivery code</div>
          {qr && <img src={qr} alt="Delivery code QR" className="mx-auto" width={220} height={220} />}
          <div className="font-mono text-lg">{code}</div>
          <div className="text-xs text-neutral-600">
            Only show this to the courier when the parcel is in your hand. Save it now (screenshot); it is stored only on this device.
          </div>
        </div>
      )}

      {isBuyer && o.state === "Shipped" && (
        <button disabled={busy} onClick={() => send("confirmReceived")} className="w-full rounded-xl border-2 border-emerald-600 py-2 font-semibold text-emerald-700">
          I received it
        </button>
      )}

      {isBuyer && o.state === "Released" && d.listing && <ReviewBox cfg={cfg} orderId={o.orderId} sellerHandle={d.listing.sellerHandle} />}

      {next && (
        <div className="space-y-2">
          <FinalizeButton cfg={cfg} orderId={o.orderId} onDone={load} enabled={o.canFinalize} auto={autoFin && !!isBuyer} />
          {isBuyer && (
            <label className="flex items-center gap-2 text-xs text-neutral-600">
              <input type="checkbox" checked={autoFin} onChange={(e) => setAutoFin(e.target.checked)} />
              Settle automatically when the timer ends (sends one transaction, only when the contract allows it)
            </label>
          )}
        </div>
      )}

      {isBuyer && credit > BigInt(0) && (
        <button disabled={busy} onClick={() => send("withdraw")} className="w-full rounded-xl bg-emerald-600 py-2 font-semibold text-white">
          Move {usdt(credit, cfg.tokenDecimals)} test USDT back to my wallet
        </button>
      )}
      {msg && <div className="text-sm text-neutral-700">{msg}</div>}
    </main>
  );
}
