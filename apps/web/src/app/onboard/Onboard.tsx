"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { IDKitRequestWidget, proofOfHuman, type IDKitResult, type RpContext } from "@worldcoin/idkit";
import { parseUnits, zeroHash, type Hex } from "viem";
import { checkoutAbi, listingIdHash, offerDomain, offerTypes, registryAbi, termsHash, type Terms } from "@pop/shared";
import { publicClientOf, useConfig } from "@/lib/client/config";
import { getTestAccount, walletOf } from "@/lib/client/wallet";
import { onboardRequestMessage } from "@/lib/messages";
import { vendorSignal } from "@/lib/vendor-rules";
import { DEMO_NOTE, ONE_PERSON_NOTE, vendorRefusal, vendorWidgetRefusal } from "@/lib/client/vendor-errors";
import type { Refusal } from "@/lib/client/review-errors";
import { Notice } from "@/components/ui";
import { TestModeBanner, TxLink } from "@/components/Banners";

type Status = {
  status: "none" | "pending" | "approved" | "rejected";
  handle?: string;
  bioCode?: string;
  registration?: { seller: Hex; handleHash: Hex; handleTier: number; nonce: string; deadline: number; signature: Hex };
  listing?: { id: string; title: string };
};
type WorldCfg = { app_id: `app_${string}`; action: string; environment: "staging" | "production"; rp_context: RpContext };

const errText = (e: unknown) => (e instanceof Error ? e.message.split("\n")[0] : "Something went wrong");
const HANDLE_FORMAT = /^[a-z0-9._]{1,30}$/;
const cleanHandle = (s: string) => s.trim().toLowerCase().replace(/^@/, "");
/** The address shown in the vendor's payment link, QR and badge snippet: the public site URL when NEXT_PUBLIC_BASE_URL is set, otherwise the page's own origin. */
const publicOrigin = () => process.env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/$/, "") || window.location.origin;
/** Demo exchange rate used only to show buyers a rupee price next to the test USDT price. */
const DEMO_INR_PER_USDT = 90;

/**
 * Vendor onboarding. Steps: (1) Instagram handle, (2) World ID check, so one person can open one shop, (3) bio code and
 * "I added it to my bio", (4) payment link, QR and badge.
 * With staff approval (the default) a team member checks the bio at /arbiter, then the vendor registers and signs a product.
 * With the demo flag (ONBOARD_DEMO_AUTOAPPROVE=yes, testnet only) the staff check is skipped and step 3 does everything in one click.
 */
