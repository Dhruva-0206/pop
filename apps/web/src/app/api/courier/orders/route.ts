import { NextResponse, connection } from "next/server";
import { courierSession } from "@/lib/server/courier";
import { store } from "@/lib/server/chain";
import { readOrder } from "@/lib/server/orders";

/** Orders for the simulated courier (no buyer delivery details here). */
export async function GET() {
  await connection();
  if (!(await courierSession())) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const rows = await Promise.all(
    (await store.allOrders()).map(async (o) => ({
      orderId: o.orderId,
      listingId: o.listingId,
      trackingNo: o.trackingNo,
      courierStatus: o.courierStatus,
      live: await readOrder(BigInt(o.orderId)),
    })),
  );
  rows.sort((a, b) => Number(b.orderId) - Number(a.orderId));
  return NextResponse.json({ orders: rows });
}
