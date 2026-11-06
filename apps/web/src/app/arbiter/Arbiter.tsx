"use client";

import { useCallback, useEffect, useState } from "react";
import { keccak256, toHex, type Hex } from "viem";
import { checkoutAbi, registryAbi } from "@pop/shared";
import { publicClientOf, useConfig, type AppConfig } from "@/lib/client/config";
import { forgetTestKey, getTestAccount, importTestKey, walletOf } from "@/lib/client/wallet";
import { countdown, usdt } from "@/lib/client/format";
import { TestModeBanner, TxLink } from "@/components/Banners";

type Dispute = {
  orderId: string; kind: "handover-refused" | "buyer-dispute"; buyer: string; seller: string; sellerHandle: string | null;
  amount: string; arbiterDeadline: number; now: number; expired: boolean; reason: string | null;
};
type SellerInfo = {
  handle: string; wallet: string; active: boolean; banned: boolean; completed: string; lostDisputes: string; totalOrders: number;
  openOrders: { orderId: string; state: string; amount: string; buyer: string }[];
};
type Pending = { id: number; handle: string; wallet: string; bioCode: string; createdAt: string };

const errText = (e: unknown) => (e instanceof Error ? e.message.split("\n")[0] : "Failed");

export default function Arbiter() {
  const { cfg } = useConfig();
  const [addr, setAddr] = useState("");
  const [isArbiter, setIsArbiter] = useState<boolean | null>(null);
  const [pk, setPk] = useState("");
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [bps, setBps] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [lastTx, setLastTx] = useState("");
  const [handle, setHandle] = useState("");
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [confirmBan, setConfirmBan] = useState(false);
  const [staff, setStaff] = useState<boolean | null>(null);
  const [pass, setPass] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);

  const loadKey = useCallback(async (c: AppConfig) => {
    const a = getTestAccount(c, "arbiter", false);
    setAddr(a?.address ?? "");
    if (a) {
      const role = await publicClientOf(c).readContract({ address: c.checkout, abi: checkoutAbi, functionName: "ARBITER_ROLE" });
      setIsArbiter(await publicClientOf(c).readContract({ address: c.checkout, abi: checkoutAbi, functionName: "hasRole", args: [role, a.address] }));
    } else setIsArbiter(null);
  }, []);

  const loadDisputes = useCallback(async () => {
    const r = await fetch("/api/arbiter/disputes", { cache: "no-store" });
    if (r.ok) setDisputes((await r.json()).disputes);
  }, []);
  const loadStaff = useCallback(async () => {
    const r = await fetch("/api/staff/onboard", { cache: "no-store" });
    setStaff(r.ok);
    if (r.ok) setPending((await r.json()).pending);
  }, []);

  useEffect(() => {
    if (!cfg) return;
    loadKey(cfg);
    loadDisputes();
    loadStaff();
    const t = setInterval(() => (loadDisputes(), loadStaff()), 5000);
    return () => clearInterval(t);
  }, [cfg, loadKey, loadDisputes, loadStaff]);

  async function send(fn: (c: AppConfig, acct: NonNullable<ReturnType<typeof getTestAccount>>) => Promise<Hex>, done: string) {
    if (!cfg) return;
    setBusy(true);
    setMsg("");
    try {
      const acct = getTestAccount(cfg, "arbiter", false);
      if (!acct) throw new Error("Import the arbiter test key first");
      const tx = await fn(cfg, acct);
      await publicClientOf(cfg).waitForTransactionReceipt({ hash: tx });
      setLastTx(tx);
      setMsg(done);
      await loadDisputes();
      if (seller) await lookup();
    } catch (e) {
      setMsg(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const resolve = (d: Dispute, buyerBps: number) =>
    send(async (c, acct) => {
      const w = walletOf(c, acct);
      const note = notes[d.orderId]?.trim() ?? "";
      return w.writeContract({ address: c.checkout, abi: checkoutAbi, functionName: "resolveDispute", args: [BigInt(d.orderId), buyerBps, note ? keccak256(toHex(note)) : (`0x${"00".repeat(32)}` as Hex)], account: acct, chain: w.chain });
    }, `Order #${d.orderId} resolved (${buyerBps / 100}% to the buyer).`);

  async function lookup() {
    setSeller(null);
    setConfirmBan(false);
    const r = await fetch(`/api/arbiter/seller?handle=${encodeURIComponent(handle.trim())}`, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) return setMsg(j.error ?? "lookup failed");
    setSeller(j);
  }
  const ban = () =>
    send(async (c, acct) => {
      const w = walletOf(c, acct);
      return w.writeContract({ address: c.registry, abi: registryAbi, functionName: "ban", args: [seller!.wallet as Hex], account: acct, chain: w.chain });
    }, `@${seller?.handle} is banned (permanent).`);
  const forceRefund = (orderId: string) =>
    send(async (c, acct) => {
      const w = walletOf(c, acct);
      return w.writeContract({ address: c.checkout, abi: checkoutAbi, functionName: "forceRefundBanned", args: [BigInt(orderId)], account: acct, chain: w.chain });
    }, `Order #${orderId} refunded to the buyer in full.`);

  async function decide(id: number, approve: boolean) {
    setBusy(true);
    setMsg("");
    const r = await fetch("/api/staff/onboard", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, approve }) });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? (approve ? "Approved: the seller can now register." : "Rejected.") : (j.error ?? "failed"));
    setBusy(false);
    loadStaff();
  }

  if (!cfg) return <main className="mx-auto max-w-2xl p-6 text-neutral-500">Loading…</main>;
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <TestModeBanner cfg={cfg} />
      <h1 className="text-xl font-semibold">Arbiter and staff</h1>

      <section className="space-y-2 rounded-xl border p-4 text-sm">
        <div className="font-semibold">Arbiter wallet (TEST MODE: the key stays in this browser)</div>
        {addr ? (
          <div className="space-y-1">
            <div className="font-mono text-xs">{addr}</div>
            <div className={isArbiter ? "text-emerald-700" : "text-red-700"}>{isArbiter ? "Has the ARBITER role on this checkout." : "This wallet does NOT have the ARBITER role: on-chain actions will fail."}</div>
            <button className="text-xs underline" onClick={() => { forgetTestKey(cfg, "arbiter"); loadKey(cfg); }}>forget</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input className="min-w-0 flex-1 rounded border p-2 font-mono text-xs" placeholder="paste the arbiter test key (0x…)" value={pk} onChange={(e) => setPk(e.target.value)} />
            <button className="rounded bg-neutral-900 px-3 text-white" onClick={() => { try { importTestKey(cfg, "arbiter", pk); setPk(""); loadKey(cfg); } catch (e) { setMsg(errText(e)); } }}>
              Import
            </button>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="font-semibold">Disputes waiting for a decision ({disputes.length})</div>
        {disputes.length === 0 && <div className="text-sm text-neutral-500">None right now.</div>}
        {disputes.map((d) => (
          <div key={d.orderId} className="space-y-2 rounded-xl border p-4 text-sm">
            <div className="flex justify-between">
              <span className="font-semibold">Order #{d.orderId} · {d.sellerHandle ? `@${d.sellerHandle}` : d.seller.slice(0, 8)}</span>
              <span>{usdt(d.amount, cfg.tokenDecimals)} test USDT</span>
            </div>
            <div className="text-xs text-neutral-600">
              {d.kind === "handover-refused" ? "Courier reported: the buyer refused the handover." : "Buyer opened a dispute after delivery."}{" "}
              {d.expired ? "Decision time is over: anyone can finalize into a refund." : `Decide within ${countdown(d.arbiterDeadline, d.now)}.`}
            </div>
            {d.reason && <div className="rounded bg-neutral-50 p-2 text-xs">Buyer says: {d.reason}</div>}
            <input className="w-full rounded border p-2 text-xs" placeholder="decision note (its hash is recorded on-chain)" value={notes[d.orderId] ?? ""} onChange={(e) => setNotes({ ...notes, [d.orderId]: e.target.value })} />
            <div className="flex flex-wrap items-center gap-2">
              <button disabled={busy || d.expired} onClick={() => resolve(d, 10000)} className="rounded bg-red-700 px-3 py-1.5 text-white disabled:opacity-50">Refund buyer</button>
              <button disabled={busy || d.expired} onClick={() => resolve(d, 0)} className="rounded bg-emerald-700 px-3 py-1.5 text-white disabled:opacity-50">Release to seller</button>
              <input className="w-20 rounded border p-1.5 text-xs" inputMode="numeric" placeholder="buyer %" value={bps[d.orderId] ?? "50"} onChange={(e) => setBps({ ...bps, [d.orderId]: e.target.value })} />
              <button disabled={busy || d.expired} onClick={() => resolve(d, Math.max(0, Math.min(100, Math.round(Number(bps[d.orderId] ?? "50")))) * 100)} className="rounded border px-3 py-1.5 disabled:opacity-50">Split</button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-2 rounded-xl border p-4 text-sm">
        <div className="font-semibold">Ban a seller (permanent)</div>
        <div className="flex gap-2">
          <input className="min-w-0 flex-1 rounded border p-2" placeholder="@handle" value={handle} onChange={(e) => setHandle(e.target.value)} />
          <button disabled={!handle.trim()} onClick={lookup} className="rounded bg-neutral-900 px-3 text-white disabled:opacity-50">Look up</button>
        </div>
        {seller && (
          <div className="space-y-2">
            <div>
              @{seller.handle} · {seller.completed} of {seller.totalOrders} completed · {seller.lostDisputes} disputes lost ·{" "}
              <b className={seller.banned ? "text-red-700" : "text-emerald-700"}>{seller.banned ? "BANNED" : seller.active ? "active" : "inactive"}</b>
            </div>
            {!seller.banned && (
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={confirmBan} onChange={(e) => setConfirmBan(e.target.checked)} />
                I understand a ban cannot be undone and stops all new orders for this seller.
              </label>
            )}
            {!seller.banned && (
              <button disabled={busy || !confirmBan} onClick={ban} className="rounded bg-red-700 px-3 py-1.5 text-white disabled:opacity-50">Ban @{seller.handle}</button>
            )}
            {seller.banned && seller.openOrders.length > 0 && <div className="text-xs text-neutral-600">Open orders of a banned seller can be refunded to the buyers in full:</div>}
            {seller.banned &&
              seller.openOrders.map((o) => (
                <div key={o.orderId} className="flex items-center justify-between rounded border p-2 text-xs">
                  <span>#{o.orderId} · {o.state} · {usdt(o.amount, cfg.tokenDecimals)} test USDT</span>
                  <button disabled={busy} onClick={() => forceRefund(o.orderId)} className="rounded bg-red-700 px-2 py-1 text-white disabled:opacity-50">Force refund</button>
                </div>
              ))}
            {!seller.banned && seller.openOrders.length > 0 && <div className="text-xs text-neutral-500">{seller.openOrders.length} open order(s) (refundable after a ban).</div>}
          </div>
        )}
      </section>

      <section className="space-y-2 rounded-xl border p-4 text-sm">
        <div className="font-semibold">Seller onboarding (staff)</div>
        {staff === false ? (
          <div className="flex gap-2">
            <input type="password" className="min-w-0 flex-1 rounded border p-2" placeholder="team passcode" value={pass} onChange={(e) => setPass(e.target.value)} />
            <button
              className="rounded bg-sky-700 px-3 text-white"
              onClick={async () => {
                const r = await fetch("/api/courier/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ passcode: pass }) });
                if (!r.ok) setMsg("Wrong passcode");
                else loadStaff();
              }}
            >
              Sign in
            </button>
          </div>
        ) : (
          <>
            {pending.length === 0 && <div className="text-neutral-500">No pending requests.</div>}
            {pending.map((p) => (
              <div key={p.id} className="space-y-1 rounded border p-2">
                <div>
                  @{p.handle} · wants code <span className="font-mono font-semibold">{p.bioCode}</span> in the bio
                </div>
                <a className="text-xs underline" href={`https://www.instagram.com/${p.handle}/`} target="_blank" rel="noreferrer">
                  open the Instagram profile ↗
                </a>
                <div className="flex gap-2">
                  <button disabled={busy} onClick={() => decide(p.id, true)} className="rounded bg-emerald-700 px-3 py-1 text-white">The code is there: approve</button>
                  <button disabled={busy} onClick={() => decide(p.id, false)} className="rounded border px-3 py-1">Reject</button>
                </div>
              </div>
            ))}
          </>
        )}
      </section>

      {msg && <div className="text-sm text-neutral-700">{msg}</div>}
      <TxLink cfg={cfg} hash={lastTx} label="last transaction" />
    </main>
  );
}
