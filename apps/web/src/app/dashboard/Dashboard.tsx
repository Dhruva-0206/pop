"use client";

import { useCallback, useEffect, useState } from "react";
import { keccak256, toHex } from "viem";
import { checkoutAbi } from "@pop/shared";
import { publicClientOf, useConfig } from "@/lib/client/config";
import { forgetTestKey, getTestAccount, importTestKey, walletOf } from "@/lib/client/wallet";
import { sellerLoginMessage } from "@/lib/messages";
import { STATE_LABEL, countdown, short, usdt } from "@/lib/client/format";
import { TestModeBanner } from "@/components/Banners";
import { FinalizeButton } from "@/components/FinalizeButton";

type Row = {
  orderId: string;
  listingId?: string;
  amountUnits: string;
  trackingNo?: string;
  courierStatus?: string;
  delivery: { name?: string; phone?: string; address?: string } | null;
  live: { state: string; shipBy: number; now: number; canFinalize: boolean } | null;
};

export default function Dashboard() {
  const { cfg } = useConfig();
  const [addr, setAddr] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [signedIn, setSignedIn] = useState<{ handle?: string } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [credit, setCredit] = useState<bigint>(BigInt(0));
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!cfg) return;
    const a = getTestAccount(cfg, "seller", false);
    if (a) setAddr(a.address);
  }, [cfg]);

  const load = useCallback(async () => {
    const r = await fetch("/api/seller/orders", { cache: "no-store" });
    if (r.status === 401) return setSignedIn(null);
    const j = await r.json();
    setSignedIn({ handle: j.seller.handle });
    setRows(j.orders);
    if (cfg && j.seller.wallet) {
      setCredit(
        await publicClientOf(cfg).readContract({ address: cfg.checkout, abi: checkoutAbi, functionName: "credit", args: [j.seller.wallet] }),
      );
    }
  }, [cfg]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function signIn() {
    if (!cfg) return;
    setMsg("");
    const acct = getTestAccount(cfg, "seller", false);
    if (!acct) return setMsg("Load your seller test key first.");
    const n = await fetch("/api/auth/seller/nonce", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: acct.address }),
    });
    const nj = await n.json();
    if (!n.ok) return setMsg(nj.error ?? "Sign-in failed");
    const signature = await acct.signMessage({ message: sellerLoginMessage(acct.address, nj.nonce) });
    const r = await fetch("/api/auth/seller", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: acct.address, nonce: nj.nonce, signature }),
    });
    const j = await r.json();
    if (!r.ok) return setMsg(j.error ?? "Sign-in failed");
    load();
  }

  async function ship(orderId: string) {
    if (!cfg) return;
    const t = tracking[orderId]?.trim();
    if (!t) return setMsg("Enter a tracking number first.");
    setBusy(true);
    try {
      await fetch("/api/seller/tracking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, trackingNo: t }),
      });
      const acct = getTestAccount(cfg, "seller", false)!;
      const w = walletOf(cfg, acct);
      const tx = await w.writeContract({
        address: cfg.checkout,
        abi: checkoutAbi,
        functionName: "markShipped",
        args: [BigInt(orderId), keccak256(toHex(t))],
        account: acct,
        chain: w.chain,
      });
      await publicClientOf(cfg).waitForTransactionReceipt({ hash: tx });
      setMsg(`Order #${orderId} marked shipped.`);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message.split("\n")[0] : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!cfg) return;
    setBusy(true);
    try {
      const acct = getTestAccount(cfg, "seller", false)!;
      const w = walletOf(cfg, acct);
      const tx = await w.writeContract({ address: cfg.checkout, abi: checkoutAbi, functionName: "withdraw", account: acct, chain: w.chain });
      await publicClientOf(cfg).waitForTransactionReceipt({ hash: tx });
      setMsg("Withdrawn to your wallet.");
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message.split("\n")[0] : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!cfg) return <div className="page-wide stack">Loading…</div>;

  return (
    <div className="page-wide stack">
      <TestModeBanner cfg={cfg} />
      <h1 className="text-xl font-semibold">Seller dashboard{signedIn?.handle ? ` · @${signedIn.handle}` : ""}</h1>

      {!signedIn && (
        <div className="card stack-sm text-sm">
          {addr ? (
            <div>
              Seller test wallet in this browser: <span className="font-mono">{short(addr)}</span>{" "}
              <button className="btn btn-secondary btn-sm" onClick={() => { forgetTestKey(cfg, "seller"); setAddr(""); }}>forget</button>
            </div>
          ) : (
            <div className="space-y-1">
              <div>TEST MODE: paste the demo seller&apos;s test key (kept only in this browser).</div>
              <input className="field mono" type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="0x…" aria-label="0x…" />
              <button
                className="btn btn-primary"
                onClick={() => {
                  try {
                    importTestKey(cfg, "seller", keyInput);
                    setKeyInput("");
                    setAddr(getTestAccount(cfg, "seller", false)!.address);
                  } catch (e) {
                    setMsg(String(e));
                  }
                }}
              >
                Load key
              </button>
            </div>
          )}
          <button disabled={!addr} onClick={signIn} className="btn btn-primary">
            Sign in (signature only, moves no money)
          </button>
        </div>
      )}

      {signedIn && (
        <>
          <div className="card flex items-center justify-between">
            <div>
              <div className="text-sm text-muted">Ready to withdraw</div>
              <div className="text-xl font-semibold">{usdt(credit, cfg.tokenDecimals)} test USDT</div>
            </div>
            <button disabled={busy || credit === BigInt(0)} onClick={withdraw} className="btn btn-primary">
              Withdraw
            </button>
          </div>

          <a href="/api/seller/orders.csv" download className="btn btn-secondary">
            Export orders (CSV with tx hashes)
          </a>
          {rows.length === 0 && <div className="text-sm text-muted">No orders yet.</div>}
          {rows.map((r) => (
            <div key={r.orderId} className="card stack-sm text-sm">
              <div className="flex justify-between">
                <span className="font-semibold">Order #{r.orderId}</span>
                <span>{usdt(r.amountUnits, cfg.tokenDecimals)} test USDT</span>
              </div>
              <div>{r.live ? STATE_LABEL[r.live.state] ?? r.live.state : "?"}</div>
              {r.delivery && (
                <div className="rounded-control bg-surface p-2 text-xs">
                  Ship to: {r.delivery.name} · {r.delivery.phone}
                  <br />
                  {r.delivery.address}
                </div>
              )}
              {r.courierStatus && <div className="text-xs text-muted">Courier (simulated): {r.courierStatus}</div>}
              {r.live?.state === "Funded" && (
                <div className="flex gap-2">
                  <input
                    className="field flex-1"
                    placeholder="Tracking number" aria-label="Tracking number"
                    value={tracking[r.orderId] ?? ""}
                    onChange={(e) => setTracking({ ...tracking, [r.orderId]: e.target.value })}
                  />
                  <button disabled={busy} onClick={() => ship(r.orderId)} className="btn btn-primary">
                    Mark shipped
                  </button>
                  <span className="self-center text-xs text-muted">ship within {countdown(r.live.shipBy, r.live.now)}</span>
                </div>
              )}
              {r.live?.canFinalize && <FinalizeButton cfg={cfg} orderId={r.orderId} onDone={load} />}
            </div>
          ))}
        </>
      )}
      {msg && (
        <p role="status" className="text-sm text-ink-2">
          {msg}
        </p>
      )}
    </div>
  );
}
