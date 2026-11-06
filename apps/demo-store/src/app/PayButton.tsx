"use client";

import Image from "next/image";
import { useState } from "react";
import { startPayWithPoP } from "@pop/checkout-sdk/browser";
import { ErrorBox } from "@/components/ui";

/** "Pay with PoP": the one element in the store drawn in PoP's colours, so the integration reads as a separate service. */
export default function PayButton() {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="stack-sm">
      {err && <ErrorBox what="We couldn't open the checkout." why={err} next="Press the button again. If it keeps failing, try in a minute." />}
      <button
        disabled={busy}
        className="btn btn-pop btn-block"
        onClick={() => {
          setBusy(true);
          setErr("");
          startPayWithPoP("/api/checkout").catch((e: Error) => (setErr(e.message), setBusy(false)));
        }}
      >
        {!busy && <Image src="/brand/pop-logo-64.png" alt="" width={22} height={22} style={{ borderRadius: 6, boxShadow: "0 0 0 1.5px rgba(255,255,255,0.85)" }} />}
        {busy ? "Opening the checkout, about 5 seconds" : "Pay with PoP"}
      </button>
      <p className="text-sm text-muted">Secure checkout by PoP. You&apos;ll come straight back here.</p>
    </div>
  );
}
