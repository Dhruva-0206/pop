import { NextResponse, connection } from "next/server";
import { deployment, mode, net } from "@/lib/server/chain";
import { devSkipWorld } from "@/lib/server/world";

/** Public network config for the browser (addresses, RPC, labels). No secrets. Always request-time. */
export async function GET() {
  await connection();
  const d = deployment();
  return NextResponse.json({
    mode,
    label: net.label,
    isLocalFork: net.isLocalFork,
    chainId: net.chain.id,
    rpcUrl: net.rpcUrl,
    checkout: d.checkout,
    registry: d.registry,
    deployBlock: d.deployBlock,
    token: d.token,
    tokenDecimals: d.tokenDecimals,
    explorer: net.isLocalFork ? null : "https://explorer.testnet.whitechain.io",
    devSkipWorld: devSkipWorld() === "on",
  });
}
