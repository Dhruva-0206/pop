"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IDKitRequestWidget, proofOfHuman, type IDKitResult, type RpContext } from "@worldcoin/idkit";
import { encodePacked, keccak256, type Address } from "viem";
import type { AppConfig } from "@/lib/client/config";
import { Notice, Skeleton } from "@/components/ui";
import { getTestAccount } from "@/lib/client/wallet";
import { reviewRefusal, widgetRefusal, type Refusal } from "@/lib/client/review-errors";
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
  // Why the last attempt was refused. Kept on the page because the World widget only says "Verification declined" and then calls
  // onError("failed_by_host_app") without our reason.
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const serverRefused = useRef(false);
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

  function report(j: { ok?: boolean; status?: string; error?: string; retry?: boolean }, status = 0) {
    setRefusal(null);
    if (j.ok && j.status === "synced") setMsg("");
    else if (j.ok) setMsg("Your review was saved but publishing didn't finish. Press Try again.");
    else setRefusal(reviewRefusal(status, j.error));
    refresh();
  }

  async function submit(proof?: IDKitResult) {
    if (!buyer) return setMsg("Open this page on the device you paid from.");
    setBusy(true);
    setMsg("");
    setRefusal(null);
    serverRefused.current = false;
    try {
      const buyerSignature = await buyer.signMessage({ message: reviewAuthMessage(orderId, sellerHandle, rating, clean) });
      const { j, status } = await post("/api/world/verify-review", {
        seller: sellerHandle,
        orderId,
        rating,
        text: clean,
        buyerSignature,
        ...(proof ? { idkitResult: proof } : { skipWorld: true }),
      });
      report(j, status);
      if (!j.ok) {
        serverRefused.current = true; // the widget will now fail; keep OUR reason on screen
        throw new Error(j.error ?? "review failed");
      }
    } catch (e) {
      if (!serverRefused.current) setRefusal(reviewRefusal(0)); // no answer from our server (network), nothing was sent on
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function startWorld() {
    setMsg("");
    setRefusal(null);
    serverRefused.current = false;
    const res = await fetch("/api/world/rp-signature", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seller: sellerHandle }),
    });
    if (!res.ok) return setRefusal(reviewRefusal(res.status, (await res.json().catch(() => ({}))).error ?? "reviews are not enabled for this seller"));
    setWorld(await res.json());
    setOpen(true);
  }

  async function retry() {
    if (!buyer) return;
    setBusy(true);
    try {
      const buyerSignature = await buyer.signMessage({ message: reviewRetryMessage(orderId, sellerHandle) });
      const { j, status } = await post("/api/reviews/retry", { seller: sellerHandle, orderId, buyerSignature });
      report(j, status);
    } finally {
      setBusy(false);
    }
  }

  if (!existing) return <Skeleton className="h-40 w-full" />;

  if (existing.exists) {
    return (
      <section aria-labelledby="your-review" className="stack-sm">
        <h2 id="your-review">Your review</h2>
        <p className="font-semibold">{existing.rating ?? 0} out of 5</p>
        {existing.text && <p className="whitespace-pre-wrap break-words">{existing.text}</p>}
        {existing.status === "synced" ? (
          <p className="text-ink-2">
            Published. <Link href={`/verify/${sellerHandle}`}>See @{sellerHandle}&apos;s record</Link>
          </p>
        ) : (
          <>
            <Notice tone="warn" title="Saved, but not published yet">
              Your review is saved. Publishing to Arkiv didn&apos;t finish. Trying again does not ask for a new World ID check.
            </Notice>
            <button disabled={busy} onClick={retry} className="btn btn-primary btn-block">
              {busy ? "Publishing, about 10 seconds" : "Try again to publish"}
            </button>
          </>
        )}
        {refusal && (
          <Notice tone={refusal.tone} title={refusal.title}>
            <span className="block">{refusal.body}</span>
            <span className="block">{refusal.next}</span>
          </Notice>
        )}
        {msg && existing.status !== "synced" && (
          <p role="status" className="text-sm text-ink-2">
            {msg}
          </p>
        )}
      </section>
    );
  }

  const signal = buyer ? keccak256(encodePacked(["uint256", "address"], [BigInt(orderId), buyer.address as Address])) : undefined;
  return (
    <section aria-labelledby="review-h" className="stack-sm">
      <div>
        <h2 id="review-h">Review @{sellerHandle}</h2>
        <p className="hint">One review per person per seller. World ID checks that you are a real, unique person. It does not share who you are.</p>
      </div>
      <fieldset>
        <legend className="label">Your rating</legend>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating, 1 to 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} out of 5`}
              onClick={() => setRating(n)}
              className={`btn ${rating === n ? "btn-primary" : "btn-secondary"}`}
            >
              {n}
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor="review-text">
          Your words (optional)
        </label>
        <textarea id="review-text" className="field" rows={3} maxLength={REVIEW_TEXT_MAX} value={text} onChange={(e) => setText(e.target.value)} />
        <p className="hint text-right">
          {clean.length} of {REVIEW_TEXT_MAX} characters
        </p>
      </div>
      <button disabled={busy || !buyer} onClick={startWorld} className="btn btn-primary btn-block">
        {busy ? "Working, about 10 seconds" : "Verify with World ID and publish"}
      </button>
      {!buyer && <p className="hint">Open this page on the device you paid from to leave a review.</p>}
      {cfg.devSkipWorld && (
        <button disabled={busy || !buyer} onClick={() => submit()} className="btn btn-danger btn-block">
          Developer only: publish without a World ID proof (local dev server)
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
          onSuccess={() => setMsg("Verified. Publishing your review.")}
          onError={(code) => {
            // If our server already gave the reason, never replace it with the widget's generic code.
            if (!serverRefused.current) setRefusal(widgetRefusal(String(code)));
          }}
        />
      )}
      {refusal && (
        <Notice tone={refusal.tone} title={refusal.title}>
          <span className="block">{refusal.body}</span>
          <span className="block">{refusal.next}</span>
        </Notice>
      )}
      {msg && (
        <p role="status" className="text-sm text-ink-2">
          {msg}
        </p>
      )}
    </section>
  );
}
