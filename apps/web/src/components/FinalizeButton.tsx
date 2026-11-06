"use client";

import { useEffect, useRef, useState } from "react";
import { checkoutAbi } from "@pop/shared";
import { publicClientOf, type AppConfig } from "@/lib/client/config";
import { getTestAccount, walletOf } from "@/lib/client/wallet";

/**
 * Anyone can press this once a deadline or window has passed: the contract decides the outcome
 * (late ship / late delivery / arbiter timeout -> refund; window over -> seller paid). Uses this browser's test wallet.
 * `enabled` must come from the contract's own view (canFinalize); the button is disabled until then.
 * `auto` (opt-in) sends finalize ONCE, and only when `enabled` is true; it never retries.
 */
export function FinalizeButton({
  cfg,
  orderId,
  onDone,
  enabled = true,
  auto = false,
}: {
  cfg: AppConfig;
  orderId: string;
  onDone?: () => void;
  enabled?: boolean;
  auto?: boolean;
}) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const fired = useRef(false);
  useEffect(() => {
    if (auto && enabled && !fired.current) {
      fired.current = true;
      void go();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, enabled]);
  async function go() {
    if (!enabled) return;
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
      setMsg("Done. The order is settled.");
      onDone?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message.split("\n")[0] : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack-sm">
      <button onClick={go} disabled={busy || !enabled} className="btn btn-secondary btn-block">
        {busy ? "Settling, about 5 seconds" : enabled ? "Settle now" : "Settle (opens when the timer ends)"}
      </button>
      {enabled && !busy && !msg && <p className="hint">The deadline has passed. Anyone can press this, and the contract decides the outcome.</p>}
      {msg && (
        <p role="status" className="text-sm text-ink-2">
          {msg}
        </p>
      )}
    </div>
  );
}
