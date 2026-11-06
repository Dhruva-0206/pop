"use client";

import type { AppConfig } from "@/lib/client/config";
import { Notice } from "./ui";

/** Test-mode label shown on every screen that uses the browser's test wallet. */
export function TestModeBanner({ cfg }: { cfg: AppConfig | null }) {
  if (!cfg) return null;
  return (
    <Notice tone="warn">
      <strong>TEST MODE</strong> The wallet in this browser is a test wallet. Test USDT has no value.
      {cfg.isLocalFork && " This is a local copy of the test network, so nothing here is a real payment."}
    </Notice>
  );
}

export function TxLink({ cfg, hash, label = "View transaction" }: { cfg: AppConfig | null; hash?: string; label?: string }) {
  if (!hash) return null;
  if (cfg?.explorer) {
    return (
      <a className="text-sm" href={`${cfg.explorer}/tx/${hash}`} target="_blank" rel="noreferrer">
        {label} (opens the explorer in a new tab)
      </a>
    );
  }
  return <span className="mono text-xs text-muted">Transaction {hash.slice(0, 10)}… (local fork, no explorer)</span>;
}
