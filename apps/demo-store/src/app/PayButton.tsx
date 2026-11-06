"use client";

import { useState } from "react";
import { startPayWithPoP } from "@pop/checkout-sdk/browser";
import { ErrorBox } from "@/components/ui";

export default function PayButton() {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="stack-sm">
      {err && <ErrorBox what="We couldn't open the checkout." why={err} next="Press the button again. If it keeps failing, try in a minute." />}
      <button
        disabled={busy}
        className="btn btn-primary btn-block"
        onClick={() => {
          setBusy(true);
          setErr("");
          startPayWithPoP("/api/checkout").catch((e: Error) => (setErr(e.message), setBusy(false)));
        }}
      >
        {busy ? "Opening the checkout, about 5 seconds" : "Pay with PoP"}
      </button>
      <p className="text-center text-sm text-muted">You will pay on PoP&apos;s protected checkout and come back here afterwards.</p>
    </div>
  );
}
