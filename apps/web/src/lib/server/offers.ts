import "server-only";
import { recoverTypedDataAddress, type Hex } from "viem";
import { z } from "zod";
import { checkoutAbi, listingIdHash, offerDomain, offerTypes, registryAbi, termsHash, type Terms } from "@pop/shared";
import { deployment, net, pub } from "./chain";

const hex = (n: number) => z.string().regex(new RegExp(`^0x[0-9a-fA-F]{${n}}$`));
const uint = z.string().regex(/^\d{1,40}$/);

/** Exactly the fields of `Terms` (strict: extra keys would change the hash). */
export const TermsSchema = z
  .object({
    title: z.string().min(1).max(120),
    variant: z.string().max(80).optional(),
    imageUrl: z.string().max(500).regex(/^https:\/\//).optional(),
    priceInr: z.number().int().min(1).max(10_000_000),
    shipWithinSec: z.number().int().min(30).max(30 * 86400),
    deliverWithinSec: z.number().int().min(30).max(60 * 86400),
    returnPolicy: z.string().min(1).max(500),
  })
  .strict();

/** The Offer as JSON (bigints as decimal strings). */
export const OfferSchema = z
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
  .strict();
export const SigSchema = z.string().regex(/^0x[0-9a-fA-F]{130}$/);

export type OfferJson = z.infer<typeof OfferSchema>;
export type TermsJson = z.infer<typeof TermsSchema>;
export type OfferCheck = { ok: true; price: bigint; seller: Hex; validUntil: number } | { ok: false; error: string; status: number };

/**
 * Everything the contract and the checkout page rely on, checked before an Offer is stored: bound to this slug/session,
 * terms match the signed hash, windows match, sane price and expiry, seller active and not revoked, and the EIP-712
 * signature really is the seller's. Callers add their own rules (who the seller must be, externalRef, maxUnits).
 */
export async function validateSignedOffer(i: { slug: string; terms: TermsJson; offer: OfferJson; offerSig: string }): Promise<OfferCheck> {
  const { offer: o, terms } = i;
  const bad = (error: string, status = 400): OfferCheck => ({ ok: false, error, status });
  if (o.listingId.toLowerCase() !== listingIdHash(i.slug).toLowerCase()) return bad("offer.listingId is not keccak(slug)");
  if (o.termsHash.toLowerCase() !== termsHash(terms as Terms).toLowerCase()) return bad("offer.termsHash does not match terms");
  if (o.shipWithin !== terms.shipWithinSec || o.deliverWithin !== terms.deliverWithinSec) return bad("offer windows do not match terms");

  const d = deployment();
  const price = BigInt(o.price);
  if (price <= BigInt(0) || price > BigInt(100) * BigInt(10) ** BigInt(d.tokenDecimals)) return bad("price must be between 0 and 100 test USDT");
  const nowSec = Math.floor(Date.now() / 1000);
  const validUntil = Number(o.validUntil);
  if (validUntil < nowSec + 60 || validUntil > nowSec + 7 * 86400) return bad("validUntil must be between 1 minute and 7 days from now");

  const seller = o.seller as Hex;
  const [active, minV] = await Promise.all([
    pub.readContract({ address: d.registry, abi: registryAbi, functionName: "isActive", args: [seller] }),
    pub.readContract({ address: d.checkout, abi: checkoutAbi, functionName: "minOfferVersion", args: [seller] }),
  ]);
  if (!active) return bad("seller is not an active registered seller", 403);
  if (BigInt(o.version) < minV) return bad("offer version is revoked");

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
    signature: i.offerSig as Hex,
  }).catch(() => null);
  if (!signer || signer.toLowerCase() !== seller.toLowerCase()) return bad("offerSig is not the seller's EIP-712 signature", 403);
  return { ok: true, price, seller, validUntil };
}
