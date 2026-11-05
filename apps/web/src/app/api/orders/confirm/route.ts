import { NextResponse, connection } from "next/server";
import { decodeEventLog, getAddress, isHash, isHex } from "viem";
import { z } from "zod";
import { checkoutAbi } from "@pop/shared";
import { encryptPII } from "@pop/shared/server/crypto";
import { deployment, encKey, net, pub, store } from "@/lib/server/chain";
import { orderRegisterMessage } from "@/lib/messages";

const Body = z.object({
  txHash: z.string().refine((h) => isHash(h)),
  /** Signature by the buyer wallet over orderRegisterMessage(txHash, delivery). */
  signature: z.string().refine((s) => isHex(s)),
  delivery: z
    .object({ name: z.string().min(1).max(80), phone: z.string().min(5).max(20), address: z.string().min(5).max(400) })
    .optional(),
});

/**
 * The tx is the proof of payment; the buyer's signature is the proof of who is registering it.
 * Read the receipt, check it hit our checkout on this chain, decode OrderFunded, require a signature from
 * `OrderFunded.buyer` (so nobody else can pre-register an order with fake ship-to details), take the listing from
 * the on-chain `listingId` (never from the request), then store the order (delivery details encrypted).
 * Idempotent per (chainId, txHash, logIndex).
 */
export async function POST(req: Request) {
  await connection();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { txHash, signature, delivery } = parsed.data;
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
    const signedByBuyer = await pub
      .verifyMessage({
        address: a.buyer,
        message: orderRegisterMessage(txHash, delivery),
        signature: signature as `0x${string}`,
      })
      .catch(() => false);
    if (!signedByBuyer) return NextResponse.json({ error: "only the buyer can register this order" }, { status: 403 });
    const orderId = a.orderId.toString();
    const listing = await store.listingByIdHash(a.listingId);
    const fresh = await store.recordOrder(`${net.chain.id}:${txHash}:${log.logIndex}`, {
      orderId,
      sellerWallet: a.seller,
      buyerWallet: a.buyer,
      listingId: listing?.id,
      amountUnits: a.amount.toString(),
      addressEnc: delivery ? encryptPII(JSON.stringify(delivery), encKey()) : undefined,
      fundTx: txHash,
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, orderId, fresh });
  }
  return NextResponse.json({ error: "no OrderFunded event in transaction" }, { status: 400 });
}
