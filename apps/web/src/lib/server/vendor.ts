import "server-only";
import { createHash } from "node:crypto";
import type { IDKitResult } from "@worldcoin/idkit";
import { zeroAddress, type Address } from "viem";
import { handleHash, registryAbi } from "@pop/shared";
import { deployment, mode, pub, store } from "./chain";
import { logWorld } from "./reviews";
import { devSkipWorld, verifyReviewProof } from "./world";
import { decideVendor, vendorSignal, VENDOR_MSG } from "../vendor-rules";

/** The ONE portal action used for vendor onboarding. Set VENDOR_WORLD_ACTION to switch (for example vendor-rehearsal for rehearsals). */
export const vendorAction = () => process.env.VENDOR_WORLD_ACTION?.trim() || "vendor-onboard";

/**
 * Demo shortcut: skip the staff check of the bio code. Honored ONLY on testnet, so a fork or any other mode never auto-approves.
 * The page and the registration say so plainly (the registration is recorded as tier 0, "handle not checked").
 */
export const autoApproveOn = () => process.env.ONBOARD_DEMO_AUTOAPPROVE?.trim() === "yes" && mode === "testnet";

/** True when the handle already belongs to a registered shop on-chain. */
export async function handleRegistered(handle: string): Promise<boolean> {
  const d = deployment();
  const owner = (await pub.readContract({ address: d.registry, abi: registryAbi, functionName: "handleOwner", args: [handleHash(handle)] })) as Address;
  return owner !== zeroAddress;
}

/** True when the registry has banned this handle or the wallet that owns it. The ban lives on-chain; the nullifier rule is ours. */
export async function bannedOnChain(handle: string): Promise<boolean> {
  const d = deployment();
  const hh = handleHash(handle);
  const [bannedH, owner] = await Promise.all([
    pub.readContract({ address: d.registry, abi: registryAbi, functionName: "bannedHandle", args: [hh] }),
    pub.readContract({ address: d.registry, abi: registryAbi, functionName: "handleOwner", args: [hh] }) as Promise<Address>,
  ]);
  if (bannedH) return true;
  if (owner === zeroAddress) return false;
  return Boolean(await pub.readContract({ address: d.registry, abi: registryAbi, functionName: "bannedWallet", args: [owner] }));
}

export type VendorCheck = { ok: true; hash: string; resumed: boolean } | { ok: false; status: number; error: string };

/**
 * Verify the vendor's World proof (staging or whatever WORLD_ENVIRONMENT says), then apply "one human, one shop".
 * Writes one row to the World verification log for every outcome (never the proof, signal or raw nullifier).
 */
export async function checkVendorProof(input: { handle: string; idkitResult?: unknown; skipWorld?: boolean }): Promise<VendorCheck> {
  const handle = input.handle.trim().toLowerCase();
  const action = vendorAction();
  const log = (outcome: string, detail: string, hint?: string) => logWorld({ sellerHandle: handle, outcome, detail, action, nullifierHint: hint });

  let nullifier: string;
  if (input.skipWorld) {
    if (devSkipWorld() !== "on") return { ok: false, status: 403, error: "skipping World ID is only possible on a local development server" };
    nullifier = `dev-skip:vendor:${handle}`;
  } else {
    if (!input.idkitResult) return { ok: false, status: 400, error: "World ID proof required" };
    const v = await verifyReviewProof(input.idkitResult as IDKitResult, action, vendorSignal(handle));
    if (!v.ok) {
      await log("rejected", `vendor onboarding: ${v.reason}`);
      return { ok: false, status: v.status, error: v.reason };
    }
    nullifier = v.nullifier;
  }

  const hash = createHash("sha256").update(nullifier).digest("hex"); // only this hash is stored, never the raw nullifier
  const hint = hash.slice(0, 12);
  const d = await decideVendor({ store, nullifierHash: hash, handle, handleRegistered, bannedOnChain });
  if (d.kind === "banned") {
    await log("rejected", "vendor onboarding: banned person refused", hint);
    return { ok: false, status: 403, error: VENDOR_MSG.banned };
  }
  if (d.kind === "replay") {
    await log("replay", "vendor onboarding: this person already has a shop", hint);
    return { ok: false, status: 409, error: VENDOR_MSG.replay };
  }
  await log(input.skipWorld ? "dev-skipped" : "verified", d.resumed ? "vendor onboarding (resumed, same handle)" : "vendor onboarding", hint);
  return { ok: true, hash, resumed: d.resumed };
}
