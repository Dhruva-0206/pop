import { NextResponse, connection } from "next/server";
import { keccak256, toHex } from "viem";
import { z } from "zod";
import { store } from "@/lib/server/chain";
import { authMerchant } from "@/lib/server/merchants";
import { OfferSchema, SigSchema, TermsSchema, validateSignedOffer } from "@/lib/server/offers";

const Body = z
  .object({
    sessionId: z.string().regex(/^s_[0-9a-f]{16}$/),
    merchantRef: z.string().min(1).max(120),
    returnUrl: z.string().max(500).optional(),
    terms: TermsSchema,
    offer: OfferSchema,
    offerSig: SigSchema,
  })
  .strict();

/**
 * Merchant API: register a single-use checkout session. The merchant signs the Offer with its own seller key (PoP never holds
 * it); we check everything the contract would check plus that the Offer is bound to this session and merchant reference.
 * Auth: `Authorization: Bearer <merchant api key>`. Rate limited per merchant (counted in Postgres).
 */
export async function POST(req: Request) {
  await connection();
  const merchant = await authMerchant(req);
  if (!merchant) return NextResponse.json({ error: "invalid api key" }, { status: 401 });
  // Rate limit per merchant, counted in Postgres (holds across serverless instances): per minute, and 20x that per hour.
  const [lastMin, lastHour] = await Promise.all([store.countRecentSessions(merchant.id, 60), store.countRecentSessions(merchant.id, 3600)]);
  if (lastMin >= merchant.rateLimitPerMin || lastHour >= merchant.rateLimitPerMin * 20) {
    return NextResponse.json({ error: "rate limit: too many checkout sessions, slow down" }, { status: 429, headers: { "retry-after": "60" } });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request", detail: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  const b = parsed.data;
  const o = b.offer;
  const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

  if (o.seller.toLowerCase() !== merchant.sellerWallet.toLowerCase()) return fail("offer.seller is not this merchant's wallet", 403);
  if (o.externalRef.toLowerCase() !== keccak256(toHex(b.merchantRef)).toLowerCase()) return fail("offer.externalRef is not keccak(merchantRef)");
  if (o.maxUnits !== 1) return fail("sessions are single-use: maxUnits must be 1");

  const v = await validateSignedOffer({ slug: b.sessionId, terms: b.terms, offer: o, offerSig: b.offerSig });
  if (!v.ok) return fail(v.error, v.status);

  let returnUrl: string | undefined;
  if (b.returnUrl) {
    let u: URL;
    try {
      u = new URL(b.returnUrl);
    } catch {
      return fail("returnUrl is not a URL");
    }
    if (!merchant.allowedReturnOrigin || u.origin !== merchant.allowedReturnOrigin) return fail("returnUrl origin is not allowed for this merchant", 403);
    returnUrl = u.toString();
  }

  const row = await store.sellerByWallet(v.seller);
  if (!row) return fail("seller is not onboarded in PoP", 409);
  const ok = await store.createSession(
    {
      id: b.sessionId,
      sellerWallet: v.seller,
      sellerHandle: row.handle,
      title: b.terms.title,
      imageUrl: b.terms.imageUrl,
      priceUnits: v.price.toString(),
      priceInr: b.terms.priceInr,
      terms: b.terms,
      termsHash: o.termsHash,
      offer: { ...o },
      offerSig: b.offerSig,
      active: true,
      createdAt: new Date().toISOString(),
    },
    { merchantId: merchant.id, merchantRef: b.merchantRef, returnUrl, expiresAt: new Date(v.validUntil * 1000).toISOString() },
  );
  if (!ok) return fail("sessionId already exists", 409);
  const origin = process.env.NEXT_PUBLIC_BASE_URL?.trim() || new URL(req.url).origin;
  return NextResponse.json({ sessionId: b.sessionId, url: `${origin}/p/${b.sessionId}`, expiresAt: v.validUntil }, { status: 201 });
}

