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

  const load = useCallback(async () => {
    const r = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
    if (!r.ok) return setErr("Order not found.");
    setD(await r.json());
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

      {o.state === "Funded" && <div className="text-sm">Seller must ship within {countdown(o.shipBy, o.now)}, or you&apos;re refunded automatically.</div>}
      {o.state === "Shipped" && <div className="text-sm">Must arrive within {countdown(o.deliverBy, o.now)}, or you&apos;re refunded automatically.</div>}
      {o.state === "Delivered" && <div className="text-sm">Something wrong? You have {countdown(o.releaseAt, o.now)} to report it.</div>}
      {o.state === "Disputed" && <div className="text-sm">PoP is reviewing this order. If there&apos;s no decision in {countdown(o.arbiterDeadline, o.now)}, you&apos;re refunded automatically.</div>}

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

      {o.canFinalize && <FinalizeButton cfg={cfg} orderId={o.orderId} onDone={load} />}

      {isBuyer && credit > BigInt(0) && (
        <button disabled={busy} onClick={() => send("withdraw")} className="w-full rounded-xl bg-emerald-600 py-2 font-semibold text-white">
          Move {usdt(credit, cfg.tokenDecimals)} test USDT back to my wallet
        </button>
      )}
      {msg && <div className="text-sm text-neutral-700">{msg}</div>}
    </main>
  );
}
