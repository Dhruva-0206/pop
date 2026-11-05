import { NextResponse, connection } from "next/server";
import { z } from "zod";
import { setSession } from "@/lib/server/auth";
import { passcodeOk } from "@/lib/server/courier";

const Body = z.object({ passcode: z.string().min(1).max(64) });

/** SIMULATED COURIER sign-in with the team passcode. */
export async function POST(req: Request) {
  await connection();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !passcodeOk(parsed.data.passcode)) {
    return NextResponse.json({ error: "wrong passcode" }, { status: 401 });
  }
  await setSession("pop_courier", { role: "courier" });
  return NextResponse.json({ ok: true });
}
