import { NextResponse, connection } from "next/server";
import { getAddress, zeroHash } from "viem";
import { z } from "zod";
import { handleHash } from "@pop/shared";
import { store } from "@/lib/server/chain";
import { SLUG_RE } from "@/lib/server/onboarding";
import { OfferSchema, SigSchema, TermsSchema, validateSignedOffer } from "@/lib/server/offers";

const Body = z.object({ slug: z.string().regex(SLUG_RE), terms: TermsSchema, offer: OfferSchema, offerSig: SigSchema }).strict();

/**
 * Step 3 of /onboard: the seller's ONE product. The seller signed the Offer in their own wallet; we re-validate everything the
 * contract would check, require the wallet to be an approved + on-chain-registered seller, and store the listing.
 */
export async function POST(req: Request) {
  await connection();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request", detail: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  const b = parsed.data;
  const seller = getAddress(b.offer.seller);
  const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

  const ob = await store.onboardingByWallet(seller);
  if (!ob || ob.status !== "approved") return fail("this wallet has no approved onboarding", 403);
  if (b.offer.externalRef !== zeroHash) return fail("externalRef must be zero for a seller listing");
  if (b.offer.maxUnits < 1 || b.offer.maxUnits > 1000) return fail("maxUnits must be between 1 and 1000");
  if ((await store.listingsBySeller(seller)).length >= 1) return fail("one product per seller", 409);
  if (await store.listing(b.slug)) return fail("that link name is taken", 409);

  const v = await validateSignedOffer({ slug: b.slug, terms: b.terms, offer: b.offer, offerSig: b.offerSig });
  if (!v.ok) return fail(v.error, v.status);

  if (!(await store.sellerByWallet(seller))) {
    await store.upsertSeller({ wallet: seller, handle: ob.handle, handleHash: handleHash(ob.handle), handleTier: 1, bioCode: ob.bioCode, createdAt: new Date().toISOString() });
  }
  await store.upsertListing({
    id: b.slug,
    sellerWallet: seller,
    sellerHandle: ob.handle,
    title: b.terms.title,
    imageUrl: b.terms.imageUrl,
    priceUnits: v.price.toString(),
    priceInr: b.terms.priceInr,
    terms: b.terms,
    termsHash: b.offer.termsHash,
    offer: { ...b.offer },
    offerSig: b.offerSig,
    active: true,
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, link: `/p/${b.slug}`, handle: ob.handle }, { status: 201 });
}
