import { NextResponse, connection } from "next/server";
import { orders, reconcile } from "@/lib/orders";
import { getPop } from "@/lib/pop";

/**
 * This store's own order book (Postgres). Statuses are only ever set after a signed webhook AND an on-chain recheck;
 * reconcile() also rebuilds/advances them from the chain alone, so a lost webhook or an empty table heals itself.
 */
export async function GET() {
  await connection();
  try {
    await reconcile(getPop().account.address);
  } catch (e) {
    console.error("[orders] reconcile failed:", e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ orders: await orders.all() });
}
