import { NextResponse } from "next/server";
import { z } from "zod";
import { getAddress, isAddress } from "viem";
import { reviewSignal, verifyReviewProof } from "@/lib/server/world";

const Body = z.object({
  orderId: z.string().regex(/^\d+$/),
  buyer: z.string().refine((a) => isAddress(a), "bad address"),
  idkitResult: z.record(z.string(), z.unknown()),
});

/**
 * Smoke D: verify a World proof for action "review" bound to signal keccak(orderId, buyer).
 * Phase 2 adds: buyer wallet signature, on-chain Released check, UNIQUE(nullifier, seller), Arkiv write.
 * The raw nullifier is never returned to the browser or logged.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  const { orderId, buyer, idkitResult } = parsed.data;
  const signal = reviewSignal(BigInt(orderId), getAddress(buyer));
  const v = await verifyReviewProof(idkitResult as never, signal);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.reason }, { status: v.status });
  console.log(`[world] review proof verified env=${v.environment} order=${orderId}`);
  return NextResponse.json({ ok: true, environment: v.environment, signal });
}
