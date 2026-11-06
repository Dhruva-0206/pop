import "server-only";
import type { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { publishReview } from "@pop/shared/server/arkiv";
import type { WorldLogRow } from "@pop/shared/server/store";
import { store } from "./chain";

/** Arkiv access key (server only, never NEXT_PUBLIC_). */
export function arkivAccessKey(): string {
  const k = process.env.ARKIV_ACCESS_KEY?.trim();
  if (!k) throw new Error("ARKIV_ACCESS_KEY not set");
  return k;
}

function attestorPk(): Hex {
  const k = process.env.ATTESTOR_PK?.trim().split("#")[0]?.trim();
  if (!k) throw new Error("ATTESTOR_PK not set");
  return k as Hex;
}

/** The attestor's signing account (server only): signs seller Registrations and writes Arkiv entities. */
export function attestorAccount() {
  return privateKeyToAccount(attestorPk());
}

/** Best-effort World verification log (never throws, never stores proofs, signals or raw nullifiers). */
export async function logWorld(x: Omit<WorldLogRow, "at">) {
  try {
    await store.logWorldVerification({ environment: process.env.WORLD_ENVIRONMENT?.trim() || "staging", ...x });
  } catch (e) {
    console.error("[world] could not write the verification log:", e instanceof Error ? e.message : e);
  }
}

/** The attestor ADDRESS readers trust as `$creator`. Derived from ATTESTOR_PK, or POP_ATTESTOR_ADDRESS for read-only apps. */
export function attestorAddress(): Address {
  const pk = process.env.ATTESTOR_PK?.trim().split("#")[0]?.trim();
  if (pk) return privateKeyToAccount(pk as Hex).address;
  const a = process.env.POP_ATTESTOR_ADDRESS?.trim().split("#")[0]?.trim();
  if (a) return a as Address;
  throw new Error("Set ATTESTOR_PK or POP_ATTESTOR_ADDRESS");
}

/** Errors from the RPC client can contain the RPC URL, which carries the Arkiv access key. Never store or return that. */
function scrub(message: string): string {
  let m = message.split("\n")[0];
  const key = process.env.ARKIV_ACCESS_KEY?.trim();
  if (key) m = m.split(key).join("<redacted>");
  return m.replace(/https?:\/\/\S+/g, "<url>").slice(0, 300);
}

export type PublishOutcome = { status: "synced" | "failed"; arkivKey?: string; error?: string };

/**
 * Write (or finish writing) the Arkiv entity for an ACCEPTED review row, then record the outcome on that same row.
 * Never touches the nullifier claim, so a failed write can be retried any number of times without a second claim.
 * The Arkiv helper looks the entity up by (attestor, order, seller) first, so a retry never creates a duplicate.
 */
export async function publishReviewRow(orderId: string): Promise<PublishOutcome> {
  const r = await store.review(orderId);
  if (!r) return { status: "failed", error: "no such review" };
  if (r.status === "synced" && r.arkivKey) return { status: "synced", arkivKey: r.arkivKey };
  try {
    const res = await publishReview({
      accessKey: arkivAccessKey(),
      attestorPk: attestorPk(),
      seller: r.sellerWallet as Address,
      buyer: r.buyerWallet as Address,
      orderId: BigInt(r.orderId),
      rating: r.rating,
      text: r.text,
      reviewerKey: r.reviewerKey,
      payTx: r.payTx ?? "",
      buyerHistory: r.buyerHistory,
      buyerSig: r.buyerSig as Hex,
      createdAt: Math.floor(Date.parse(r.createdAt) / 1000),
      devEntity: r.devSkippedWorld,
    });
    await store.patchReview(orderId, {
      status: "synced",
      arkivKey: res.entityKey,
      createTx: res.createTx ?? r.createTx,
      transferTx: res.transferTx ?? r.transferTx,
      error: undefined,
    });
    return { status: "synced", arkivKey: res.entityKey };
  } catch (e) {
    const msg = scrub(e instanceof Error ? e.message : String(e));
    await store.patchReview(orderId, { status: "failed", error: msg });
    return { status: "failed", error: msg };
  }
}
