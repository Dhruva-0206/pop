import { NextResponse, connection } from "next/server";
import { keccak256, toHex } from "viem";
import { checkoutAbi, chunkedLogs } from "@pop/shared";
import { deployment, pub, store } from "@/lib/server/chain";
import { readOrder } from "@/lib/server/orders";

const MAX = 100;

/**
 * Orders currently in Disputed, from the contract's own events (HandoverRefused = courier, DisputeOpened = buyer), with the live
 * state, the arbiter deadline and the buyer's reason text if it was saved AND matches the on-chain evidenceHash. Public data (no
 * delivery details). The arbiter acts with their own wallet in the browser; the contract enforces ARBITER_ROLE.
 */
export async function GET() {
  await connection();
  const d = deployment();
  const tip = await pub.getBlockNumber({ cacheTime: 0 });
  const from = BigInt(d.deployBlock);
  const [refused, opened] = await Promise.all([
    chunkedLogs(from, tip, (fromBlock, toBlock) => pub.getContractEvents({ address: d.checkout, abi: checkoutAbi, eventName: "HandoverRefused", fromBlock, toBlock })),
    chunkedLogs(from, tip, (fromBlock, toBlock) => pub.getContractEvents({ address: d.checkout, abi: checkoutAbi, eventName: "DisputeOpened", fromBlock, toBlock })),
  ]);
  const kind = new Map<string, { kind: "handover-refused" | "buyer-dispute"; evidenceHash?: string }>();
  for (const e of refused) kind.set(e.args.orderId!.toString(), { kind: "handover-refused" });
  for (const e of opened) kind.set(e.args.orderId!.toString(), { kind: "buyer-dispute", evidenceHash: e.args.evidenceHash });

  const ids = [...kind.keys()].slice(-MAX);
  const out = [];
  for (const id of ids) {
    const live = await readOrder(BigInt(id));
    if (!live || live.state !== "Disputed") continue;
    const k = kind.get(id)!;
    const saved = await store.disputeReason(id);
    const reasonOk = saved?.reason && k.evidenceHash && keccak256(toHex(saved.reason)).toLowerCase() === k.evidenceHash.toLowerCase();
    const seller = await store.sellerByWallet(live.seller);
    out.push({
      orderId: id,
      kind: k.kind,
      buyer: live.buyer,
      seller: live.seller,
      sellerHandle: seller?.handle ?? null,
      amount: live.amount,
      disputedAt: live.disputedAt,
      arbiterDeadline: live.arbiterDeadline,
      now: live.now,
      expired: live.canFinalize,
      reason: reasonOk ? saved!.reason : null,
    });
  }
  out.sort((a, b) => Number(b.orderId) - Number(a.orderId));
  return NextResponse.json({ disputes: out });
}
