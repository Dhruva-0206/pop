"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { parseUnits, zeroHash, type Hex } from "viem";
import { checkoutAbi, listingIdHash, offerDomain, offerTypes, registryAbi, termsHash, type Terms } from "@pop/shared";
import { publicClientOf, useConfig } from "@/lib/client/config";
import { getTestAccount, walletOf } from "@/lib/client/wallet";
import { onboardRequestMessage } from "@/lib/messages";
import { TestModeBanner, TxLink } from "@/components/Banners";

type Status = {
  status: "none" | "pending" | "approved" | "rejected";
  handle?: string;
  bioCode?: string;
  registration?: { seller: Hex; handleHash: Hex; handleTier: number; nonce: string; deadline: number; signature: Hex };
  listing?: { id: string; title: string };
};

const errText = (e: unknown) => (e instanceof Error ? e.message.split("\n")[0] : "Something went wrong");

export default function Onboard() {
  const { cfg } = useConfig();
  const [addr, setAddr] = useState<Hex | "">("");
  const [st, setSt] = useState<Status>({ status: "none" });
  const [registered, setRegistered] = useState(false);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [regTx, setRegTx] = useState("");
  // product form
  const [title, setTitle] = useState("Silver jhumkas (oxidised, handmade)");
  const [priceInr, setPriceInr] = useState("899");
  const [priceUsdt, setPriceUsdt] = useState("1.00");
  const [shipMin, setShipMin] = useState("3");
  const [deliverMin, setDeliverMin] = useState("5");
  const [qr, setQr] = useState("");

  useEffect(() => {
    if (cfg) setAddr(getTestAccount(cfg, "seller")!.address);
  }, [cfg]);

  const refresh = useCallback(async () => {
    if (!cfg || !addr) return;
    const r = await fetch(`/api/onboard/status?wallet=${addr}`, { cache: "no-store" });
    if (r.ok) setSt(await r.json());
    const active = await publicClientOf(cfg).readContract({ address: cfg.registry, abi: registryAbi, functionName: "isActive", args: [addr] });
    setRegistered(Boolean(active));
  }, [cfg, addr]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const link = st.listing && typeof window !== "undefined" ? `${window.location.origin}/p/${st.listing.id}` : "";
  useEffect(() => {
    if (link) QRCode.toDataURL(link, { margin: 1, width: 200 }).then(setQr);
  }, [link]);

  async function ensureGas(a: Hex) {
    if (!cfg) return;
    const pc = publicClientOf(cfg);
    if ((await pc.getBalance({ address: a })) === BigInt(0)) {
      await fetch("/api/faucet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: a }) });
    }
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMsg("");
    try {
      await fn();
    } catch (e) {
      setMsg(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const requestCode = () =>
    run(async () => {
      if (!cfg) return;
      const acct = getTestAccount(cfg, "seller")!;
      const h = handle.trim().toLowerCase().replace(/^@/, "");
      const signature = await acct.signMessage({ message: onboardRequestMessage(h, acct.address) });
      const r = await fetch("/api/onboard/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ handle: h, wallet: acct.address, signature }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "request failed");
      await refresh();
    });

  const registerOnChain = () =>
    run(async () => {
      if (!cfg || !st.registration) return;
      const acct = getTestAccount(cfg, "seller")!;
      await ensureGas(acct.address);
      const w = walletOf(cfg, acct);
      const r = st.registration;
      const tx = await w.writeContract({
        address: cfg.registry,
        abi: registryAbi,
        functionName: "registerSeller",
        args: [r.seller, r.handleHash, r.handleTier, BigInt(r.nonce), BigInt(r.deadline), r.signature],
        account: acct,
        chain: w.chain,
      });
      await publicClientOf(cfg).waitForTransactionReceipt({ hash: tx });
      setRegTx(tx);
      await refresh();
    });

  const publish = () =>
    run(async () => {
      if (!cfg || !st.handle) return;
      const acct = getTestAccount(cfg, "seller")!;
      const w = walletOf(cfg, acct);
      const slug = `${st.handle.replace(/[._]/g, "-")}-${Math.random().toString(16).slice(2, 6)}`;
      const terms: Terms = {
        title: title.trim(),
        priceInr: Math.round(Number(priceInr)),
        shipWithinSec: Math.round(Number(shipMin) * 60),
        deliverWithinSec: Math.round(Number(deliverMin) * 60),
        returnPolicy: "Report a problem within the window after delivery; the arbiter decides refund, release or split.",
      };
      const minV = await publicClientOf(cfg).readContract({ address: cfg.checkout, abi: checkoutAbi, functionName: "minOfferVersion", args: [acct.address] });
      const offer = {
        seller: acct.address,
        listingId: listingIdHash(slug),
        termsHash: termsHash(terms),
        externalRef: zeroHash,
        price: parseUnits(priceUsdt, cfg.tokenDecimals),
        shipWithin: terms.shipWithinSec,
        deliverWithin: terms.deliverWithinSec,
        maxUnits: 50,
        validUntil: BigInt(Math.floor(Date.now() / 1000) + 6 * 86400),
        version: minV > BigInt(1) ? minV : BigInt(1),
      };
      const offerSig = await w.signTypedData({ account: acct, domain: offerDomain(cfg.chainId, cfg.checkout), types: offerTypes, primaryType: "Offer", message: offer });
      const r = await fetch("/api/onboard/listing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, terms, offerSig, offer: { ...offer, price: offer.price.toString(), validUntil: offer.validUntil.toString(), version: offer.version.toString() } }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(`${j.error ?? "could not publish"}${j.detail ? `: ${j.detail.join("; ")}` : ""}`);
      await refresh();
    });

  if (!cfg) return <div className="page stack">Loading…</div>;
  const embed = st.handle && typeof window !== "undefined" ? `<a href="${link}"><img src="${window.location.origin}/api/badge/${st.handle}" alt="Protected by PoP"></a>` : "";

  return (
    <div className="page stack">
      <TestModeBanner cfg={cfg} />
      <h1 className="text-xl font-semibold">Become a protected seller</h1>
      <p className="text-sm text-muted">Four steps: prove your Instagram handle, register, sign one product, share your link. Test wallet in this browser: {addr ? `${addr.slice(0, 8)}…${addr.slice(-4)}` : "…"}</p>

      {st.status === "none" && (
        <div className="card stack-sm">
          <h2>1. Your Instagram handle</h2>
          <input className="field" placeholder="@yourshop" aria-label="@yourshop" value={handle} onChange={(e) => setHandle(e.target.value)} />
          <button disabled={busy || !handle.trim()} onClick={requestCode} className="btn btn-primary btn-block">
            Get my bio code
          </button>
        </div>
      )}

      {st.status === "pending" && (
        <div className="card stack-sm">
          <h2>2. Put this code in your Instagram bio</h2>
          <div className="rounded-control bg-surface p-3 text-center font-mono text-xl">{st.bioCode}</div>
          <div className="text-sm text-muted">
            A PoP team member checks @{st.handle}&apos;s bio and approves you. This page updates by itself. (Staff: /arbiter.)
          </div>
        </div>
      )}

      {st.status === "rejected" && <div className="card border-danger text-sm text-danger">The team could not find the code in the bio. Check the handle and ask again.</div>}

      {st.status === "approved" && !registered && (
        <div className="card stack-sm">
          <h2>3. Approved. Register on-chain</h2>
          <div className="text-sm text-muted">@{st.handle} was checked by the team (handle proof: tier 1). One transaction from your test wallet registers you.</div>
          <button disabled={busy || !st.registration} onClick={registerOnChain} className="btn btn-primary btn-block">
            {busy ? "Registering…" : "Register @" + st.handle}
          </button>
        </div>
      )}

      {registered && !st.listing && (
        <div className="card stack-sm">
          <h2>4. Your product (you sign the offer in your wallet)</h2>
          <TxLink cfg={cfg} hash={regTx} label="registration" />
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Product name" aria-label="Product name" />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted">
              Price (₹)
              <input className="field" inputMode="numeric" value={priceInr} onChange={(e) => setPriceInr(e.target.value)} />
            </label>
            <label className="text-xs text-muted">
              Price (test USDT)
              <input className="field" inputMode="decimal" value={priceUsdt} onChange={(e) => setPriceUsdt(e.target.value)} />
            </label>
            <label className="text-xs text-muted">
              Ship within (minutes, demo)
              <input className="field" inputMode="numeric" value={shipMin} onChange={(e) => setShipMin(e.target.value)} />
            </label>
            <label className="text-xs text-muted">
              Deliver within (minutes after shipping)
              <input className="field" inputMode="numeric" value={deliverMin} onChange={(e) => setDeliverMin(e.target.value)} />
            </label>
          </div>
          <button disabled={busy} onClick={publish} className="btn btn-primary btn-block">
            {busy ? "Signing…" : "Sign and publish"}
          </button>
        </div>
      )}

      {st.listing && (
        <div className="card stack-sm border-2 border-accent">
          <h2>You&apos;re live: {st.listing.title}</h2>
          <div className="break-all rounded-control bg-surface p-2 text-sm">
            <a className="underline" href={link}>
              {link}
            </a>
          </div>
          {qr && <img src={qr} alt="QR code for your checkout link" width={200} height={200} className="mx-auto" />}
          <div className="text-xs text-muted">Put this link or QR in your Instagram bio, stories or WhatsApp.</div>
          {st.handle && (
            <>
              <img src={`/api/badge/${st.handle}`} alt="Protected by PoP badge" width={280} height={62} />
              <textarea readOnly className="field mono" rows={3} value={embed} />
              <a className="text-sm underline" href={`/verify/${st.handle}`}>
                See your public record
              </a>
            </>
          )}
        </div>
      )}
      {msg && <div className="text-sm text-danger">{msg}</div>}
    </div>
  );
}
