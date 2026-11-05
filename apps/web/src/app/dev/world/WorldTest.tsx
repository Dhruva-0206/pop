"use client";

import { useState } from "react";
import { IDKitRequestWidget, proofOfHuman, type IDKitResult, type RpContext } from "@worldcoin/idkit";
import { encodePacked, keccak256, type Address } from "viem";
import { useConfig } from "@/lib/client/config";
import { getTestAccount } from "@/lib/client/wallet";
import { reviewAuthMessage } from "@/lib/messages";

type Cfg = { app_id: `app_${string}`; action: string; environment: "staging" | "production"; rp_context: RpContext };

const SELLER = "meera.jewels";

/**
 * Dev-only World smoke test (Smoke D). The server only accepts a proof for a Released order whose on-chain buyer
 * signed this request, so use this browser's buyer test wallet and an order it paid for that has been Released.
 */
export default function WorldTest() {
  const { cfg: net } = useConfig();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState("1");
  const [log, setLog] = useState<string[]>([]);
  const add = (s: string) => setLog((l) => [`${new Date().toLocaleTimeString()} ${s}`, ...l]);
  const buyer = net ? (getTestAccount(net, "buyer", false)?.address as Address | undefined) : undefined;
  const signal = buyer && /^\d+$/.test(orderId) ? keccak256(encodePacked(["uint256", "address"], [BigInt(orderId), buyer])) : undefined;

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
        Seller @{SELLER} · action {cfg?.action ?? "?"} · buyer test wallet {buyer ? `${buyer.slice(0, 8)}…` : "none in this browser"} · signal{" "}
        {signal ? `${signal.slice(0, 12)}…` : "?"}
      </p>
      <label className="block text-sm">
        Released order id{" "}
        <input className="w-24 rounded border p-1" value={orderId} onChange={(e) => setOrderId(e.target.value.trim())} />
      </label>
      <button className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" disabled={!signal} onClick={start}>
        Verify with World ID to review
      </button>
      {cfg && signal && net && (
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
            const acct = getTestAccount(net, "buyer", false)!;
            const buyerSignature = await acct.signMessage({ message: reviewAuthMessage(orderId, SELLER) });
            const r = await fetch("/api/world/verify-review", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ seller: SELLER, orderId, buyerSignature, idkitResult: result }),
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
