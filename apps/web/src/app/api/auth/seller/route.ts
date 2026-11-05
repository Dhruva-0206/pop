import { NextResponse, connection } from "next/server";
import { getAddress, isAddress, isHex, verifyMessage } from "viem";
import { z } from "zod";
import { setSession } from "@/lib/server/auth";
import { store } from "@/lib/server/chain";
import { sellerLoginMessage } from "@/lib/messages";

const Body = z.object({
  address: z.string().refine((a) => isAddress(a)),
  issuedAt: z.string(),
  signature: z.string().refine((s) => isHex(s)),
});

/** Signed-message login (not full SIWE): signature over a fresh timestamped message, for a known seller wallet. */
export async function POST(req: Request) {
  await connection();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const address = getAddress(parsed.data.address);
  const age = Date.now() - Date.parse(parsed.data.issuedAt);
  if (!(age >= -60_000 && age < 5 * 60_000)) return NextResponse.json({ error: "message expired" }, { status: 400 });
  const ok = await verifyMessage({
    address,
    message: sellerLoginMessage(address, parsed.data.issuedAt),
    signature: parsed.data.signature as `0x${string}`,
  });
  if (!ok) return NextResponse.json({ error: "bad signature" }, { status: 401 });
  const seller = store.sellerByWallet(address);
  if (!seller) return NextResponse.json({ error: "not a PoP seller wallet" }, { status: 403 });
  await setSession("pop_seller", { wallet: address });
  return NextResponse.json({ ok: true, handle: seller.handle });
}
