import { NextResponse, connection } from "next/server";
import { getPop } from "@/lib/pop";
import { readReputation } from "@/lib/reputation";

/** The store's own record (JSON), read straight from the contracts and from Arkiv with this store's own key. */
export async function GET() {
  await connection();
  try {
    return NextResponse.json(await readReputation(getPop().account.address));
  } catch (e) {
    console.error("[record]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "record unavailable" }, { status: 502 });
  }
}
