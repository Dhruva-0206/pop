"use client";

import { useState } from "react";
import { IDKitRequestWidget, proofOfHuman, type IDKitResult, type RpContext } from "@worldcoin/idkit";
import { encodePacked, keccak256 } from "viem";

type Cfg = { app_id: `app_${string}`; action: string; environment: "staging" | "production"; rp_context: RpContext };

const SELLER = "meera.jewels";
const ORDER_ID = "1";
const BUYER = "0x29D123A04865c9eD2E377A128C68334F2601f34C"; // test buyer wallet (public address only)

export default function WorldTest() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const add = (s: string) => setLog((l) => [`${new Date().toLocaleTimeString()} ${s}`, ...l]);
  const signal = keccak256(encodePacked(["uint256", "address"], [BigInt(ORDER_ID), BUYER]));

  async function start() {
    const res = await fetch("/api/world/rp-signature", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seller: SELLER }),
    });
    if (!res.ok) return add(`rp-signature failed: ${res.status} (is World configured in .env?)`);
    setCfg(await res.json());
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Seller @{SELLER} · action {cfg?.action ?? "?"} · Order #{ORDER_ID} · buyer {BUYER.slice(0, 8)}… · signal {signal.slice(0, 12)}…
      </p>
      <button className="rounded bg-black px-4 py-2 text-white" onClick={start}>
        Verify with World ID to review
      </button>
      {cfg && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={cfg.app_id}
          action={cfg.action}
          rp_context={cfg.rp_context}
          allow_legacy_proofs={true}
          preset={proofOfHuman({ signal })}
          environment={cfg.environment}
          handleVerify={async (result: IDKitResult) => {
            const r = await fetch("/api/world/verify-review", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ seller: SELLER, orderId: ORDER_ID, buyer: BUYER, idkitResult: result }),
            });
            const body = await r.json();
            add(`server: ${JSON.stringify(body)}`);
            if (!r.ok) throw new Error(body.error ?? "verification failed");
          }}
          onSuccess={() => add("SUCCESS: review would be published")}
          onError={(code) => add(`DENIED/CANCELLED: ${code} (no review published)`)}
        />
      )}
      <pre className="whitespace-pre-wrap rounded bg-neutral-100 p-3 text-xs">{log.join("\n") || "no events yet"}</pre>
    </div>
  );
}
