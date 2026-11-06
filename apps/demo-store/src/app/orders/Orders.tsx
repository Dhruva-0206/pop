"use client";

import { useEffect, useState } from "react";

type Order = {
  ref: string;
  orderId?: string;
  status: string;
  amountUsdt?: string;
  history: { event: string; at: number; onChainState: string }[];
};
const LABEL: Record<string, string> = {
  created: "Waiting for payment",
  funded: "Paid, waiting for the seller to ship",
  shipped: "Shipped",
  delivered: "Delivered (code entered at the door)",
  released: "Complete: seller paid",
  refunded: "Refunded to you",
  split: "Settled by the arbiter (split)",
};

export default function Orders() {
  const [rows, setRows] = useState<Order[] | null>(null);
  useEffect(() => {
    const load = () =>
      fetch("/api/orders", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => setRows(j.orders));
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);
  if (!rows) return <div className="text-sm text-neutral-500">Loading…</div>;
  if (!rows.length) return <div className="text-sm text-neutral-500">No orders yet.</div>;
  return (
    <ul className="space-y-3">
      {rows.map((o) => (
        <li key={o.ref} className="rounded-xl border p-4 text-sm">
          <div className="flex justify-between">
            <span className="font-semibold">{o.ref}</span>
            <span>{o.amountUsdt ? `${o.amountUsdt} test USDT` : ""}</span>
          </div>
          <div>{LABEL[o.status] ?? o.status}</div>
          <div className="text-xs text-neutral-500">
            {o.history.length ? `Confirmed on-chain: ${o.history.map((h) => h.event.replace("order.", "")).join(" → ")}` : "Nothing confirmed on-chain yet"}
          </div>
        </li>
      ))}
    </ul>
  );
}
