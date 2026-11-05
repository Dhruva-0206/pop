import { NextResponse, connection } from "next/server";
import { z } from "zod";
import { isHex, type Address } from "viem";
import { pub, store } from "@/lib/server/chain";
import { publishReviewRow } from "@/lib/server/reviews";
import { reviewRetryMessage } from "@/lib/messages";

const Body = z.object({
  seller: z.string().min(1).max(64),
  orderId: z.string().regex(/^\d+$/),
  /** Signature by the buyer wallet over reviewRetryMessage(orderId, seller). */
  buyerSignature: z.string().refine((s) => isHex(s)),
});

/**
 * Retry the Arkiv write for a review that was already ACCEPTED (nullifier claimed, row stored) but whose
 * publish is pending or failed. Needs only the buyer's signature: no new World proof, no second nullifier row,
 * and the Arkiv helper looks the entity up first, so a retry can never create a duplicate.
 */
export async function POST(req: Request) {
  await connection();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  const { seller, orderId, buyerSignature } = parsed.data;
  const r = store.review(orderId);
  if (!r || r.sellerHandle.toLowerCase() !== seller.trim().toLowerCase()) {
    return NextResponse.json({ ok: false, error: "no accepted review for this order" }, { status: 404 });
  }
  const isBuyer = await pub
    .verifyMessage({
      address: r.buyerWallet as Address,
      message: reviewRetryMessage(orderId, seller),
      signature: buyerSignature as `0x${string}`,
    })
    .catch(() => false);
  if (!isBuyer) return NextResponse.json({ ok: false, error: "only the buyer of this order can retry" }, { status: 403 });
  const out = await publishReviewRow(orderId);
  return NextResponse.json({ ok: out.status === "synced", status: out.status, arkivKey: out.arkivKey, retry: out.status === "failed", error: out.error });
}
