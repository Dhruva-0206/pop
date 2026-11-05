/** Shared helpers for scripts: network mode, clients, deployments. Never logs keys. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { networkFor, parseMode, type Deployment, type NetworkMode } from "../packages/shared/src/index";
import { need, opt } from "./env";

export const mode: NetworkMode = parseMode(opt("NETWORK_MODE"));
export const net = networkFor(mode, opt("FORK_RPC_URL"), opt("WHITECHAIN_RPC_URL"));
export const pub = createPublicClient({ chain: net.chain, transport: http(net.rpcUrl) });
export const walletOf = (pkVar: string) =>
  createWalletClient({ chain: net.chain, transport: http(net.rpcUrl), account: privateKeyToAccount(need(pkVar) as Hex) });

const depDir = resolve(import.meta.dirname, "..", "deployments");
export const depPath = (m: NetworkMode = mode) => resolve(depDir, `${m}.json`);
export function loadDeployment(m: NetworkMode = mode): Deployment {
  if (!existsSync(depPath(m))) throw new Error(`No deployment for ${m}. Run: npx tsx scripts/deploy.ts`);
  return JSON.parse(readFileSync(depPath(m), "utf8"));
}
export function saveDeployment(d: Deployment) {
  mkdirSync(depDir, { recursive: true });
  writeFileSync(depPath(d.mode), JSON.stringify(d, null, 2) + "\n");
}

/** Throws unless the RPC is a local anvil node. Guards every fork-only write. */
export async function assertLocalAnvil() {
  if (mode !== "fork") throw new Error("This script is LOCAL FORK only (NETWORK_MODE=fork).");
  const v = (await pub.request({ method: "web3_clientVersion" as never })) as string;
  if (!/anvil/i.test(v)) throw new Error(`Refusing: RPC is not anvil (${v})`);
}
