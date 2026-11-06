"use client";

import { useState } from "react";
import { startPayWithPoP } from "@pop/checkout-sdk/browser";

export default function PayButton() {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <button
        disabled={busy}
        className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-50"
        onClick={() => {
          setBusy(true);
          setErr("");
          startPayWithPoP("/api/checkout").catch((e: Error) => (setErr(e.message), setBusy(false)));
        }}
      >
        {busy ? "Opening protected checkout…" : "Pay with PoP · protected checkout"}
      </button>
      {err && <div className="text-sm text-red-700">{err}</div>}
    </div>
  );
}
