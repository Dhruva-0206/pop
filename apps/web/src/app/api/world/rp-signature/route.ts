import { NextResponse, connection } from "next/server";
import { z } from "zod";
import { reviewActionFor, signRpContext, worldConfig } from "@/lib/server/world";
import { vendorAction } from "@/lib/server/vendor";

const Body = z.union([z.object({ seller: z.string().min(1).max(64) }), z.object({ vendor: z.literal(true) })]);

/** Short-lived RP signature for the seller's review action only. The signing key never leaves the server. */
export async function POST(req: Request) {
  await connection();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  // Vendor onboarding uses its own single action (VENDOR_WORLD_ACTION); reviews use one action per seller.
  const action = "vendor" in parsed.data ? vendorAction() : reviewActionFor(parsed.data.seller);
  if (!action) return NextResponse.json({ error: "reviews are not enabled for this seller yet" }, { status: 404 });
  const { appId, environment } = worldConfig();
  try {
    return NextResponse.json({ app_id: appId, action, environment, rp_context: signRpContext(action) });
  } catch {
    return NextResponse.json({ error: "World is not configured" }, { status: 503 });
  }
}
