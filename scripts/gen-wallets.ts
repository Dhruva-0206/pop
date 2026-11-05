/**
 * Generates throwaway TESTNET wallets and writes private keys ONLY into pop/.env (gitignored).
 * Prints addresses only. Never overwrites a key that is already set.
 * Usage: npx tsx scripts/gen-wallets.ts
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

const ROLES = [
  ["deployer", "DEPLOYER_PK"],
  ["attestor", "ATTESTOR_PK"],
  ["courier", "COURIER_PK"],
  ["faucet", "FAUCET_PK"],
  ["arbiter", "ARBITER_PK"],
  ["demo merchant (Kurta Co.)", "MERCHANT_PK"],
  ["test buyer (smoke tests)", "TEST_BUYER_PK"],
  ["demo seller (@meera.jewels)", "SELLER_PK"],
] as const;

const envPath = resolve(import.meta.dirname, "..", ".env");
if (!existsSync(envPath)) copyFileSync(resolve(import.meta.dirname, "..", ".env.example"), envPath);
let env = readFileSync(envPath, "utf8");

const rows: { role: string; address: string; status: string }[] = [];
for (const [role, key] of ROLES) {
  const re = new RegExp(`^${key}=(.*)$`, "m");
  const m = env.match(re);
  const existing = m?.[1]?.split("#")[0]?.trim();
  let pk: Hex;
  let status = "existing";
  if (existing && /^0x[0-9a-fA-F]{64}$/.test(existing)) {
    pk = existing as Hex;
  } else {
    pk = generatePrivateKey();
    status = "new";
    env = m ? env.replace(re, `${key}=${pk}`) : `${env.trimEnd()}\n${key}=${pk}\n`;
  }
  rows.push({ role, address: privateKeyToAccount(pk).address, status });
}

// Public addresses that other parts of the app need.
const attestor = rows.find((r) => r.role === "attestor")!.address;
env = env.replace(/^POP_ATTESTOR_ADDRESS=.*$/m, `POP_ATTESTOR_ADDRESS=${attestor}`);
if (/^WHITECHAIN_RPC_URL=\s*$/m.test(env)) env = env.replace(/^WHITECHAIN_RPC_URL=.*$/m, "WHITECHAIN_RPC_URL=https://rpc.testnet.whitechain.io");

// App secrets (random, never printed).
import { randomBytes } from "node:crypto";
for (const [k, gen] of [
  ["ADDRESS_ENC_KEY", () => randomBytes(32).toString("base64")],
  ["SESSION_SECRET", () => randomBytes(32).toString("hex")],
  ["COURIER_PASSCODE", () => randomBytes(4).toString("hex")],
] as const) {
  const re = new RegExp(`^${k}=(.*)$`, "m");
  const cur = env.match(re)?.[1]?.split("#")[0]?.trim();
  if (!cur) env = re.test(env) ? env.replace(re, `${k}=${gen()}`) : `${env.trimEnd()}
${k}=${gen()}
`;
}
writeFileSync(envPath, env);
console.table(rows);
