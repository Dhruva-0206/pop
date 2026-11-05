import { NextResponse, connection } from "next/server";
import { getAddress, isAddress } from "viem";
import { z } from "zod";
import { store } from "@/lib/server/chain";

const Body = z.object({ address: z.string().refine((a) => isAddress(a)) });

/** Issues a single-use login nonce (5 min) for a known seller wallet. Unknown wallets get nothing stored. */
export async function POST(req: Request) {
  await connection();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const address = getAddress(parsed.data.address);
  if (!store.sellerByWallet(address)) return NextResponse.json({ error: "not a PoP seller wallet" }, { status: 403 });
  return NextResponse.json({ nonce: store.issueLoginNonce(address) });
}
