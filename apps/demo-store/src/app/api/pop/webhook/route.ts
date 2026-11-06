import { NextResponse } from "next/server";
import { formatUnits } from "viem";
import { getPop } from "@/lib/pop";
import { orders } from "@/lib/orders";

/**
 * PoP webhook receiver. Order of trust: (1) HMAC signature over the RAW body, (2) the contract itself: the order must be ours,
 * match the event and be in a fitting state, and its funding tx must carry our merchantRef. Only then do we update our order book.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const pop = getPop();
  let ev;
  try {
    ev = pop.verifyWebhook(raw, req.headers.get("pop-signature"));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "bad signature" }, { status: 400 });
  }
  try {
    const { state, amount } = await pop.confirmOnChain(ev);
    const r = await orders.apply(ev, state, formatUnits(amount, 6));
    return NextResponse.json({ ok: true, result: r, onChainState: state });
  } catch (e) {
    // Signed but the chain disagrees (or RPC trouble): do NOT update anything. 422 makes PoP retry a few times.
    console.error("[webhook] on-chain recheck failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "on-chain recheck failed" }, { status: 422 });
  }
}
