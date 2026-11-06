"use client";

import { useEffect, useState } from "react";
import { ErrorBox, Skeleton } from "@/components/ui";

type Order = {
  ref: string;
  orderId?: string;
  status: string;
  amountUsdt?: string;
  history: { event: string; at: number; onChainState: string }[];
};
const STAMP: Record<string, string> = {
  created: "Waiting",
  funded: "Paid",
  shipped: "Shipped",
  delivered: "Delivered",
  released: "Complete",
  refunded: "Refunded",
  split: "Split",
};
const LABEL: Record<string, string> = {
  created: "Waiting for payment.",
  funded: "Paid. Waiting for us to ship.",
  shipped: "Shipped.",
  delivered: "Delivered. The delivery code was entered at the door.",
  released: "Complete. We were paid.",
  refunded: "Refunded to you.",
  split: "Settled by review.",
};

export default function Orders() {
  const [rows, setRows] = useState<Order[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const load = () =>
      fetch("/api/orders", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
        .then((j) => (setRows(j.orders), setFailed(false)))
        .catch(() => setFailed(true));
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);
  if (failed && !rows) return <ErrorBox what="We couldn't load your orders." why="The order service did not answer." next="Refresh the page in a few seconds." />;
  if (!rows)
    return (
      <div className="stack-sm" aria-busy="true" aria-label="Loading orders">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  if (!rows.length) return <p className="text-ink-2">No orders yet. Pick the kurta on the shop page to place one.</p>;
  return (
    <ul className="border-t">
      {rows.map((o) => (
        <li key={o.ref} className="grid gap-2 border-b py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-6">
          <div className="stack-sm min-w-0">
            <p className="flex flex-wrap items-center gap-3">
              <span className={`stamp text-sm ${o.status === "refunded" ? "text-ink-2" : o.status === "released" ? "text-accent-strong" : "text-ink"}`}>{STAMP[o.status] ?? o.status}</span>
              <span className="mono break-all text-sm text-ink-2">{o.ref}</span>
            </p>
            <p className="font-semibold">{LABEL[o.status] ?? o.status}</p>
            <p className="text-sm text-muted">
              {o.history.length ? `Confirmed on the network: ${o.history.map((h) => h.event.replace("order.", "")).join(", then ")}.` : "Nothing confirmed on the network yet."}
            </p>
          </div>
          <p className="mono text-sm text-ink sm:text-right">{o.amountUsdt ? `${Number(o.amountUsdt).toFixed(2)} test USDT` : ""}</p>
        </li>
      ))}
    </ul>
  );
}
