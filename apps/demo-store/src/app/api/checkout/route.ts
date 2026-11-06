import { NextResponse } from "next/server";
import { getPop } from "@/lib/pop";
import { orders } from "@/lib/orders";
import { PRODUCT } from "@/lib/product";

/** "Pay with PoP", server side: create a checkout session (we sign the Offer with our own seller key) and hand back the hosted URL. */
export async function POST(req: Request) {
  const ref = orders.create(); // our own cart id; PoP echoes it in every webhook
  const origin = process.env.KURTA_ORIGIN?.trim() || new URL(req.url).origin;
  try {
    const s = await getPop().createSession({ title: PRODUCT.title, priceInr: PRODUCT.priceInr, priceUsdt: PRODUCT.priceUsdt, merchantRef: ref, returnUrl: `${origin}/orders` });
    orders.attach(ref, s.sessionId);
    return NextResponse.json({ url: s.url, ref });
  } catch (e) {
    console.error("[checkout]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Could not start checkout. Try again." }, { status: 502 });
  }
}
