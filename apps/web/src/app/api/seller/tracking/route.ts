import { NextResponse, connection } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/server/auth";
import { store } from "@/lib/server/chain";

const Body = z.object({ orderId: z.string().regex(/^\d+$/), trackingNo: z.string().min(1).max(64) });

/** Seller saves the tracking number (its keccak goes on-chain in markShipped from the seller's own wallet). */
export async function POST(req: Request) {
  await connection();
  const s = await getSession<{ wallet: string }>("pop_seller");
  if (!s) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const o = await store.order(parsed.data.orderId);
  if (!o || o.sellerWallet.toLowerCase() !== s.wallet.toLowerCase()) {
    return NextResponse.json({ error: "not your order" }, { status: 403 });
  }
  await store.patchOrder(o.orderId, { trackingNo: parsed.data.trackingNo });
  return NextResponse.json({ ok: true });
}
