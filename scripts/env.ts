import { config } from "dotenv";
import { resolve } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

config({ path: resolve(import.meta.dirname, "..", ".env"), quiet: true });

export function need(name: string): string {
  const v = process.env[name]?.split("#")[0]?.trim();
  if (!v) throw new Error(`Missing ${name} in pop/.env`);
  return v;
}
export const opt = (name: string) => process.env[name]?.split("#")[0]?.trim() || undefined;

/** Address for a *_PK env var. Never logs the key. */
export const addrOf = (pkVar: string) => privateKeyToAccount(need(pkVar) as Hex).address;
export const accountOf = (pkVar: string) => privateKeyToAccount(need(pkVar) as Hex);

export const WALLET_VARS = [
  ["deployer", "DEPLOYER_PK"],
  ["attestor", "ATTESTOR_PK"],
  ["courier", "COURIER_PK"],
  ["faucet", "FAUCET_PK"],
  ["arbiter", "ARBITER_PK"],
  ["merchant", "MERCHANT_PK"],
  ["test buyer", "TEST_BUYER_PK"],
] as const;
