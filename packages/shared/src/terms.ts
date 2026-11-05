import { keccak256, toBytes, toHex, type Hex } from "viem";

/** What the buyer agrees to. Its keccak (canonical JSON) is the Offer's termsHash, so anyone can recheck it. */
export type Terms = {
  title: string;
  variant?: string;
  imageUrl?: string;
  priceInr: number;
  shipWithinSec: number;
  deliverWithinSec: number;
  returnPolicy: string;
};

/** Deterministic JSON: keys sorted at every level. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

export const termsHash = (t: Terms): Hex => keccak256(toBytes(canonicalJson(t)));
export const listingIdHash = (slug: string): Hex => keccak256(toHex(slug));
export const handleHash = (handle: string): Hex => keccak256(toHex(handle.trim().toLowerCase()));
