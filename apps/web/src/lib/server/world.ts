import "server-only";
import { encodePacked, keccak256, type Address } from "viem";
import { signRequest } from "@worldcoin/idkit/signing";
import { hashSignal } from "@worldcoin/idkit/hashing";
import type { IDKitResult } from "@worldcoin/idkit";
import { WORLD_REVIEW_ACTIONS } from "@pop/shared";

/** World ID 4.0 settings. All secret; never NEXT_PUBLIC_. */
export function worldConfig() {
  const appId = process.env.WORLD_APP_ID?.trim();
  const rpId = process.env.WORLD_RP_ID?.trim();
  const signingKey = process.env.WORLD_RP_SIGNING_KEY?.trim();
  const environment = (process.env.WORLD_ENVIRONMENT?.trim() || "staging") as "staging" | "production";
  // UNVERIFIED: whether staging proofs use a different host. Docs list developer.world.org for v4 verify.
  const verifyBase = process.env.WORLD_VERIFY_BASE?.trim() || "https://developer.world.org";
  return { appId, rpId, signingKey, environment, verifyBase };
}

/**
 * One portal action per seller (World ID 4.0 proofs are one-time per human per action).
 * Returns undefined for sellers without an action: the review flow must refuse, never fall back to a shared action.
 */
export function reviewActionFor(sellerHandle: string): string | undefined {
  let map = WORLD_REVIEW_ACTIONS;
  const override = process.env.WORLD_REVIEW_ACTIONS?.trim();
  if (override) {
    try {
      map = { ...map, ...(JSON.parse(override) as Record<string, string>) };
    } catch {
      /* ignore malformed override */
    }
  }
  return map[sellerHandle.trim().toLowerCase()];
}

/** The review proof is bound to this order and this buyer wallet. */
export function reviewSignal(orderId: bigint, buyer: Address): `0x${string}` {
  return keccak256(encodePacked(["uint256", "address"], [orderId, buyer]));
}

/** Public Arkiv field: keccak(nullifier, seller). The raw nullifier never leaves our DB. */
export function reviewerKey(nullifier: string, seller: Address): `0x${string}` {
  return keccak256(encodePacked(["uint256", "address"], [BigInt(nullifier), seller]));
}

export function signRpContext(action: string) {
  const { rpId, signingKey } = worldConfig();
  if (!rpId || !signingKey) throw new Error("World is not configured (WORLD_RP_ID / WORLD_RP_SIGNING_KEY)");
  const { sig, nonce, createdAt, expiresAt } = signRequest({ signingKeyHex: signingKey, action });
  return { rp_id: rpId, nonce, created_at: createdAt, expires_at: expiresAt, signature: sig };
}

type VerifyOk = { ok: true; nullifier: string; environment: string };
type VerifyFail = { ok: false; status: number; reason: string };
type LooseResult = {
  environment?: string;
  action?: string;
  responses?: { signal_hash?: string; nullifier?: string }[];
};

/**
 * Server-side check of an IDKit result:
 * environment + expected action match, every response carries our expected signal hash, then World's v4 verify API.
 */
export async function verifyReviewProof(
  result: IDKitResult,
  expectedAction: string,
  expectedSignal: string,
): Promise<VerifyOk | VerifyFail> {
  const cfg = worldConfig();
  if (!cfg.rpId) return { ok: false, status: 500, reason: "World not configured" };
  const r = result as unknown as LooseResult;
  if (r.environment !== cfg.environment) return { ok: false, status: 400, reason: "wrong environment" };
  if (r.action !== expectedAction) return { ok: false, status: 400, reason: "wrong action" };
  const want = BigInt(hashSignal(expectedSignal));
  const responses = r.responses ?? [];
  if (responses.length === 0) return { ok: false, status: 400, reason: "no responses" };
  for (const item of responses) {
    if (!item.signal_hash || BigInt(item.signal_hash) !== want) {
      return { ok: false, status: 400, reason: "signal mismatch" };
    }
  }

  const res = await fetch(`${cfg.verifyBase}/api/v4/verify/${cfg.rpId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...result, environment: cfg.environment }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    nullifier?: string;
    environment?: string;
    code?: string;
    detail?: string;
  };
  if (!res.ok || body.success !== true || body.environment !== cfg.environment || !body.nullifier) {
    return { ok: false, status: 400, reason: body.code ?? body.detail ?? `verify failed (${res.status})` };
  }
  return { ok: true, nullifier: body.nullifier, environment: body.environment };
}
