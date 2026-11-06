"use client";

import { useRouter } from "next/navigation";
import { useConfig } from "@/lib/client/config";
import { FinalizeButton } from "@/components/FinalizeButton";

export type Expired = { orderId: string; state: string; amount: string };

/** Orders whose deadline has passed and that nobody has finalized yet. Anyone may press the button; the contract decides the outcome. */
export default function ExpiredList({ orders }: { orders: Expired[] }) {
  const { cfg } = useConfig();
  const router = useRouter();
  if (!orders.length) return <p className="text-sm text-neutral-500">No order is waiting to be finalized right now.</p>;
  if (!cfg) return <p className="text-sm text-neutral-500">Loading…</p>;
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.orderId} className="space-y-1 rounded border p-3 text-sm">
          <div>
            Order #{o.orderId} · {o.state} · deadline passed
          </div>
          <FinalizeButton cfg={cfg} orderId={o.orderId} onDone={() => router.refresh()} />
        </li>
      ))}
    </ul>
  );
}
