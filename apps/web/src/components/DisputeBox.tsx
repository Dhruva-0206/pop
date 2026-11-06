"use client";

import { useState } from "react";
import { keccak256, toHex } from "viem";
import { checkoutAbi } from "@pop/shared";
import { publicClientOf, type AppConfig } from "@/lib/client/config";
import { getTestAccount, walletOf } from "@/lib/client/wallet";
import { DISPUTE_TEXT_MAX, disputeReasonMessage } from "@/lib/messages";

/**
 * Buyer's "Report a problem", shown only while the dispute window is open. Sends `openDispute(orderId, keccak(reason))` from the
 * buyer's wallet (the contract enforces buyer + window), then saves the reason text so the arbiter can read it: the server accepts
 * it only if it matches the on-chain evidence hash and carries the buyer's signature.
 */
export function DisputeBox({ cfg, orderId, onDone }: { cfg: AppConfig; orderId: string; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit() {
    const reason = text.trim();
    if (!reason) return setMsg("Tell us what went wrong.");
    setBusy(true);
    setMsg("");
    try {
      const acct = getTestAccount(cfg, "buyer", false);
      if (!acct) throw new Error("This browser does not hold the buyer's wallet");
      const w = walletOf(cfg, acct);
      const tx = await w.writeContract({
        address: cfg.checkout,
        abi: checkoutAbi,
        functionName: "openDispute",
        args: [BigInt(orderId), keccak256(toHex(reason))],
        account: acct,
        chain: w.chain,
      });
      await publicClientOf(cfg).waitForTransactionReceipt({ hash: tx });
      const signature = await acct.signMessage({ message: disputeReasonMessage(orderId, reason) });
      const r = await fetch(`/api/orders/${orderId}/dispute`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: reason, signature }) });
      setMsg(r.ok ? "Reported. PoP will review it." : "Reported on-chain, but the note could not be saved. The team can still decide.");
      onDone?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message.split("\n")[0] : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-xl border-2 border-red-600 py-2 font-semibold text-red-700">
        Report a problem
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border-2 border-red-600 p-4 text-sm">
      <div className="font-semibold">What went wrong?</div>
      <textarea
        className="w-full rounded border p-2"
        rows={3}
        maxLength={DISPUTE_TEXT_MAX}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. the parcel was empty, or the item is not what was shown"
      />
      <div className="text-xs text-neutral-600">Only this window lets you report. PoP decides: refund, pay the seller, or split. If nobody decides in time, you are refunded.</div>
      <div className="flex gap-2">
        <button disabled={busy} onClick={submit} className="flex-1 rounded bg-red-700 py-2 font-semibold text-white disabled:opacity-50">
          {busy ? "Sending…" : "Send report"}
        </button>
        <button disabled={busy} onClick={() => setOpen(false)} className="rounded border px-3">
          Cancel
        </button>
      </div>
      {msg && <div className="text-neutral-700">{msg}</div>}
    </div>
  );
}
