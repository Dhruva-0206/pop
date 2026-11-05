"use client";

import { useState } from "react";
import { checkoutAbi } from "@pop/shared";
import { publicClientOf, type AppConfig } from "@/lib/client/config";
import { getTestAccount, walletOf } from "@/lib/client/wallet";

/**
 * Anyone can press this once a deadline or window has passed: the contract decides the outcome
 * (late ship / late delivery / arbiter timeout -> refund; window over -> seller paid). Uses this browser's test wallet.
 */
export function FinalizeButton({ cfg, orderId, onDone }: { cfg: AppConfig; orderId: string; onDone?: () => void }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    setMsg("");
    try {
      const acct = getTestAccount(cfg, "buyer")!;
      const pc = publicClientOf(cfg);
      if ((await pc.getBalance({ address: acct.address })) === BigInt(0)) {
        await fetch("/api/faucet", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ address: acct.address }),
        });
      }
      const w = walletOf(cfg, acct);
      const tx = await w.writeContract({
        address: cfg.checkout,
        abi: checkoutAbi,
        functionName: "finalize",
        args: [BigInt(orderId)],
        account: acct,
        chain: w.chain,
      });
      await pc.waitForTransactionReceipt({ hash: tx });
      setMsg("Done.");
      onDone?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message.split("\n")[0] : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-1">
      <button onClick={go} disabled={busy} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "Settling…" : "Settle now (anyone can press this)"}
      </button>
      {msg && <div className="text-xs text-neutral-600">{msg}</div>}
    </div>
  );
}
