/**
 * Pay with PoP, server half. Holds the merchant's seller key (offers are signed HERE, PoP never sees the key),
 * creates checkout sessions with the merchant API key, verifies HMAC-signed webhooks, and rechecks each event on-chain
 * so a webhook alone is never trusted.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createPublicClient, decodeEventLog, http, keccak256, parseUnits, toHex, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { checkoutAbi, listingIdHash, offerDomain, offerTypes, termsHash, type Terms } from "@pop/shared";

export type PoPConfig = {
  baseUrl: string; // the PoP web app, e.g. https://pop.example
  apiKey: string; // merchant API key (Bearer)
  webhookSecret: string;
  merchantPk: Hex; // the registered seller wallet's key; signs Offers locally
  /** Pin these in production so the on-chain recheck does not rely on PoP for the contract address. */
  chain?: { id: number; rpcUrl: string; checkout: Address };
};
export const WEBHOOK_EVENTS = ["order.funded", "order.shipped", "order.delivered", "order.released", "order.refunded"] as const;
export type WebhookType = (typeof WEBHOOK_EVENTS)[number];
export type WebhookEvent = {
  id: string;
  type: WebhookType;
  created: number;
  data: {
    orderId: string;
    sessionId: string | null;
    merchantRef: string | null;
    buyer: Address;
    seller: Address;
    amount: string;
    chainId: number;
    checkout: Address;
    txHash: Hex; // the FUNDING tx (rechecked on-chain)
    eventTx?: Hex; // the tx that caused this event
  };
};
export type SessionInput = {
  title: string;
  priceInr: number;
  priceUsdt: string; // test USDT as a decimal string, e.g. "1.50"
  merchantRef: string; // your own cart/order id; comes back in every webhook
  imageUrl?: string;
  returnUrl?: string;
  shipWithinSec?: number;
  deliverWithinSec?: number;
  returnPolicy?: string;
};
const STATES = ["None", "Funded", "Shipped", "Delivered", "Disputed", "Released", "Refunded", "Split"] as const;

export class PoP {
  readonly account;
  private cfg?: { chainId: number; rpcUrl: string; checkout: Address; tokenDecimals: number };
  constructor(private c: PoPConfig) {
    this.account = privateKeyToAccount(c.merchantPk);
  }

  private async fetchCfg() {
    const j = await (await fetch(`${this.c.baseUrl}/api/config`, { cache: "no-store" })).json();
    return (this.cfg = { chainId: j.chainId, rpcUrl: j.rpcUrl, checkout: j.checkout, tokenDecimals: j.tokenDecimals });
  }
  private async chain() {
    const remote = this.cfg ?? (await this.fetchCfg());
    const p = this.c.chain;
    return p ? { chainId: p.id, rpcUrl: p.rpcUrl, checkout: p.checkout, tokenDecimals: remote.tokenDecimals } : remote;
  }

