/**
 * Deploys SellerRegistry + PoPCheckout via forge (contracts/script/Deploy.s.sol) to the current NETWORK_MODE
 * and writes deployments/<mode>.json. Testnet needs ALLOW_TESTNET_DEPLOY=yes (team GO) and adds Blockscout verify.
 * Usage: npx tsx scripts/deploy.ts
 */
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { erc20Abi } from "viem";
import { USDT_ADDRESS } from "../packages/shared/src/index";
import { mode, net, pub, saveDeployment } from "./chain";
import { need, opt } from "./env";

if (mode === "testnet" && opt("ALLOW_TESTNET_DEPLOY") !== "yes") {
  throw new Error("Testnet deploy needs the team's GO: set ALLOW_TESTNET_DEPLOY=yes for this one run.");
}
const forge = join(homedir(), ".foundry", "bin", process.platform === "win32" ? "forge.exe" : "forge");
const args = ["script", "script/Deploy.s.sol", "--rpc-url", net.rpcUrl, "--private-key", need("DEPLOYER_PK"), "--broadcast"];
if (mode === "testnet") {
  args.push("--verify", "--verifier", "blockscout", "--verifier-url", "https://explorer.testnet.whitechain.io/api/");
}
const startBlock = await pub.getBlockNumber();
const r = spawnSync(forge, args, { cwd: resolve(import.meta.dirname, "..", "contracts"), encoding: "utf8", env: process.env });
// eslint-disable-next-line no-control-regex
const out = `${r.stdout}\n${r.stderr}`.replaceAll(need("DEPLOYER_PK"), "<redacted>").replace(/\x1b\[[0-9;]*m/g, "");
const grab = (label: string) =>
  out.match(new RegExp(label + String.raw`\s+(0x[0-9a-fA-F]{40})`))?.[1] as `0x${string}` | undefined;
const registry = grab("SellerRegistry");
const checkout = grab("PoPCheckout");
if (!out.includes("ONCHAIN EXECUTION COMPLETE & SUCCESSFUL") || !registry || !checkout) {
  console.error(`forge exit status: ${r.status} ok=${out.includes("ONCHAIN EXECUTION COMPLETE & SUCCESSFUL")} reg=${registry} chk=${checkout}`);
  console.error(out.slice(-3000));
  throw new Error("forge script failed");
}
const decimals = await pub.readContract({ address: USDT_ADDRESS, abi: erc20Abi, functionName: "decimals" });
saveDeployment({
  mode,
  chainId: net.chain.id,
  registry,
  checkout,
  token: USDT_ADDRESS,
  tokenDecimals: decimals,
  deployBlock: startBlock.toString(),
  deployedAt: new Date().toISOString(),
});
console.log({ mode, chainId: net.chain.id, registry, checkout, token: USDT_ADDRESS, decimals });
