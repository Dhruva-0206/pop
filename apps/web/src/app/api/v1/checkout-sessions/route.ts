import { NextResponse, connection } from "next/server";
import { recoverTypedDataAddress, keccak256, toHex, type Hex } from "viem";
import { z } from "zod";
import { checkoutAbi, listingIdHash, offerDomain, offerTypes, registryAbi, termsHash, type Terms } from "@pop/shared";
import { deployment, net, pub, store } from "@/lib/server/chain";
import { authMerchant } from "@/lib/server/merchants";

const hex = (n: number) => z.string().regex(new RegExp(`^0x[0-9a-fA-F]{${n}}$`));
const uint = z.string().regex(/^\d{1,40}$/);
const Body = z
  .object({
    sessionId: z.string().regex(/^s_[0-9a-f]{16}$/),
    merchantRef: z.string().min(1).max(120),
    returnUrl: z.string().max(500).optional(),
    terms: z
      .object({
        title: z.string().min(1).max(120),
        variant: z.string().max(80).optional(),
        imageUrl: z.string().max(500).regex(/^https:\/\//).optional(),
        priceInr: z.number().int().min(1).max(10_000_000),
        shipWithinSec: z.number().int().min(30).max(30 * 86400),
        deliverWithinSec: z.number().int().min(30).max(60 * 86400),
        returnPolicy: z.string().min(1).max(500),
      })
      .strict(),
    offer: z
      .object({
        seller: hex(40),
        listingId: hex(64),
        termsHash: hex(64),
        externalRef: hex(64),
        price: uint,
        shipWithin: z.number().int(),
        deliverWithin: z.number().int(),
        maxUnits: z.number().int(),
        validUntil: uint,
        version: uint,
      })
      .strict(),
    offerSig: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
  })
  .strict();

/**
 * Merchant API: register a single-use checkout session. The merchant signs the Offer with its own seller key (PoP never holds
 * it); we check everything the contract would check plus that the Offer is bound to this session and merchant reference.
 * Auth: `Authorization: Bearer <merchant api key>`.
 */
export async function POST(req: Request) {
  await connection();
  const merchant = await authMerchant(req);
  if (!merchant) return NextResponse.json({ error: "invalid api key" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request", detail: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  const b = parsed.data;
  const o = b.offer;
  const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

  if (o.seller.toLowerCase() !== merchant.sellerWallet.toLowerCase()) return fail("offer.seller is not this merchant's wallet", 403);
  if (o.listingId.toLowerCase() !== listingIdHash(b.sessionId).toLowerCase()) return fail("offer.listingId is not keccak(sessionId)");
  if (o.termsHash.toLowerCase() !== termsHash(b.terms as Terms).toLowerCase()) return fail("offer.termsHash does not match terms");
  if (o.shipWithin !== b.terms.shipWithinSec || o.deliverWithin !== b.terms.deliverWithinSec) return fail("offer windows do not match terms");
  if (o.externalRef.toLowerCase() !== keccak256(toHex(b.merchantRef)).toLowerCase()) return fail("offer.externalRef is not keccak(merchantRef)");
  if (o.maxUnits !== 1) return fail("sessions are single-use: maxUnits must be 1");

  const d = deployment();
  const price = BigInt(o.price);
  if (price <= BigInt(0) || price > BigInt(100) * BigInt(10) ** BigInt(d.tokenDecimals)) return fail("price must be between 0 and 100 test USDT");
  const nowSec = Math.floor(Date.now() / 1000);
  const validUntil = Number(o.validUntil);
  if (validUntil < nowSec + 60 || validUntil > nowSec + 7 * 86400) return fail("validUntil must be between 1 minute and 7 days from now");

  const seller = o.seller as Hex;
  const [active, minV] = await Promise.all([
    pub.readContract({ address: d.registry, abi: registryAbi, functionName: "isActive", args: [seller] }),
    pub.readContract({ address: d.checkout, abi: checkoutAbi, functionName: "minOfferVersion", args: [seller] }),
  ]);
  if (!active) return fail("seller is not an active registered seller", 403);
  if (BigInt(o.version) < minV) return fail("offer version is revoked");

  const signer = await recoverTypedDataAddress({
    domain: offerDomain(net.chain.id, d.checkout),
    types: offerTypes,
    primaryType: "Offer",
    message: {
      seller,
      listingId: o.listingId as Hex,
      termsHash: o.termsHash as Hex,
      externalRef: o.externalRef as Hex,
      price,
      shipWithin: o.shipWithin,
      deliverWithin: o.deliverWithin,
      maxUnits: o.maxUnits,
      validUntil: BigInt(o.validUntil),
      version: BigInt(o.version),
    },
    signature: b.offerSig as Hex,
  }).catch(() => null);
  if (!signer || signer.toLowerCase() !== seller.toLowerCase()) return fail("offerSig is not the seller's EIP-712 signature", 403);

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

  const row = await store.sellerByWallet(seller);
  if (!row) return fail("seller is not onboarded in PoP", 409);
  const ok = await store.createSession(
    {
      id: b.sessionId,
      sellerWallet: seller,
      sellerHandle: row.handle,
      title: b.terms.title,
      imageUrl: b.terms.imageUrl,
      priceUnits: price.toString(),
      priceInr: b.terms.priceInr,
      terms: b.terms,
      termsHash: o.termsHash,
      offer: { ...o },
      offerSig: b.offerSig,
      active: true,
      createdAt: new Date().toISOString(),
    },
    { merchantId: merchant.id, merchantRef: b.merchantRef, returnUrl, expiresAt: new Date(validUntil * 1000).toISOString() },
  );
  if (!ok) return fail("sessionId already exists", 409);
  const origin = process.env.NEXT_PUBLIC_BASE_URL?.trim() || new URL(req.url).origin;
  return NextResponse.json({ sessionId: b.sessionId, url: `${origin}/p/${b.sessionId}`, expiresAt: validUntil }, { status: 201 });
}
