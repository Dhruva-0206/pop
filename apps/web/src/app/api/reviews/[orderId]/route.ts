import { NextResponse, connection } from "next/server";
import { store } from "@/lib/server/chain";

/** Public status of a review for an order. Rating and text are public on Arkiv anyway; no signature or wallet data returned. */
export async function GET(_req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  await connection();
  const { orderId } = await ctx.params;
  if (!/^\d+$/.test(orderId)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const r = store.review(orderId);
  if (!r) return NextResponse.json({ exists: false });
  return NextResponse.json({
    exists: true,
    status: r.status,
    rating: r.rating,
    text: r.text,
    arkivKey: r.arkivKey,
    devSkippedWorld: r.devSkippedWorld,
    error: r.status === "synced" ? undefined : r.error,
  });
}
