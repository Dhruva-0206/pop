"use client";

import { useState } from "react";
import { useConfig } from "@/lib/client/config";
import { ReviewBox } from "@/components/ReviewBox";

const SELLER = "meera.jewels";

/**
 * Dev-only World + review smoke test (Smoke D). Same component the buyer sees on /o/[orderId], pointed at an order id:
 * use this browser's buyer test wallet and an order it paid for that is Released.
 */
export default function WorldTest() {
  const { cfg } = useConfig();
  const [orderId, setOrderId] = useState("1");
  if (!cfg) return <div className="text-sm text-neutral-500">Loading…</div>;
  return (
    <div className="space-y-4">
      <label className="block text-sm">
        Released order id (seller @{SELLER}){" "}
        <input className="w-24 rounded border p-1" value={orderId} onChange={(e) => setOrderId(e.target.value.trim())} />
      </label>
      {/^\d+$/.test(orderId) && <ReviewBox key={orderId} cfg={cfg} orderId={orderId} sellerHandle={SELLER} />}
    </div>
  );
}
