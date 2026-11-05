"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IDKitRequestWidget, proofOfHuman, type IDKitResult, type RpContext } from "@worldcoin/idkit";
import { encodePacked, keccak256, type Address } from "viem";
import type { AppConfig } from "@/lib/client/config";
import { getTestAccount } from "@/lib/client/wallet";
import { REVIEW_TEXT_MAX, normaliseReviewText, reviewAuthMessage, reviewRetryMessage } from "@/lib/messages";

type WorldCfg = { app_id: `app_${string}`; action: string; environment: "staging" | "production"; rp_context: RpContext };
type Existing = { exists: boolean; status?: "pending" | "synced" | "failed"; rating?: number; text?: string; devSkippedWorld?: boolean };

/**
 * Leave a review after an order is Released: pick a rating, write up to 500 characters, prove you are a unique human
 * (World ID) and sign with the buyer wallet. The signature fixes your rating and text. The review is then published
 * to Arkiv and handed to you. If publishing fails, "Try again" retries without a new World proof.
 */
export function ReviewBox({ cfg, orderId, sellerHandle }: { cfg: AppConfig; orderId: string; sellerHandle: string }) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [existing, setExisting] = useState<Existing | null>(null);
  const [world, setWorld] = useState<WorldCfg | null>(null);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const buyer = getTestAccount(cfg, "buyer", false);
  const clean = normaliseReviewText(text);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/reviews/${orderId}`, { cache: "no-store" });
    if (r.ok) setExisting(await r.json());
  }, [orderId]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  async function post(path: string, body: object) {
    const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) };
  }

  function report(j: { ok?: boolean; status?: string; error?: string; retry?: boolean }) {
    if (j.ok && j.status === "synced") setMsg("Thanks! Your review is published.");
    else if (j.ok) setMsg("Your review was saved but publishing didn't finish. Press “Try again”.");
    else setMsg(j.error ?? "Couldn't submit the review.");
    refresh();
  }

  async function submit(proof?: IDKitResult) {
    if (!buyer) return setMsg("Open this page on the device you paid from.");
    setBusy(true);
    setMsg("");
    try {
      const buyerSignature = await buyer.signMessage({ message: reviewAuthMessage(orderId, sellerHandle, rating, clean) });
      const { j } = await post("/api/world/verify-review", {
        seller: sellerHandle,
        orderId,
        rating,
        text: clean,
        buyerSignature,
        ...(proof ? { idkitResult: proof } : { skipWorld: true }),
      });
      report(j);
      if (!j.ok) throw new Error(j.error ?? "review failed");
    } finally {
      setBusy(false);
    }
  }

  async function startWorld() {
    setMsg("");
    const res = await fetch("/api/world/rp-signature", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seller: sellerHandle }),
    });
    if (!res.ok) return setMsg((await res.json().catch(() => ({}))).error ?? "Reviews aren't available for this seller yet.");
    setWorld(await res.json());
    setOpen(true);
  }

  async function retry() {
    if (!buyer) return;
    setBusy(true);
    try {
      const buyerSignature = await buyer.signMessage({ message: reviewRetryMessage(orderId, sellerHandle) });
      const { j } = await post("/api/reviews/retry", { seller: sellerHandle, orderId, buyerSignature });
      report(j);
    } finally {
      setBusy(false);
    }
  }

  if (!existing) return null;

  if (existing.exists) {
    return (
      <div className="space-y-2 rounded-xl border p-4 text-sm">
        <div className="font-semibold">Your review</div>
        <div className="text-amber-600">{"★".repeat(existing.rating ?? 0)}{"☆".repeat(5 - (existing.rating ?? 0))}</div>
        {existing.text && <div className="whitespace-pre-wrap">{existing.text}</div>}
        {existing.status === "synced" ? (
          <div className="text-xs text-emerald-700">
            Published. <Link className="underline" href={`/verify/${sellerHandle}`}>See @{sellerHandle}&apos;s record</Link>
          </div>
        ) : (
          <button disabled={busy} onClick={retry} className="rounded-lg bg-neutral-900 px-3 py-1 text-white disabled:opacity-50">
            Try again to publish
          </button>
        )}
        {msg && <div className="text-xs text-neutral-600">{msg}</div>}
      </div>
    );
  }

  const signal = buyer ? keccak256(encodePacked(["uint256", "address"], [BigInt(orderId), buyer.address as Address])) : undefined;
  return (
    <div className="space-y-2 rounded-xl border p-4 text-sm">
      <div className="font-semibold">Review @{sellerHandle}</div>
      <div className="text-xs text-neutral-600">One review per person per seller. We check you are a real, unique person with World ID.</div>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            onClick={() => setRating(n)}
            className={`text-2xl ${n <= rating ? "text-amber-500" : "text-neutral-300"}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        className="w-full rounded border p-2"
        rows={3}
        maxLength={REVIEW_TEXT_MAX}
        placeholder="What was it like? (optional)"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="text-right text-xs text-neutral-500">{clean.length}/{REVIEW_TEXT_MAX}</div>
      <button disabled={busy || !buyer} onClick={startWorld} className="w-full rounded-xl bg-emerald-600 py-2 font-semibold text-white disabled:opacity-50">
        Verify with World ID and publish
      </button>
      {cfg.devSkipWorld && (
        <button
          disabled={busy || !buyer}
          onClick={() => submit()}
          className="w-full rounded-xl border-2 border-dashed border-red-500 py-2 text-xs font-bold text-red-700 disabled:opacity-50"
        >
          DEV ONLY: publish WITHOUT a World ID proof (local dev server only)
        </button>
      )}
      {world && signal && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={world.app_id}
          action={world.action}
          rp_context={world.rp_context}
          allow_legacy_proofs={true}
          preset={proofOfHuman({ signal })}
          environment={world.environment}
          handleVerify={async (result: IDKitResult) => {
            await submit(result);
          }}
          onSuccess={() => setMsg("Verified. Publishing your review…")}
          onError={(code) => setMsg(`World ID: ${code}. Nothing was published.`)}
        />
      )}
      {msg && <div className="text-xs text-neutral-700">{msg}</div>}
    </div>
  );
}
