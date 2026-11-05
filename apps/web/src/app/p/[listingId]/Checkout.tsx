"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { decodeEventLog, erc20Abi, type Hex } from "viem";
import { checkoutAbi, deliveryCodeHash, termsHash, type Terms } from "@pop/shared";
import { publicClientOf, useConfig } from "@/lib/client/config";
import { getTestAccount, saveCode, walletOf } from "@/lib/client/wallet";
import { newDeliveryCode } from "@/lib/client/code";
import { priceLabel, short, usdt, when } from "@/lib/client/format";
import { TestModeBanner } from "@/components/Banners";
import { orderRegisterMessage } from "@/lib/messages";

type ListingResp = {
  listing: {
    id: string;
    title: string;
    imageUrl?: string;
    sellerHandle: string;
    sellerWallet: string;
    priceUnits: string;
    priceInr: number;
    terms: Terms;
    termsHash: string;
    offer: Record<string, string | number>;
    offerSig: Hex;
  };
  termsHashMatches: boolean;
  sellerStanding: { active: boolean; handleTier: number; completed: string; lostDisputes: string };
};

const TIER = ["Unverified handle", "Handle checked by PoP staff", "Handle cryptographically proven"];

export default function Checkout() {
  const { listingId } = useParams<{ listingId: string }>();
  const router = useRouter();
  const { cfg } = useConfig();
  const [data, setData] = useState<ListingResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [buyer, setBuyer] = useState<string>("");
  const [bal, setBal] = useState<{ usdt: bigint; gas: bigint } | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [step, setStep] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/listings/${listingId}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? setData(await r.json()) : setErr("This product link isn't active.")))
      .catch(() => setErr("Couldn't load this product."));
  }, [listingId]);

  const refreshBalance = useCallback(async () => {
    if (!cfg) return;
    const acct = getTestAccount(cfg, "buyer")!;
    setBuyer(acct.address);
    const pc = publicClientOf(cfg);
    const [u, g] = await Promise.all([
      pc.readContract({ address: cfg.token, abi: erc20Abi, functionName: "balanceOf", args: [acct.address] }),
      pc.getBalance({ address: acct.address }),
    ]);
    setBal({ usdt: u, gas: g });
  }, [cfg]);

  useEffect(() => {
    refreshBalance().catch(() => {});
  }, [refreshBalance]);

  async function pay() {
    if (!cfg || !data) return;
    if (!form.name || form.phone.length < 5 || form.address.length < 5) {
      setStep("Please fill in your delivery details.");
      return;
    }
    setBusy(true);
    try {
      const l = data.listing;
      const price = BigInt(l.priceUnits);
      const pc = publicClientOf(cfg);
      const acct = getTestAccount(cfg, "buyer")!;
      const w = walletOf(cfg, acct);

      // 1) Test wallet top-up (TEST MODE only).
      if (!bal || bal.usdt < price || bal.gas === BigInt(0)) {
        setStep("Adding test funds to your test wallet…");
        const f = await fetch("/api/faucet", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ address: acct.address }),
        });
        if (!f.ok) throw new Error((await f.json()).error ?? "Test faucet failed");
        await refreshBalance();
      }

      // 2) The delivery code is created here, in your browser. Only its hash goes on-chain.
      const words = newDeliveryCode();
      const codeHash = deliveryCodeHash(cfg.chainId, cfg.checkout, words);
      sessionStorage.setItem("pop:pending-code", words);

      // 3) Approve exactly the price, then pay the seller-signed offer.
      const allowance = await pc.readContract({
        address: cfg.token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [acct.address, cfg.checkout],
      });
      if (allowance < price) {
        setStep("Step 1 of 2: allowing PoP to take exactly this amount…");
        const a = await w.writeContract({
          address: cfg.token,
          abi: erc20Abi,
          functionName: "approve",
          args: [cfg.checkout, price],
          account: acct,
          chain: w.chain,
        });
        await pc.waitForTransactionReceipt({ hash: a });
      }
      setStep("Step 2 of 2: paying…");
      const o = l.offer;
      const offer = {
        seller: o.seller as Hex,
        listingId: o.listingId as Hex,
        termsHash: o.termsHash as Hex,
        externalRef: o.externalRef as Hex,
        price: BigInt(o.price),
        shipWithin: Number(o.shipWithin),
        deliverWithin: Number(o.deliverWithin),
        maxUnits: Number(o.maxUnits),
        validUntil: BigInt(o.validUntil),
        version: BigInt(o.version),
      };
      const tx = await w.writeContract({
        address: cfg.checkout,
        abi: checkoutAbi,
        functionName: "pay",
        args: [offer, l.offerSig, codeHash],
        account: acct,
        chain: w.chain,
      });
      const rc = await pc.waitForTransactionReceipt({ hash: tx });
      if (rc.status !== "success") throw new Error("Payment failed");
      let orderId = "";
      for (const log of rc.logs) {
        try {
          const ev = decodeEventLog({ abi: checkoutAbi, data: log.data, topics: log.topics });
          if (ev.eventName === "OrderFunded") orderId = ev.args.orderId.toString();
        } catch {
          /* other contract's log */
        }
      }
      if (!orderId) throw new Error("Paid, but couldn't read the order number");
      saveCode(cfg, orderId, words);
      sessionStorage.removeItem("pop:pending-code");

      // 4) Server reads the receipt itself and stores the order (delivery details encrypted).
      setStep("Saving your order…");
      const signature = await acct.signMessage({ message: orderRegisterMessage(tx, form) });
      const reg = await fetch("/api/orders/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txHash: tx, signature, delivery: form }),
      });
      if (!reg.ok) throw new Error(`Paid (order #${orderId}), but saving delivery details failed. Open /o/${orderId}.`);
      router.push(`/o/${orderId}?new=1`);
    } catch (e) {
      setStep(e instanceof Error ? e.message.split("\n")[0] : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (err) return <main className="mx-auto max-w-md p-6 text-red-700">{err}</main>;
  if (!data || !cfg) return <main className="mx-auto max-w-md p-6 text-neutral-500">Loading…</main>;
  const l = data.listing;
  const s = data.sellerStanding;
  const shipH = Math.round(l.terms.shipWithinSec / 60);
  const delH = Math.round(l.terms.deliverWithinSec / 60);
  const recomputed = termsHash(l.terms);

  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <TestModeBanner cfg={cfg} />

      <div className="rounded-xl border p-4">
        <div className="text-xs text-neutral-500">@{l.sellerHandle}</div>
        <h1 className="text-xl font-semibold">{l.title}</h1>
        <div className="mt-1 text-lg">{priceLabel(l.priceInr, l.priceUnits, cfg.tokenDecimals)}</div>
      </div>

      <div className={`rounded-xl border p-4 ${s.active ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
        <div className="font-semibold">{s.active ? `@${l.sellerHandle} is a PoP seller` : "Not an active PoP seller"}</div>
        <div className="text-sm">{TIER[s.handleTier] ?? "Unknown"}</div>
        <div className="text-sm text-neutral-700">
          {s.completed} protected orders completed · {s.lostDisputes} disputes lost
        </div>
        <div className="text-xs">
          <Link className="text-emerald-700 underline" href={`/verify/${l.sellerHandle}`}>
            See @{l.sellerHandle}&apos;s record and reviews
          </Link>
        </div>
      </div>

      <div className="space-y-1 rounded-xl border p-4 text-sm">
        <div>🛡 Ships within {shipH} min, or you&apos;re refunded automatically</div>
        <div>📦 Arrives within {delH} min of shipping, or you&apos;re refunded automatically</div>
        <div>🔑 @{l.sellerHandle} is paid only when you give your delivery code at the door</div>
        <div>⏱ Time after delivery to report a problem: set by the seller&apos;s record</div>
        <div className="pt-1 text-xs text-neutral-500">
          Terms fingerprint {short(l.termsHash)} · {recomputed === l.termsHash ? "matches these terms ✓" : "DOES NOT MATCH ✗"}
        </div>
        <div className="text-xs text-neutral-500">(Demo times are minutes; real orders use days.)</div>
      </div>

      <div className="space-y-2 rounded-xl border p-4">
        <div className="text-sm font-semibold">Deliver to (only the seller sees this)</div>
        <input className="w-full rounded border p-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="w-full rounded border p-2" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <textarea className="w-full rounded border p-2" placeholder="Address" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </div>

      <div className="rounded-xl border p-3 text-xs text-neutral-600">
        Test wallet {short(buyer)} · {bal ? `${usdt(bal.usdt, cfg.tokenDecimals)} test USDT` : "…"}
      </div>

      <button
        disabled={busy || !s.active}
        onClick={pay}
        className="w-full rounded-xl bg-emerald-600 py-3 text-lg font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Working…" : `Pay ${priceLabel(l.priceInr, l.priceUnits, cfg.tokenDecimals)}`}
      </button>
      {step && <div className="text-sm text-neutral-700">{step}</div>}
      <div className="text-center text-xs text-neutral-400">Offer valid until {when(Number(l.offer.validUntil))}</div>
    </main>
  );
}
