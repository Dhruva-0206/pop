import { NextResponse, connection } from "next/server";
import { readOrder } from "@/lib/server/orders";
import { store } from "@/lib/server/chain";

/** Live order state from the contract + non-private metadata. Never returns delivery details. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const live = await readOrder(BigInt(id));
  if (!live) return NextResponse.json({ error: "not found" }, { status: 404 });
  const meta = await store.order(id);
  const listing = meta?.listingId ? await store.listing(meta.listingId) : undefined;
  return NextResponse.json({
    order: live,
    meta: meta
      ? { listingId: meta.listingId, fundTx: meta.fundTx, trackingNo: meta.trackingNo, courierStatus: meta.courierStatus }
      : null,
    listing: listing
      ? { id: listing.id, title: listing.title, priceInr: listing.priceInr, sellerHandle: listing.sellerHandle }
      : null,
  });
}
