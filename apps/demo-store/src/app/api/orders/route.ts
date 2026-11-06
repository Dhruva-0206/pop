import { NextResponse, connection } from "next/server";
import { orders } from "@/lib/orders";

/** This store's own order book (statuses are only ever set after a signed webhook AND an on-chain recheck). */
export async function GET() {
  await connection();
  return NextResponse.json({ orders: orders.all() });
}
