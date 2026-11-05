import { NextResponse, connection } from "next/server";
import { decryptPII } from "@pop/shared/server/crypto";
import { getSession } from "@/lib/server/auth";
import { encKey, store } from "@/lib/server/chain";
import { readOrder } from "@/lib/server/orders";

/** Seller's orders with live chain state and the decrypted ship-to details (only for this seller's orders). */
export async function GET() {
  await connection();
  const s = await getSession<{ wallet: string }>("pop_seller");
  if (!s) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const seller = await store.sellerByWallet(s.wallet);
  const rows = await Promise.all(
    (await store.ordersBySeller(s.wallet)).map(async (o) => {
      let delivery: unknown = null;
      if (o.addressEnc) {
        try {
          delivery = JSON.parse(decryptPII(o.addressEnc, encKey()));
        } catch {
          delivery = { error: "cannot decrypt" };
        }
      }
      return { ...o, addressEnc: undefined, delivery, live: await readOrder(BigInt(o.orderId)) };
    }),
  );
  rows.sort((a, b) => Number(b.orderId) - Number(a.orderId));
  return NextResponse.json({ seller: { wallet: s.wallet, handle: seller?.handle, tier: seller?.handleTier }, orders: rows });
}
