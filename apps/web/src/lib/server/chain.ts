import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { networkFor, parseMode, type Deployment } from "@pop/shared";
import { createStore } from "@pop/shared/server/store";

export const mode = parseMode(process.env.NETWORK_MODE);
export const net = networkFor(mode, process.env.FORK_RPC_URL, process.env.WHITECHAIN_RPC_URL);
export const pub = createPublicClient({ chain: net.chain, transport: http(net.rpcUrl) });
export const store = createStore(mode);

function findRoot(): string {
  let d = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(resolve(d, "deployments")) || existsSync(resolve(d, "contracts"))) return d;
    d = dirname(d);
  }
  return process.cwd();
}

/** Addresses: env override (Vercel) or deployments/<mode>.json written by scripts/deploy.ts. */
export function deployment(): Deployment {
  if (process.env.CHECKOUT_ADDRESS && process.env.REGISTRY_ADDRESS && mode === "testnet") {
    return {
      mode,
      chainId: net.chain.id,
      checkout: process.env.CHECKOUT_ADDRESS as Address,
      registry: process.env.REGISTRY_ADDRESS as Address,
      token: (process.env.USDT_ADDRESS ?? "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7") as Address,
      tokenDecimals: Number(process.env.USDT_DECIMALS ?? 6),
      deployBlock: process.env.DEPLOY_BLOCK ?? "0",
      deployedAt: "",
    };
  }
  const p = resolve(findRoot(), "deployments", `${mode}.json`);
  if (!existsSync(p)) throw new Error(`No deployment for ${mode}`);
  return JSON.parse(readFileSync(p, "utf8"));
}

export function serverWallet(pkVar: "COURIER_PK" | "FAUCET_PK") {
  const pk = process.env[pkVar]?.trim();
  if (!pk) throw new Error(`${pkVar} not set`);
  return createWalletClient({ chain: net.chain, transport: http(net.rpcUrl), account: privateKeyToAccount(pk as Hex) });
}

export function encKey(): string {
  const k = process.env.ADDRESS_ENC_KEY?.trim();
  if (!k) throw new Error("ADDRESS_ENC_KEY not set");
  return k;
}

export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET?.trim();
  if (!s) throw new Error("SESSION_SECRET not set");
  return s;
}
