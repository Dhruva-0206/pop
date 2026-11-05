import { NextResponse, connection } from "next/server";
import { getAddress, isAddress, isHex, verifyMessage } from "viem";
import { z } from "zod";
import { setSession } from "@/lib/server/auth";
import { store } from "@/lib/server/chain";
import { sellerLoginMessage } from "@/lib/messages";

const Body = z.object({
  address: z.string().refine((a) => isAddress(a)),
  nonce: z.string().regex(/^[0-9a-f]{32}$/),
  signature: z.string().refine((s) => isHex(s)),
});

/**
 * Signed-message login (not full SIWE): signature over a server-issued single-use nonce, for a known seller wallet.
 * The nonce is consumed before the signature is checked, so a captured message can never be replayed.
 */
export async function POST(req: Request) {
  await connection();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const address = getAddress(parsed.data.address);
  if (!(await store.consumeLoginNonce(address, parsed.data.nonce))) {
    return NextResponse.json({ error: "nonce unknown, expired or already used" }, { status: 401 });
  }
  const ok = await verifyMessage({
    address,
    message: sellerLoginMessage(address, parsed.data.nonce),
    signature: parsed.data.signature as `0x${string}`,
  });
  if (!ok) return NextResponse.json({ error: "bad signature" }, { status: 401 });
  const seller = await store.sellerByWallet(address);
  if (!seller) return NextResponse.json({ error: "not a PoP seller wallet" }, { status: 403 });
  await setSession("pop_seller", { wallet: address });
  return NextResponse.json({ ok: true, handle: seller.handle });
}
