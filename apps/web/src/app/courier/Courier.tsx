"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfig } from "@/lib/client/config";
import { STATE_LABEL, countdown, usdt } from "@/lib/client/format";
import { TestModeBanner } from "@/components/Banners";
import { Notice } from "@/components/ui";
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
    <div className="page-wide stack">
      <h1>Courier desk</h1>
      <Notice tone="neutral" title="SIMULATED COURIER">
        Operated by the PoP team for the demo. It is not a real delivery service.
      </Notice>
      <TestModeBanner cfg={cfg} />
      <p className="text-xs text-muted">
        The courier can do two things on-chain: submit the buyer&apos;s code at the door (anyone could), or report
        &quot;handover refused&quot;, which sends the order to a human. It can never pay out or refund money.
      </p>

      {authed === false && (
        <div>
          <label className="label" htmlFor="courier-pass">
            Team passcode
          </label>
          <div className="flex gap-2">
          <input id="courier-pass" className="field flex-1" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
          <button
            className="btn btn-primary"
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
        </div>
      )}

      {authed &&
        rows.map((r) => (
          <div key={r.orderId} className="card stack-sm text-sm">
            <div className="flex justify-between">
              <span className="mono font-semibold">Order #{r.orderId}</span>
              <span className="text-ink-2">{r.live ? STATE_LABEL[r.live.state] ?? r.live.state : "?"}</span>
            </div>
            <div className="text-xs text-muted">
              {r.trackingNo ? `Tracking ${r.trackingNo} · ` : ""}
              {r.courierStatus ?? "no courier updates yet"}
              {r.live && cfg ? ` · ${usdt(r.live.amount, cfg.tokenDecimals)} test USDT` : ""}
            </div>

            {r.live?.state === "Shipped" && (
              <>
                <div className="flex flex-wrap gap-1">
                  {SIM_STATUSES.map((s) => (
                    <button key={s} disabled={busy} onClick={() => post("/api/courier/status", { orderId: r.orderId, status: s })} className="btn btn-secondary">
                      {s}
                    </button>
                  ))}
                  <span className="self-center text-xs text-muted">deliver within {countdown(r.live.deliverBy, r.live.now)}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    className="field flex-1 mono"
                    placeholder="Buyer's 6-word code" aria-label="Buyer's 6-word code"
                    value={codes[r.orderId] ?? ""}
                    onChange={(e) => setCodes({ ...codes, [r.orderId]: e.target.value })}
                  />
                  <button className="btn btn-secondary" onClick={() => setScanFor(r.orderId)}>Scan QR</button>
                </div>
                {scanFor === r.orderId && <Scanner onCode={onScan} onClose={() => setScanFor(null)} />}
                <div className="flex gap-2">
                  <button
                    disabled={busy || !codes[r.orderId]}
                    onClick={() => post("/api/courier/deliver", { orderId: r.orderId, code: codes[r.orderId] })}
                    className="btn btn-primary flex-1"
                  >
                    Delivered: submit code
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => post("/api/courier/refused", { orderId: r.orderId })}
                    className="btn btn-secondary flex-1 border-danger text-danger"
                  >
                    Handover refused
                  </button>
                </div>
              </>
            )}
            {r.live?.canFinalize && cfg && <FinalizeButton cfg={cfg} orderId={r.orderId} onDone={load} />}
          </div>
        ))}
      {msg && (
        <p role="status" className="text-sm text-ink-2">
          {msg}
        </p>
      )}
    </div>
  );
}