  /** Signs an Offer with the merchant key and registers a single-use checkout session. Returns the hosted checkout URL. */
  async createSession(i: SessionInput): Promise<{ sessionId: string; url: string; expiresAt: number }> {
    const ch = await this.chain();
    const sessionId = `s_${randomBytes(8).toString("hex")}`;
    const terms: Terms = {
      title: i.title,
      imageUrl: i.imageUrl,
      priceInr: i.priceInr,
      shipWithinSec: i.shipWithinSec ?? 180,
      deliverWithinSec: i.deliverWithinSec ?? 300,
      returnPolicy: i.returnPolicy ?? "Report a problem within the window after delivery; the arbiter decides refund, release or split.",
    };
    const pc = createPublicClient({ transport: http(ch.rpcUrl) });
    const minV = await pc.readContract({ address: ch.checkout, abi: checkoutAbi, functionName: "minOfferVersion", args: [this.account.address] });
    const offer = {
      seller: this.account.address,
      listingId: listingIdHash(sessionId),
      termsHash: termsHash(terms),
      externalRef: keccak256(toHex(i.merchantRef)),
      price: parseUnits(i.priceUsdt, ch.tokenDecimals),
      shipWithin: terms.shipWithinSec,
      deliverWithin: terms.deliverWithinSec,
      maxUnits: 1,
      validUntil: BigInt(Math.floor(Date.now() / 1000) + 24 * 3600),
      version: minV > 1n ? minV : 1n,
    };
    const offerSig = await this.account.signTypedData({
      domain: offerDomain(ch.chainId, ch.checkout),
      types: offerTypes,
      primaryType: "Offer",
      message: offer,
    });
    const r = await fetch(`${this.c.baseUrl}/api/v1/checkout-sessions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.c.apiKey}` },
      body: JSON.stringify({
        sessionId,
        merchantRef: i.merchantRef,
        returnUrl: i.returnUrl,
        terms,
        offerSig,
        offer: { ...offer, price: offer.price.toString(), validUntil: offer.validUntil.toString(), version: offer.version.toString() },
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`PoP createSession ${r.status}: ${j.error ?? "failed"}`);
    return j;
  }

  /** Verifies `PoP-Signature: t=<unix>,v1=<hmac-sha256 hex of "t.rawBody">`. Pass the RAW request body string. Throws on any problem. */
  verifyWebhook(rawBody: string, header: string | null, toleranceSec = 300): WebhookEvent {
    const parts = Object.fromEntries((header ?? "").split(",").map((p) => p.trim().split("=") as [string, string]));
    const t = Number(parts.t);
    if (!parts.v1 || !Number.isFinite(t)) throw new Error("missing signature");
    if (Math.abs(Date.now() / 1000 - t) > toleranceSec) throw new Error("signature timestamp outside tolerance");
    const want = createHmac("sha256", this.c.webhookSecret).update(`${t}.${rawBody}`).digest();
    const got = Buffer.from(parts.v1, "hex");
    if (got.length !== want.length || !timingSafeEqual(got, want)) throw new Error("bad signature");
    const ev = JSON.parse(rawBody) as WebhookEvent;
    if (!WEBHOOK_EVENTS.includes(ev.type)) throw new Error(`unknown event ${ev.type}`);
    return ev;
  }

  /**
   * Never act on a webhook alone. Reads the order from the contract and checks that it is OURS, matches the event, is in a
   * state that fits the event type, and was paid in a successful OrderFunded carrying keccak(merchantRef). Throws otherwise.
   */
  async confirmOnChain(ev: WebhookEvent): Promise<{ state: string; amount: bigint }> {
    const ch = await this.chain();
    const d = ev.data;
    if (d.chainId !== ch.chainId || d.checkout.toLowerCase() !== ch.checkout.toLowerCase()) throw new Error("event is for a different chain or contract");
    const pc = createPublicClient({ transport: http(ch.rpcUrl) });
    const o = await pc.readContract({ address: ch.checkout, abi: checkoutAbi, functionName: "getOrder", args: [BigInt(d.orderId)] });
    if (o.seller.toLowerCase() !== this.account.address.toLowerCase()) throw new Error("order is not ours");
    if (o.buyer.toLowerCase() !== d.buyer.toLowerCase() || o.amount !== BigInt(d.amount)) throw new Error("buyer or amount mismatch");
    const state = STATES[o.state];
    const fits =
      ev.type === "order.funded" ? state !== "None"
      : ev.type === "order.shipped" ? o.shippedAt > 0n
      : ev.type === "order.delivered" ? o.deliveredAt > 0n
      : ev.type === "order.released" ? state === "Released"
      : state === "Refunded";
    if (!fits) throw new Error(`on-chain state ${state} does not fit ${ev.type}`);
    // Bind the order to OUR cart: the funding tx must be a successful OrderFunded from this contract with externalRef = keccak(merchantRef).
    if (!d.merchantRef) throw new Error("event has no merchantRef");
    const rc = await pc.getTransactionReceipt({ hash: d.txHash });
    if (rc.status !== "success") throw new Error("funding tx failed");
    const want = keccak256(toHex(d.merchantRef)).toLowerCase();
    const ok = rc.logs.some((l) => {
      if (l.address.toLowerCase() !== ch.checkout.toLowerCase()) return false;
      try {
        const e = decodeEventLog({ abi: checkoutAbi, data: l.data, topics: l.topics });
        return e.eventName === "OrderFunded" && e.args.orderId.toString() === d.orderId && e.args.externalRef.toLowerCase() === want;
      } catch {
        return false;
      }
    });
    if (!ok) throw new Error("funding tx does not carry this merchantRef for this order");
    return { state, amount: o.amount };
  }
}
