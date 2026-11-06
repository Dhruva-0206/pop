/**
 * One human, one shop: the decision for a vendor's World ID proof. No server-only imports, so it can be unit tested
 * (scripts/test-vendor-verification.ts) with in-memory dependencies.
 *
 * The ban block is a PoP DATABASE rule, not an on-chain rule: the contracts know wallets and handles, not World nullifiers.
 * We learn about a ban by reading the registry (bannedWallet / bannedHandle) and then mirror it into vendor_verifications.banned.
 */
import { encodePacked, keccak256 } from "viem";

export const VENDOR_MSG = {
  replay: "This person already has a PoP shop.",
  banned: "This person was banned from selling on PoP.",
} as const;

/** The World proof is bound to the handle, so a proof made for one handle cannot be reused for another. */
export const vendorSignal = (handle: string): `0x${string}` => keccak256(encodePacked(["string"], [`pop-vendor:${handle.trim().toLowerCase()}`]));

export type VendorRow = { handle: string; banned: boolean };
export type VendorStoreLike = {
  claimVendor(nullifierHash: string, handle: string): Promise<boolean>;
  vendorByNullifier(nullifierHash: string): Promise<VendorRow | undefined>;
  markVendorBanned(handle: string): Promise<number>;
};
export type VendorDecision = { kind: "verified"; resumed: boolean } | { kind: "replay" } | { kind: "banned" };

export async function decideVendor(deps: {
  store: VendorStoreLike;
  nullifierHash: string;
  handle: string;
  /** true when the handle is already registered on-chain (a finished shop) */
  handleRegistered: (handle: string) => Promise<boolean>;
  /** true when the registry has banned this handle or its wallet */
  bannedOnChain: (handle: string) => Promise<boolean>;
}): Promise<VendorDecision> {
  const { store, nullifierHash } = deps;
  const handle = deps.handle.trim().toLowerCase();
  const existing = await store.vendorByNullifier(nullifierHash);
  if (existing) {
    // Banned person: refused whatever handle they try now. Mirror a fresh on-chain ban into the row.
    if (existing.banned || (await deps.bannedOnChain(existing.handle))) {
      if (!existing.banned) await store.markVendorBanned(existing.handle);
      return { kind: "banned" };
    }
    // Same person, same handle, shop not finished yet (for example the page was reloaded): resume, it is not a second shop.
    if (existing.handle === handle && !(await deps.handleRegistered(handle))) return { kind: "verified", resumed: true };
    return { kind: "replay" };
  }
  // The insert is the arbiter of races: two simultaneous first attempts cannot both win (UNIQUE nullifier_hash).
  return (await store.claimVendor(nullifierHash, handle)) ? { kind: "verified", resumed: false } : { kind: "replay" };
}
