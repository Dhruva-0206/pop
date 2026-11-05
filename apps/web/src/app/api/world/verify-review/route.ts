import { NextResponse, connection } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { isHex } from "viem";
import { pub, store } from "@/lib/server/chain";
import { readOrder } from "@/lib/server/orders";
import { reviewActionFor, reviewSignal, verifyReviewProof } from "@/lib/server/world";
import { reviewAuthMessage } from "@/lib/messages";

const Body = z.object({
  seller: z.string().min(1).max(64), // seller handle
  orderId: z.string().regex(/^\d+$/),
  /** Signature by the buyer wallet over reviewAuthMessage(orderId, seller). */
  buyerSignature: z.string().refine((s) => isHex(s)),
  idkitResult: z.record(z.string(), z.unknown()),
});

/**
 * World-gated review check. Order of checks (cheapest and most private first, World last):
 *  1. the seller has a review action and is a known seller;
 *  2. the order is Released ON-CHAIN and belongs to that seller;
 *  3. the caller is the order's on-chain buyer (wallet signature; the buyer address is read from the chain, not the request);
 *  4. the World proof is valid for this action and signal keccak(orderId, buyer);
 *  5. the (nullifier, seller) pair is claimed atomically (UNIQUE(nullifier, seller) defence in depth; one review per order).
 * Success is only returned after all five. The raw nullifier is never returned or logged.
 * Still TODO (Phase 2): rating/text, Arkiv readonly write, changeOwnership to the buyer.
 */
export async function POST(req: Request) {
  await connection();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  const { seller, orderId, buyerSignature, idkitResult } = parsed.data;

  const action = reviewActionFor(seller);
  const sellerRow = store.sellerByHandle(seller);
  if (!action || !sellerRow) return NextResponse.json({ ok: false, error: "reviews are not enabled for this seller" }, { status: 404 });

  const order = await readOrder(BigInt(orderId));
  if (!order || order.seller.toLowerCase() !== sellerRow.wallet.toLowerCase()) {
    return NextResponse.json({ ok: false, error: "order not found for this seller" }, { status: 404 });
  }
  if (order.state !== "Released") {
    return NextResponse.json({ ok: false, error: "reviews open after the order is complete and the seller is paid" }, { status: 409 });
  }

  const isBuyer = await pub
    .verifyMessage({
      address: order.buyer as `0x${string}`,
      message: reviewAuthMessage(orderId, seller),
      signature: buyerSignature as `0x${string}`,
    })
    .catch(() => false);
  if (!isBuyer) return NextResponse.json({ ok: false, error: "only the buyer of this order can review it" }, { status: 403 });

  const signal = reviewSignal(BigInt(orderId), order.buyer as `0x${string}`);
  const v = await verifyReviewProof(idkitResult as never, action, signal);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.reason }, { status: v.status });

  const nullifierHash = createHash("sha256").update(v.nullifier).digest("hex"); // store a hash, not the raw nullifier
  if (!store.claimReviewNullifier(nullifierHash, sellerRow.wallet, orderId)) {
    return NextResponse.json({ ok: false, error: "this person has already reviewed this seller, or this order already has a review" }, { status: 409 });
  }
  console.log(`[world] review claimed env=${v.environment} action=${action} order=${orderId}`);
  return NextResponse.json({ ok: true, environment: v.environment, action, signal });
}
