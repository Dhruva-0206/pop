"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfig } from "@/lib/client/config";
import { STATE_LABEL, countdown, usdt } from "@/lib/client/format";
import { TestModeBanner } from "@/components/Banners";
import { FinalizeButton } from "@/components/FinalizeButton";
import Scanner from "./Scanner";

type Row = {
  orderId: string;
  listingId?: string;
  trackingNo?: string;
  courierStatus?: string;
  live: { state: string; amount: string; deliverBy: number; now: number; canFinalize: boolean } | null;
};

const SIM_STATUSES = ["Picked up", "In transit", "Out for delivery"] as const;

export default function Courier() {
  const { cfg } = useConfig();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pass, setPass] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [scanFor, setScanFor] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/courier/orders", { cache: "no-store" });
    if (r.status === 401) return setAuthed(false);
    setAuthed(true);
    setRows((await r.json()).orders);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function post(path: string, body: object) {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      setMsg(j.ok ? "Done." : j.error ?? "Failed");
      load();
      return j;
    } finally {
      setBusy(false);
    }
  }

  const onScan = useCallback(
    (text: string) => {
      if (scanFor) setCodes((c) => ({ ...c, [scanFor]: text }));
      setScanFor(null);
    },
    [scanFor],
  );

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="rounded bg-sky-100 px-3 py-2 text-center text-sm font-bold tracking-wide text-sky-900">
        SIMULATED COURIER · operated by the PoP team for the demo
      </div>
      <TestModeBanner cfg={cfg} />
      <p className="text-xs text-neutral-600">
        The courier can do two things on-chain: submit the buyer&apos;s code at the door (anyone could), or report
        &quot;handover refused&quot;, which sends the order to a human. It can never pay out or refund money.
      </p>

      {authed === false && (
        <div className="flex gap-2">
          <input className="flex-1 rounded border p-2" type="password" placeholder="Team passcode" value={pass} onChange={(e) => setPass(e.target.value)} />
          <button
            className="rounded bg-sky-700 px-4 text-white"
            onClick={async () => {
              const r = await fetch("/api/courier/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ passcode: pass }),
              });
              if (!r.ok) setMsg("Wrong passcode");
              else load();
            }}
          >
            Sign in
          </button>
        </div>
      )}

      {authed &&
        rows.map((r) => (
          <div key={r.orderId} className="space-y-2 rounded-xl border p-4 text-sm">
            <div className="flex justify-between">
              <span className="font-semibold">Order #{r.orderId}</span>
              <span>{r.live ? STATE_LABEL[r.live.state] ?? r.live.state : "?"}</span>
            </div>
            <div className="text-xs text-neutral-500">
              {r.trackingNo ? `Tracking ${r.trackingNo} · ` : ""}
              {r.courierStatus ?? "no courier updates yet"}
              {r.live && cfg ? ` · ${usdt(r.live.amount, cfg.tokenDecimals)} test USDT` : ""}
            </div>

            {r.live?.state === "Shipped" && (
              <>
                <div className="flex flex-wrap gap-1">
                  {SIM_STATUSES.map((s) => (
                    <button key={s} disabled={busy} onClick={() => post("/api/courier/status", { orderId: r.orderId, status: s })} className="rounded border px-2 py-1 text-xs">
                      {s}
                    </button>
                  ))}
                  <span className="self-center text-xs text-neutral-500">deliver within {countdown(r.live.deliverBy, r.live.now)}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded border p-2 font-mono"
                    placeholder="Buyer's 6-word code"
                    value={codes[r.orderId] ?? ""}
                    onChange={(e) => setCodes({ ...codes, [r.orderId]: e.target.value })}
                  />
                  <button className="rounded border px-2 text-xs" onClick={() => setScanFor(r.orderId)}>Scan QR</button>
                </div>
                {scanFor === r.orderId && <Scanner onCode={onScan} onClose={() => setScanFor(null)} />}
                <div className="flex gap-2">
                  <button
                    disabled={busy || !codes[r.orderId]}
                    onClick={() => post("/api/courier/deliver", { orderId: r.orderId, code: codes[r.orderId] })}
                    className="flex-1 rounded-lg bg-emerald-600 py-2 font-semibold text-white disabled:opacity-50"
                  >
                    Delivered: submit code
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => post("/api/courier/refused", { orderId: r.orderId })}
                    className="flex-1 rounded-lg border-2 border-red-500 py-2 font-semibold text-red-700"
                  >
                    Handover refused
                  </button>
                </div>
              </>
            )}
            {r.live?.canFinalize && cfg && <FinalizeButton cfg={cfg} orderId={r.orderId} onDone={load} />}
          </div>
        ))}
      {msg && <div className="text-sm text-neutral-700">{msg}</div>}
    </main>
  );
}
