"use client";

import { useEffect, useState } from "react";
import { createPublicClient, defineChain, http, type Address, type Chain, type PublicClient } from "viem";

export type AppConfig = {
  mode: "fork" | "testnet";
  label: string;
  isLocalFork: boolean;
  chainId: number;
  rpcUrl: string;
  checkout: Address;
  registry: Address;
  token: Address;
  tokenDecimals: number;
  explorer: string | null;
  /** True only on a local `next dev` server started with POP_DEV_SKIP_WORLD=1. Shows a clearly labelled DEV review button. */
  devSkipWorld?: boolean;
  /** Demo mode for /onboard (testnet only): the staff check of the bio is skipped. */
  onboardAutoApprove?: boolean;
};

let cached: Promise<AppConfig> | null = null;
export function loadConfig(): Promise<AppConfig> {
  cached ??= fetch("/api/config", { cache: "no-store" }).then((r) => r.json());
  return cached;
}

export function chainOf(c: AppConfig): Chain {
  return defineChain({
    id: c.chainId,
    name: c.isLocalFork ? "Whitechain Sepolia (LOCAL FORK)" : "Whitechain Sepolia",
    nativeCurrency: { name: "WhiteBIT Coin", symbol: "WBT", decimals: 18 },
    rpcUrls: { default: { http: [c.rpcUrl] } },
  });
}

export function publicClientOf(c: AppConfig): PublicClient {
  return createPublicClient({ chain: chainOf(c), transport: http(c.rpcUrl) }) as PublicClient;
}

export function useConfig() {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadConfig().then(setCfg, (e) => setError(String(e)));
  }, []);
  return { cfg, error };
}

export const txLink = (c: AppConfig | null, hash?: string) => (c?.explorer && hash ? `${c.explorer}/tx/${hash}` : undefined);
