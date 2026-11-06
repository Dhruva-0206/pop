import { NextResponse, connection } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { encodePacked, isHex, keccak256, type Address } from "viem";
import { DEV_REVIEWER_PREFIX } from "@pop/shared/server/arkiv";
import { historyBucket } from "@pop/shared/server/store";
import { pub, store } from "@/lib/server/chain";
import { readOrder } from "@/lib/server/orders";
import { logWorld, publishReviewRow } from "@/lib/server/reviews";
import { devSkipWorld, reviewActionFor, reviewSignal, reviewerKey, verifyReviewProof } from "@/lib/server/world";
import { REVIEW_TEXT_MAX, normaliseReviewText, reviewAuthMessage } from "@/lib/messages";

const Body = z.object({
  seller: z.string().min(1).max(64), // seller handle
  orderId: z.string().regex(/^\d+$/),
  rating: z.number().int().min(1).max(5),
  text: z.string().max(REVIEW_TEXT_MAX * 4).default(""), // raw; the real limit is applied after normalisation
  /** Signature by the buyer wallet over reviewAuthMessage(orderId, seller, rating, text). */
  buyerSignature: z.string().refine((s) => isHex(s)),
  idkitResult: z.record(z.string(), z.unknown()).optional(),
  /** DEV ONLY: honoured only when POP_DEV_SKIP_WORLD=1 on a local `next dev` server. Ignored everywhere else. */
  skipWorld: z.boolean().optional(),
});

/**
 * Review pipeline. Order of checks (cheapest and most private first, World last):
 *  1. the seller has a review action and is a known seller;
 *  2. the order is Released ON-CHAIN and belongs to that seller; no review exists for it yet;
 *  3. the caller is the order's on-chain buyer (wallet signature over order, seller, rating and text);
 *  4. the World proof is valid for this action and signal keccak(orderId, buyer)  [skippable ONLY by the DEV flag];
 *  5. the (nullifier, seller) pair and the pending review row are claimed atomically (one review per order);
 *  6. the readonly Arkiv entity is created by the attestor and transferred to the buyer. This step is retryable
 *     (POST /api/reviews/retry) WITHOUT a second nullifier claim; the row keeps entity key + status.
 * The raw nullifier is never stored, returned or logged.
 */
export async function POST(req: Request) {
  await connection();

  const dev = devSkipWorld();
  if (dev === "forbidden") {
    // Fail closed: someone enabled the DEV skip on a deployed/production build.
    console.error("[world] POP_DEV_SKIP_WORLD is set on a non-development build. Refusing all reviews until it is removed.");
    return NextResponse.json({ ok: false, error: "server misconfigured" }, { status: 500 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  const { seller, orderId, rating, buyerSignature, idkitResult } = parsed.data;
  const text = normaliseReviewText(parsed.data.text);
  if (text.length > REVIEW_TEXT_MAX) return NextResponse.json({ ok: false, error: `review text is limited to ${REVIEW_TEXT_MAX} characters` }, { status: 400 });
  const skipWorld = dev === "on" && parsed.data.skipWorld === true;
  if (!skipWorld && !idkitResult) return NextResponse.json({ ok: false, error: "World ID proof required" }, { status: 400 });

  const action = reviewActionFor(seller);
  const sellerRow = await store.sellerByHandle(seller);
  if (!sellerRow || (!skipWorld && !action)) {
    return NextResponse.json({ ok: false, error: "reviews are not enabled for this seller" }, { status: 404 });
  }

  const order = await readOrder(BigInt(orderId));
  if (!order || order.seller.toLowerCase() !== sellerRow.wallet.toLowerCase()) {
    return NextResponse.json({ ok: false, error: "order not found for this seller" }, { status: 404 });
  }
  if (order.state !== "Released") {
    return NextResponse.json({ ok: false, error: "reviews open after the order is complete and the seller is paid" }, { status: 409 });
  }
  const already = await store.review(orderId);
  if (already) {
    return NextResponse.json(
      {
        ok: false,
        error: already.status === "synced" ? "this order already has a review" : "your review was accepted but not published yet: use retry",
        status: already.status,
        retry: already.status !== "synced",
      },
      { status: 409 },
    );
  }

  const isBuyer = await pub
    .verifyMessage({
      address: order.buyer as Address,
      message: reviewAuthMessage(orderId, seller, rating, text),
      signature: buyerSignature as `0x${string}`,
    })
    .catch(() => false);
  if (!isBuyer) return NextResponse.json({ ok: false, error: "only the buyer of this order can review it" }, { status: 403 });

  let nullifier: string;
  let publicKey: string;
  if (skipWorld) {
    console.warn(`[world] DEV: World proof SKIPPED for order ${orderId} (POP_DEV_SKIP_WORLD=1). Not a verified human.`);
    await logWorld({ sellerHandle: sellerRow.handle, orderId, outcome: "dev-skipped", detail: "POP_DEV_SKIP_WORLD (local dev only), no World proof" });
    nullifier = `dev-skip:${orderId}`;
    publicKey = DEV_REVIEWER_PREFIX + keccak256(encodePacked(["uint256", "address"], [BigInt(orderId), sellerRow.wallet as Address])).slice(2);
  } else {
    const signal = reviewSignal(BigInt(orderId), order.buyer as Address);
    const v = await verifyReviewProof(idkitResult as never, action!, signal);
    if (!v.ok) {
      await logWorld({ sellerHandle: sellerRow.handle, orderId, outcome: "rejected", detail: v.reason, action: action ?? undefined });
      return NextResponse.json({ ok: false, error: v.reason }, { status: v.status });
    }
    nullifier = v.nullifier;
    publicKey = reviewerKey(v.nullifier, sellerRow.wallet as Address);
  }

  const nullifierHash = createHash("sha256").update(nullifier).digest("hex"); // store a hash, not the raw nullifier
  // Buyer history bucket (1, 2-5, 6+) from the orders table; includes the order being reviewed.
  const buyerHistory = historyBucket(await store.buyerOrderCount(order.buyer));
  const claimed = await store.claimReview(nullifierHash, {
    orderId,
    sellerWallet: sellerRow.wallet,
    sellerHandle: sellerRow.handle,
    buyerWallet: order.buyer,
    rating,
    text,
    reviewerKey: publicKey,
    buyerSig: buyerSignature,
    payTx: (await store.order(orderId))?.fundTx,
    buyerHistory,
    devSkippedWorld: skipWorld,
  });
  if (!claimed) {
    await logWorld({ sellerHandle: sellerRow.handle, orderId, outcome: "replay", detail: "nullifier already used for this seller, or order already reviewed", action: action ?? undefined, nullifierHint: nullifierHash.slice(0, 12) });
    return NextResponse.json({ ok: false, error: "this person has already reviewed this seller, or this order already has a review" }, { status: 409 });
  }

  if (!skipWorld) await logWorld({ sellerHandle: sellerRow.handle, orderId, outcome: "verified", detail: "World proof verified server-side; review claimed", action: action ?? undefined, nullifierHint: nullifierHash.slice(0, 12) });
  const out = await publishReviewRow(orderId);
  console.log(`[review] order=${orderId} accepted; arkiv=${out.status}${skipWorld ? " (DEV, no World proof)" : ""}`);
  return NextResponse.json({
    ok: true,
    status: out.status,
    arkivKey: out.arkivKey,
    retry: out.status === "failed",
    error: out.error,
    devSkippedWorld: skipWorld,
  });
}

// Vercel max duration (seconds): World verify, then two Arkiv transactions (create, change owner) that each wait for a receipt.
export const maxDuration = 60;
