import { NextResponse, connection } from "next/server";
import { z } from "zod";
import { reviewActionFor, signRpContext, worldConfig } from "@/lib/server/world";

const Body = z.object({ seller: z.string().min(1).max(64) });

/** Short-lived RP signature for the seller's review action only. The signing key never leaves the server. */
export async function POST(req: Request) {
  await connection();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const action = reviewActionFor(parsed.data.seller);
  if (!action) return NextResponse.json({ error: "reviews are not enabled for this seller yet" }, { status: 404 });
  const { appId, environment } = worldConfig();
  try {
    return NextResponse.json({ app_id: appId, action, environment, rp_context: signRpContext(action) });
  } catch {
    return NextResponse.json({ error: "World is not configured" }, { status: 503 });
  }
}
