import { NextResponse } from "next/server";
import { signRpContext, worldConfig } from "@/lib/server/world";

/** Returns a short-lived RP signature for the review action only. The signing key never leaves the server. */
export async function POST() {
  const { appId, action, environment } = worldConfig();
  try {
    return NextResponse.json({ app_id: appId, action, environment, rp_context: signRpContext(action) });
  } catch {
    return NextResponse.json({ error: "World is not configured" }, { status: 503 });
  }
}
