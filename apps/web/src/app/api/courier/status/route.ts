import { NextResponse, connection } from "next/server";
import { z } from "zod";
import { courierSession } from "@/lib/server/courier";
import { store } from "@/lib/server/chain";

const STATUSES = ["Picked up", "In transit", "Out for delivery"] as const;
const Body = z.object({ orderId: z.string().regex(/^\d+$/), status: z.enum(STATUSES) });

/** SIMULATED courier status. Database only: no chain truth is claimed for these. */
export async function POST(req: Request) {
  await connection();
  if (!(await courierSession())) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (!store.order(parsed.data.orderId)) return NextResponse.json({ error: "unknown order" }, { status: 404 });
  store.patchOrder(parsed.data.orderId, { courierStatus: `${parsed.data.status} (simulated)` });
  return NextResponse.json({ ok: true });
}
