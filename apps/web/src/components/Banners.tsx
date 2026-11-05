"use client";

import type { AppConfig } from "@/lib/client/config";

export function TestModeBanner({ cfg }: { cfg: AppConfig | null }) {
  if (!cfg) return null;
  return (
    <div className="space-y-1">
      <div className="rounded bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
        TEST MODE · test wallet in this browser · test USDT has no value
      </div>
      {cfg.isLocalFork && (
        <div className="rounded bg-fuchsia-100 px-3 py-1 text-xs font-bold text-fuchsia-900">
          LOCAL FORK · a copy of the test network on this laptop · not a real payment
        </div>
      )}
    </div>
  );
}

export function TxLink({ cfg, hash, label = "view transaction" }: { cfg: AppConfig | null; hash?: string; label?: string }) {
  if (!hash) return null;
  if (cfg?.explorer) {
    return (
      <a className="text-xs text-emerald-700 underline" href={`${cfg.explorer}/tx/${hash}`} target="_blank" rel="noreferrer">
        {label} ↗
      </a>
    );
  }
  return <span className="font-mono text-xs text-neutral-500">tx {hash.slice(0, 10)}… (local)</span>;
}
