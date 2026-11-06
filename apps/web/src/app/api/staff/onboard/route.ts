import { NextResponse, connection } from "next/server";
import { z } from "zod";
import { handleHash } from "@pop/shared";
import { courierSession } from "@/lib/server/courier";
import { store } from "@/lib/server/chain";
import { signRegistration } from "@/lib/server/onboarding";

/** Staff (team passcode session, same as the courier page): pending onboarding requests. */
export async function GET() {
  await connection();
  if (!(await courierSession())) return NextResponse.json({ error: "staff sign-in required" }, { status: 401 });
  return NextResponse.json({ pending: await store.pendingOnboarding() });
}

const Body = z.object({ id: z.number().int().positive(), approve: z.boolean() });

/**
 * Staff decision. Approve = "I opened the Instagram profile and the bio code is there": the attestor signs the Registration (tier 1)
 * that the seller then submits to SellerRegistry. Only a pending request can be decided, once.
 */
export async function POST(req: Request) {
  await connection();
  if (!(await courierSession())) return NextResponse.json({ error: "staff sign-in required" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const row = await store.onboardingById(parsed.data.id);
  if (!row || row.status !== "pending") return NextResponse.json({ error: "no such pending request" }, { status: 404 });
  if (!parsed.data.approve) {
    await store.decideOnboarding(row.id, false);
    return NextResponse.json({ ok: true, status: "rejected" });
  }
  const reg = await signRegistration(row.wallet as `0x${string}`, handleHash(row.handle));
  if (!(await store.decideOnboarding(row.id, true, reg))) return NextResponse.json({ error: "already decided" }, { status: 409 });
  return NextResponse.json({ ok: true, status: "approved" });
}
