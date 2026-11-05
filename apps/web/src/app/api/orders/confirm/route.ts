import { NextResponse, connection } from "next/server";
import { decodeEventLog, getAddress, isHash } from "viem";
import { z } from "zod";
import { checkoutAbi } from "@pop/shared";
import { encryptPII } from "@pop/shared/server/crypto";
import { deployment, encKey, net, pub, store } from "@/lib/server/chain";

const Body = z.object({
  txHash: z.string().refine((h) => isHash(h)),
  listingId: z.string().max(64).optional(),
  delivery: z
    .object({ name: z.string().min(1).max(80), phone: z.string().min(5).max(20), address: z.string().min(5).max(400) })
    .optional(),
});

/**
 * The tx is the proof: read the receipt, check it hit our checkout on this chain, decode OrderFunded,
 * then store the order (delivery details encrypted). Idempotent per (chainId, txHash, logIndex).
 */
export async function POST(req: Request) {
  await connection();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { txHash, listingId, delivery } = parsed.data;
  const d = deployment();
  const rc = await pub.getTransactionReceipt({ hash: txHash as `0x${string}` }).catch(() => null);
  if (!rc || rc.status !== "success") {
    return NextResponse.json({ error: "transaction not found or failed" }, { status: 400 });
  }
  if (!rc.to || getAddress(rc.to) !== getAddress(d.checkout)) {
    return NextResponse.json({ error: "not a PoP checkout transaction" }, { status: 400 });
  }
  for (const log of rc.logs) {
    if (getAddress(log.address) !== getAddress(d.checkout)) continue;
    let ev;
    try {
      ev = decodeEventLog({ abi: checkoutAbi, data: log.data, topics: log.topics });
    } catch {
      continue;
    }
    if (ev.eventName !== "OrderFunded") continue;
    const a = ev.args;
    const orderId = a.orderId.toString();
    const fresh = store.recordOrder(`${net.chain.id}:${txHash}:${log.logIndex}`, {
      orderId,
      sellerWallet: a.seller,
      buyerWallet: a.buyer,
      listingId,
      amountUnits: a.amount.toString(),
      addressEnc: delivery ? encryptPII(JSON.stringify(delivery), encKey()) : undefined,
      fundTx: txHash,
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, orderId, fresh });
  }
  return NextResponse.json({ error: "no OrderFunded event in transaction" }, { status: 400 });
}
