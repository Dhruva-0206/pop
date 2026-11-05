/**
 * Starts a LOCAL anvil fork of Whitechain Sepolia (real USDT bytecode) with chain id 31337.
 * Usage: npx tsx scripts/fork.ts   (leave it running)
 */
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { opt } from "./env";

const anvil = join(homedir(), ".foundry", "bin", process.platform === "win32" ? "anvil.exe" : "anvil");
const forkUrl = opt("WHITECHAIN_RPC_URL") ?? "https://rpc.testnet.whitechain.io";
const port = new URL(opt("FORK_RPC_URL") ?? "http://127.0.0.1:8545").port || "8545";
console.log(`LOCAL FORK of ${forkUrl} on :${port} (chain id 31337). Not a real network.`);
const p = spawn(anvil, ["--fork-url", forkUrl, "--port", port, "--chain-id", "31337", "--host", "127.0.0.1"], {
  stdio: ["ignore", "inherit", "inherit"],
});
p.on("exit", (c) => process.exit(c ?? 0));
