import "server-only";
import type { Address, Hex } from "viem";
import { PoP } from "@pop/checkout-sdk/server";

/** This store's own credentials (apps/demo-store/.env.local or the Vercel project env). It never reads PoP's server secrets. */
function need(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name} in apps/demo-store/.env.local (run: npx tsx scripts/seed-merchant.ts)`);
  return v;
}

export const POP_BASE_URL = () => process.env.POP_BASE_URL?.trim() || "http://localhost:3000";

/**
 * Optional pin: set CHAIN_ID + RPC_URL + CHECKOUT_ADDRESS + REGISTRY_ADDRESS + DEPLOY_BLOCK and the on-chain recheck and the reputation reads
 * no longer rely on PoP to tell us which contract is the real one. Without them we fall back to PoP's public /api/config (dev).
 */
export function pinnedChain(): { id: number; rpcUrl: string; checkout: Address; registry: Address; deployBlock: string } | undefined {
  const e = process.env;
  if (e.CHAIN_ID && e.RPC_URL && e.CHECKOUT_ADDRESS && e.REGISTRY_ADDRESS && e.DEPLOY_BLOCK) {
    return { id: Number(e.CHAIN_ID), rpcUrl: e.RPC_URL, checkout: e.CHECKOUT_ADDRESS as Address, registry: e.REGISTRY_ADDRESS as Address, deployBlock: e.DEPLOY_BLOCK };
  }
  return undefined;
}

let pop: PoP | undefined;
export function getPop(): PoP {
  const pin = pinnedChain();
  return (pop ??= new PoP({
    baseUrl: POP_BASE_URL(),
    apiKey: need("POP_API_KEY"),
    webhookSecret: need("POP_WEBHOOK_SECRET"),
    merchantPk: need("MERCHANT_PK") as Hex,
    chain: pin && { id: pin.id, rpcUrl: pin.rpcUrl, checkout: pin.checkout },
  }));
}
