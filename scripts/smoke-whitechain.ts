/**
 * Smoke A: read the specified test USDT on Whitechain Sepolia (1874) + wallet balances.
 * Read-only. Usage: npx tsx scripts/smoke-whitechain.ts
 */
import { createPublicClient, erc20Abi, formatUnits, http, type Address } from "viem";
import { whitechainSepolia, USDT_ADDRESS } from "../packages/shared/src/index";
import { addrOf, opt, WALLET_VARS } from "./env";

// USDT listed in docs.whitechain.io token list; compared for the record only.
const DOCS_USDT: Address = "0xaa7962d073935D387e8d442DA1D7149C81388f46";

const client = createPublicClient({
  chain: whitechainSepolia,
  transport: http(opt("WHITECHAIN_RPC_URL") ?? whitechainSepolia.rpcUrls.default.http[0]),
});

async function token(address: Address) {
  const code = await client.getCode({ address });
  if (!code || code === "0x") return { address, deployed: false } as const;
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    client.readContract({ address, abi: erc20Abi, functionName: "name" }),
    client.readContract({ address, abi: erc20Abi, functionName: "symbol" }),
    client.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
    client.readContract({ address, abi: erc20Abi, functionName: "totalSupply" }),
  ]);
  return { address, deployed: true, name, symbol, decimals, totalSupply: formatUnits(totalSupply, decimals), codeBytes: (code.length - 2) / 2 } as const;
}

const chainId = await client.getChainId();
const block = await client.getBlockNumber();
console.log(`chainId=${chainId} block=${block}`);
if (chainId !== 1874) throw new Error(`Expected chain 1874, got ${chainId}`);

const specified = await token(USDT_ADDRESS);
const docs = await token(DOCS_USDT);
console.log("Specified USDT (prize text):", specified);
console.log("Docs-listed USDT (for comparison):", docs);

const rows = [];
for (const [role, v] of WALLET_VARS) {
  const a = addrOf(v);
  const wbt = await client.getBalance({ address: a });
  const usdt = specified.deployed
    ? await client.readContract({ address: USDT_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [a] })
    : 0n;
  rows.push({ role, address: a, WBT: formatUnits(wbt, 18), USDT: specified.deployed ? formatUnits(usdt, specified.decimals) : "n/a" });
}
console.table(rows);
