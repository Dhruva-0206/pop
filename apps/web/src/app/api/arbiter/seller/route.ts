import { NextResponse, connection } from "next/server";
import { zeroAddress, type Address } from "viem";
import { checkoutAbi, chunkedLogs, handleHash, registryAbi } from "@pop/shared";
import { deployment, pub } from "@/lib/server/chain";
import { readOrder } from "@/lib/server/orders";

const HANDLE_RE = /^[a-z0-9._]{1,30}$/;

/** Arbiter lookup of a seller by handle: standing, ban state and every still-open order (what a ban + force refund would touch). Public chain data. */
export async function GET(req: Request) {
  await connection();
  const handle = (new URL(req.url).searchParams.get("handle") ?? "").trim().toLowerCase().replace(/^@/, "");
  if (!HANDLE_RE.test(handle)) return NextResponse.json({ error: "bad handle" }, { status: 400 });
  const d = deployment();
  const hh = handleHash(handle);
  const owner = (await pub.readContract({ address: d.registry, abi: registryAbi, functionName: "handleOwner", args: [hh] })) as Address;
  if (owner === zeroAddress) return NextResponse.json({ error: "unknown handle" }, { status: 404 });
  const [active, bannedWallet, completed, lostDisputes] = await Promise.all([
    pub.readContract({ address: d.registry, abi: registryAbi, functionName: "isActive", args: [owner] }),
    pub.readContract({ address: d.registry, abi: registryAbi, functionName: "bannedWallet", args: [owner] }),
    pub.readContract({ address: d.checkout, abi: checkoutAbi, functionName: "completed", args: [owner] }),
    pub.readContract({ address: d.checkout, abi: checkoutAbi, functionName: "lostDisputes", args: [owner] }),
  ]);
  const tip = await pub.getBlockNumber({ cacheTime: 0 });
  const funded = await chunkedLogs(BigInt(d.deployBlock), tip, (fromBlock, toBlock) =>
    pub.getContractEvents({ address: d.checkout, abi: checkoutAbi, eventName: "OrderFunded", args: { seller: owner }, fromBlock, toBlock }),
  );
  const open = [];
  for (const e of funded.slice(-100)) {
    const live = await readOrder(e.args.orderId!);
    if (live && ["Funded", "Shipped", "Disputed"].includes(live.state)) open.push({ orderId: live.orderId, state: live.state, amount: live.amount, buyer: live.buyer });
  }
  return NextResponse.json({
    handle,
    wallet: owner,
    active,
    banned: bannedWallet,
    completed: completed.toString(),
    lostDisputes: lostDisputes.toString(),
    totalOrders: funded.length,
    openOrders: open,
  });
}
