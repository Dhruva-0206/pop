import { NextResponse, connection } from "next/server";
import { keccak256, toHex, type Address } from "viem";
import { z } from "zod";
import { checkoutAbi, chunkedLogs } from "@pop/shared";
import { deployment, pub, store } from "@/lib/server/chain";
import { readOrder } from "@/lib/server/orders";
import { DISPUTE_TEXT_MAX, disputeReasonMessage } from "@/lib/messages";

const Body = z.object({ text: z.string().trim().min(1).max(DISPUTE_TEXT_MAX), signature: z.string().regex(/^0x[0-9a-fA-F]+$/) });

/**
 * Saves the buyer's reason text for a dispute they opened on-chain. Accepted only if: the order is Disputed, the buyer signed
 * the text, and keccak(text) equals the evidenceHash of the on-chain DisputeOpened event (so the arbiter reads exactly what
 * the buyer committed to). The contract itself never needs this text.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: `reason text is required (max ${DISPUTE_TEXT_MAX} characters)` }, { status: 400 });
  const { text, signature } = parsed.data;

  const order = await readOrder(BigInt(id));
  if (!order || order.state !== "Disputed") return NextResponse.json({ error: "order is not disputed" }, { status: 409 });
  const ok = await pub.verifyMessage({ address: order.buyer as Address, message: disputeReasonMessage(id, text), signature: signature as `0x${string}` }).catch(() => false);
  if (!ok) return NextResponse.json({ error: "only the buyer can add the reason" }, { status: 403 });

  const d = deployment();
  const tip = await pub.getBlockNumber({ cacheTime: 0 });
  const evs = await chunkedLogs(BigInt(d.deployBlock), tip, (fromBlock, toBlock) =>
    pub.getContractEvents({ address: d.checkout, abi: checkoutAbi, eventName: "DisputeOpened", args: { orderId: BigInt(id) }, fromBlock, toBlock }),
  );
  const hash = evs.at(-1)?.args.evidenceHash;
  if (!hash || keccak256(toHex(text)).toLowerCase() !== hash.toLowerCase()) {
    return NextResponse.json({ error: "text does not match the evidence hash recorded on-chain" }, { status: 409 });
  }
  await store.saveDisputeReason(id, text, hash, order.buyer);
  return NextResponse.json({ ok: true });
}
