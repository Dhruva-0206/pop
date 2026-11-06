import { NextResponse, connection } from "next/server";
import { store } from "@/lib/server/chain";
import { authMerchant } from "@/lib/server/merchants";
import { readOrder } from "@/lib/server/orders";

/** Merchant API: status of one of its sessions. Webhooks are the primary channel; this is for reconciliation. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  const merchant = await authMerchant(req);
  if (!merchant) return NextResponse.json({ error: "invalid api key" }, { status: 401 });
  const { id } = await ctx.params;
  const s = await store.sessionByListing(id);
  if (!s || s.merchantId !== merchant.id) return NextResponse.json({ error: "not found" }, { status: 404 });
  const order = (await store.ordersBySeller(merchant.sellerWallet)).find((o) => o.listingId === id);
  const live = order ? await readOrder(BigInt(order.orderId)) : null;
  return NextResponse.json({
    sessionId: s.id,
    merchantRef: s.merchantRef,
    expiresAt: s.expiresAt,
    status: live ? "paid" : "open",
    orderId: order?.orderId ?? null,
    state: live?.state ?? null,
  });
}