export default function Onboard() {
  const { cfg } = useConfig();
  const auto = Boolean(cfg?.onboardAutoApprove);
  const [addr, setAddr] = useState<Hex | "">("");
  const [st, setSt] = useState<Status>({ status: "none" });
  const [registered, setRegistered] = useState(false);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const serverRefused = useRef(false);
  const [world, setWorld] = useState<WorldCfg | null>(null);
  const [open, setOpen] = useState(false);
  const [regTx, setRegTx] = useState("");
  const [copied, setCopied] = useState(false);
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

  const link = st.listing && typeof window !== "undefined" ? `${publicOrigin()}/p/${st.listing.id}` : "";
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

  const handleOk = HANDLE_FORMAT.test(cleanHandle(handle));
  const handleBad = handle.trim() !== "" && !handleOk;
  const usdtNum = Number(priceUsdt);
  const priceOk = Number.isFinite(usdtNum) && usdtNum > 0 && usdtNum <= 1000 && /^\d+(\.\d{1,6})?$/.test(priceUsdt.trim());
  const canStart = handleOk && title.trim().length >= 2 && (!auto || priceOk);

  // ---- step 2: World ID check (one unique person, one shop). The handle is part of the signal.
  async function startWorld() {
    setMsg("");
    setRefusal(null);
    serverRefused.current = false;
    if (!canStart) return;
    setBusy(true);
    try {
      const res = await fetch("/api/world/rp-signature", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vendor: true }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRefusal(vendorRefusal(res.status, j.error ?? "World is not configured"));
        return;
      }
      setWorld(j);
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  /** Posts the handle and the proof. A refusal is kept on the page: the widget only says "Verification declined". */
  async function requestWithProof(proof?: IDKitResult) {
    if (!cfg) return;
    const acct = getTestAccount(cfg, "seller")!;
    const h = cleanHandle(handle);
    const signature = await acct.signMessage({ message: onboardRequestMessage(h, acct.address) });
    const r = await fetch("/api/onboard/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handle: h, wallet: acct.address, signature, ...(proof ? { idkitResult: proof } : { skipWorld: true }) }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      serverRefused.current = true;
      setRefusal(vendorRefusal(r.status, j.error));
      throw new Error(j.error ?? "request failed");
    }
    setRefusal(null);
    await refresh();
  }

  const devSkip = () =>
    run(async () => {
      serverRefused.current = false;
      setRefusal(null);
      try {
        await requestWithProof();
      } catch {
        /* the reason is already on the page */
      }
    });

  // ---- staff mode (unchanged behaviour): register from the vendor's own wallet after staff approval
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

  /** The vendor signs the product offer in their own wallet; PoP validates it and stores the listing. */
  async function publishFor(h: string) {
    if (!cfg) return;
    const acct = getTestAccount(cfg, "seller")!;
    const w = walletOf(cfg, acct);
    const slug = `${h.replace(/[._]/g, "-")}-${Math.random().toString(16).slice(2, 6)}`;
    const terms: Terms = {
      title: title.trim(),
      priceInr: auto ? Math.max(1, Math.round(usdtNum * DEMO_INR_PER_USDT)) : Math.round(Number(priceInr)),
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
  }

  const publish = () =>
    run(async () => {
      if (!st.handle) return;
      await publishFor(st.handle);
      await refresh();
    });

  // ---- demo mode: "I added it to my bio" does approve, register and publish with no more clicks
  const finishDemo = () =>
    run(async () => {
      if (!cfg || !st.handle) return;
      const acct = getTestAccount(cfg, "seller")!;
      const signature = await acct.signMessage({ message: onboardRequestMessage(st.handle, acct.address) });
      const r = await fetch("/api/onboard/auto", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: acct.address, signature }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "registration failed");
      if (j.tx) setRegTx(j.tx);
      await publishFor(st.handle);
      await refresh();
    });

  async function copyAddr() {
    if (!addr) return;
    await navigator.clipboard.writeText(addr).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!cfg) return <div className="page stack">Loading…</div>;
  const embed = st.handle && typeof window !== "undefined" ? `<a href="${link}"><img src="${publicOrigin()}/api/badge/${st.handle}" alt="Protected by PoP"></a>` : "";
  const payout = (
    <div className="rounded-control bg-surface p-3 text-sm stack-sm">
      <div className="font-semibold">Payout wallet</div>
      <div className="break-all font-mono text-xs">{addr || "…"}</div>
      <div className="text-muted">
        Created in this browser. Payments for your shop are credited to this wallet, and its key stays in this browser only, so use this browser to withdraw.
      </div>
      <button type="button" className="btn btn-secondary" onClick={copyAddr}>
        {copied ? "Copied" : "Copy address"}
      </button>
    </div>
  );
  const refusalNotice = refusal && (
    <Notice tone={refusal.tone} title={refusal.title}>
      <span className="block">{refusal.body}</span>
      <span className="block">{refusal.next}</span>
    </Notice>
  );

  return (
    <div className="page stack">
      <TestModeBanner cfg={cfg} />
      <h1 className="text-xl font-semibold">Open your protected shop</h1>
      <p className="text-sm text-muted">
        {auto
          ? "Four steps: your Instagram handle, a World ID check, your bio code, then your payment link and QR."
          : "Steps: your Instagram handle, a World ID check, a bio code that the team checks, registration, one signed product, then your payment link."}
      </p>
      {auto && <Notice tone="warn" title="Demo mode">{DEMO_NOTE}</Notice>}

      {st.status === "none" && (
        <div className="card stack-sm">
          <h2>1. Your Instagram handle</h2>
          <input
            className="field"
            placeholder="@yourshop"
            aria-label="Instagram handle"
            aria-invalid={handleBad}
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
          {handleBad && <p className="hint text-danger">Use 1 to 30 letters, numbers, dots or underscores. The @ is optional.</p>}
          <h2 className="text-base">Your first product</h2>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Product name" aria-label="Product name" />
          {auto ? (
            <label className="text-xs text-muted">
              Price (test USDT)
              <input className="field" inputMode="decimal" value={priceUsdt} onChange={(e) => setPriceUsdt(e.target.value)} aria-invalid={!priceOk} />
              {!priceOk && <span className="hint text-danger">Enter a price such as 1.00.</span>}
              {priceOk && <span className="hint">Buyers also see about ₹{Math.max(1, Math.round(usdtNum * DEMO_INR_PER_USDT))} (demo rate: ₹{DEMO_INR_PER_USDT} per test USDT).</span>}
            </label>
          ) : (
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
          )}
          <h2 className="text-base">2. World ID check</h2>
          <p className="text-sm">{ONE_PERSON_NOTE} One person can open one shop.</p>
          <button disabled={busy || !canStart} onClick={startWorld} className="btn btn-primary btn-block">
            {busy ? "Working…" : "Verify with World ID"}
          </button>
          {cfg.devSkipWorld && (
            <button disabled={busy || !canStart} onClick={devSkip} className="btn btn-danger btn-block">
              Developer only: skip World ID (local dev server)
            </button>
          )}
          {refusalNotice}
        </div>
      )}

      {st.status === "pending" && (
        <div className="card stack-sm">
          <h2>3. Put this code in your Instagram bio</h2>
          <div className="rounded-control bg-surface p-3 text-center font-mono text-xl">{st.bioCode}</div>
          {auto ? (
            <>
              <div className="text-sm text-muted">{DEMO_NOTE} Nobody looks at @{st.handle}&apos;s bio in this mode, and your shop is registered as &quot;handle not checked&quot;.</div>
              <button disabled={busy} onClick={finishDemo} className="btn btn-primary btn-block">
                {busy ? "Setting up your shop, about 15 seconds" : "I added it to my bio"}
              </button>
            </>
          ) : (
            <div className="text-sm text-muted">
              A PoP team member checks @{st.handle}&apos;s bio and approves you. This page updates by itself. (Staff: /arbiter.)
            </div>
          )}
          {payout}
        </div>
      )}

      {st.status === "rejected" && <div className="card border-danger text-sm text-danger">The team could not find the code in the bio. Check the handle and ask again.</div>}

      {!auto && st.status === "approved" && !registered && (
        <div className="card stack-sm">
          <h2>4. Approved. Register on-chain</h2>
          <div className="text-sm text-muted">@{st.handle} was checked by the team (handle proof: tier 1). One transaction from your test wallet registers you.</div>
          <button disabled={busy || !st.registration} onClick={registerOnChain} className="btn btn-primary btn-block">
            {busy ? "Registering…" : "Register @" + st.handle}
          </button>
        </div>
      )}

      {registered && !st.listing && (
        <div className="card stack-sm">
          {auto ? (
            <>
              <h2>Almost there</h2>
              <div className="text-sm text-muted">Your shop is registered. Publishing your product did not finish.</div>
              <button disabled={busy} onClick={publish} className="btn btn-primary btn-block">
                {busy ? "Publishing…" : "Publish my product"}
              </button>
            </>
          ) : (
            <>
              <h2>5. Sign and publish your product (you sign the offer in your wallet)</h2>
              <TxLink cfg={cfg} hash={regTx} label="registration" />
              <div className="text-sm text-muted">
                {title.trim()} · ₹{priceInr} · {priceUsdt} test USDT
              </div>
              <button disabled={busy} onClick={publish} className="btn btn-primary btn-block">
                {busy ? "Signing…" : "Sign and publish"}
              </button>
            </>
          )}
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
          {qr && <img src={qr} alt="QR code for your payment link" width={200} height={200} className="mx-auto" />}
          <div className="text-xs text-muted">Put this link or QR in your Instagram bio, stories or WhatsApp.</div>
          <a className="btn btn-secondary btn-block" href="/dashboard">
            Manage your orders
          </a>
          <div className="text-xs text-muted">Open it in this same browser: your payout wallet and its key live here, and shipping an order is signed with that key.</div>
          {regTx && <TxLink cfg={cfg} hash={regTx} label="registration" />}
          {auto && <div className="text-xs text-muted">{DEMO_NOTE} PoP&apos;s test faucet wallet paid the network fee for your registration.</div>}
          {payout}
          {st.handle && (
            <>
              <img src={`/api/badge/${st.handle}`} alt="Protected by PoP badge" width={280} height={62} />
              <label className="text-xs text-muted" htmlFor="embed">
                Badge for your website
              </label>
              <textarea id="embed" readOnly className="field mono" rows={3} value={embed} />
              <a className="text-sm underline" href={`/verify/${st.handle}`}>
                See your public record
              </a>
            </>
          )}
        </div>
      )}
      {msg && <div className="text-sm text-danger">{msg}</div>}

      {world && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={world.app_id}
          action={world.action}
          rp_context={world.rp_context}
          allow_legacy_proofs={true}
          preset={proofOfHuman({ signal: vendorSignal(cleanHandle(handle)) })}
          environment={world.environment}
          handleVerify={async (result: IDKitResult) => {
            await requestWithProof(result);
          }}
          onSuccess={() => setRefusal(null)}
          onError={(code) => {
            // If our server already gave the reason, never replace it with the widget's generic code.
            if (!serverRefused.current) setRefusal(vendorWidgetRefusal(String(code)));
          }}
        />
      )}
    </div>
  );
}
