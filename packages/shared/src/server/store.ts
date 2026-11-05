import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import type { NetworkMode } from "../network";
import { listingIdHash } from "../terms";

/**
 * Private app data. Interim backend: a JSON file per network mode in pop/.data/ (gitignored, dev only),
 * used until DATABASE_URL (Supabase Postgres) is configured. Same shapes as supabase/migrations/0001_init.sql.
 * Never holds raw buyer PII: delivery details are AES-256-GCM encrypted before they get here.
 */
export type SellerRow = { wallet: string; handle: string; handleHash: string; handleTier: number; bioCode?: string; createdAt: string };
export type ListingRow = {
  id: string; // slug used in /p/[id]
  sellerWallet: string;
  sellerHandle: string;
  title: string;
  imageUrl?: string;
  priceUnits: string;
  priceInr: number;
  terms: unknown;
  termsHash: string;
  offer: Record<string, string | number>; // bigint fields as strings
  offerSig: string;
  active: boolean;
  createdAt: string;
};
export type OrderRow = {
  orderId: string;
  sellerWallet: string;
  buyerWallet: string;
  listingId?: string;
  amountUnits: string;
  addressEnc?: string;
  trackingNo?: string;
  courierStatus?: string; // SIMULATED, DB only
  fundTx: string;
  updatedAt: string;
};
/** A review accepted by the server. The Arkiv write is retryable; the nullifier claim is made once, with this row. */
export type ReviewStatus = "pending" | "synced" | "failed";
export type ReviewRow = {
  orderId: string;
  sellerWallet: string;
  sellerHandle: string;
  buyerWallet: string;
  rating: number;
  text: string;
  reviewerKey: string; // public: keccak(nullifier, seller), or "dev-..." when the World proof was skipped (DEV only)
  buyerSig: string; // buyer's signature over (order, seller, rating, text fingerprint)
  payTx?: string;
  devSkippedWorld: boolean;
  arkivKey?: string;
  createTx?: string;
  transferTx?: string;
  status: ReviewStatus;
  error?: string;
  createdAt: string;
  updatedAt: string;
};
type Db = {
  sellers: SellerRow[];
  listings: ListingRow[];
  orders: OrderRow[];
  processedEvents: string[]; // `${chainId}:${txHash}:${logIndex}`
  loginNonces?: { address: string; nonce: string; expiresAt: number }[];
  reviews?: ReviewRow[];
  reviewClaims?: { nullifierHash: string; sellerWallet: string; orderId: string; createdAt: string }[];
  faucetGrants?: { address: string; ipHash: string; gasTx?: string; usdtTx?: string; createdAt: string }[];
};

function repoRoot(): string {
  // Walk up from cwd until we find the workspace root package.json with name "pop".
  let d = process.cwd();
  for (let i = 0; i < 6; i++) {
    const p = resolve(d, "package.json");
    if (existsSync(p) && JSON.parse(readFileSync(p, "utf8")).name === "pop") return d;
    d = dirname(d);
  }
  return process.cwd();
}

export function createFileStore(mode: NetworkMode) {
  const file = resolve(repoRoot(), ".data", `${mode}.json`);
  const load = (): Db =>
    existsSync(file)
      ? JSON.parse(readFileSync(file, "utf8"))
      : { sellers: [], listings: [], orders: [], processedEvents: [] };
  const save = (db: Db) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.tmp`, JSON.stringify(db, null, 2));
    renameSync(`${file}.tmp`, file);
  };
  const lc = (a: string) => a.toLowerCase();

  return {
    kind: "file" as const,
    upsertSeller(s: SellerRow) {
      const db = load();
      db.sellers = db.sellers.filter((x) => lc(x.wallet) !== lc(s.wallet));
      db.sellers.push(s);
      save(db);
    },
    sellerByWallet: (w: string) => load().sellers.find((x) => lc(x.wallet) === lc(w)),
    sellerByHandle: (h: string) => load().sellers.find((x) => x.handle === h.toLowerCase()),
    upsertListing(l: ListingRow) {
      const db = load();
      db.listings = db.listings.filter((x) => x.id !== l.id);
      db.listings.push(l);
      save(db);
    },
    listing: (id: string) => load().listings.find((x) => x.id === id),
    listingsBySeller: (w: string) => load().listings.filter((x) => lc(x.sellerWallet) === lc(w)),
    /** Idempotent: keyed by chain event; returns false if already processed. */
    recordOrder(eventKey: string, o: OrderRow): boolean {
      const db = load();
      if (db.processedEvents.includes(eventKey)) return false;
      db.processedEvents.push(eventKey);
      db.orders = db.orders.filter((x) => x.orderId !== o.orderId);
      db.orders.push(o);
      save(db);
      return true;
    },
    order: (id: string) => load().orders.find((x) => x.orderId === id),
    ordersBySeller: (w: string) => load().orders.filter((x) => lc(x.sellerWallet) === lc(w)),
    allOrders: () => load().orders,
    faucetGrantFor: (a: string) => (load().faucetGrants ?? []).find((g) => lc(g.address) === lc(a)),
    faucetGrantsToday: () => (load().faucetGrants ?? []).filter((g) => Date.now() - Date.parse(g.createdAt) < 86_400_000),
    recordFaucetGrant(g: { address: string; ipHash: string; gasTx?: string; usdtTx?: string }) {
      const db = load();
      db.faucetGrants = [...(db.faucetGrants ?? []), { ...g, createdAt: new Date().toISOString() }];
      save(db);
    },
    /** Remove a grant (used when the faucet transfer failed, so the wallet can try again). */
    removeFaucetGrant(address: string) {
      const db = load();
      db.faucetGrants = (db.faucetGrants ?? []).filter((g) => lc(g.address) !== lc(address));
      save(db);
    },
    /** Listing whose Offer.listingId (on-chain bytes32) equals keccak(slug). */
    listingByIdHash: (hash: string) => load().listings.find((x) => listingIdHash(x.id).toLowerCase() === hash.toLowerCase()),
    /** One-time login nonce, bound to an address, valid 5 minutes. At most 5 pending per address. */
    issueLoginNonce(address: string): string {
      const db = load();
      const now = Date.now();
      const live = (db.loginNonces ?? []).filter((n) => n.expiresAt > now);
      const mine = live.filter((n) => n.address === lc(address));
      const nonce = randomBytes(16).toString("hex");
      db.loginNonces = [...live.filter((n) => !mine.includes(n)), ...mine.slice(-4), { address: lc(address), nonce, expiresAt: now + 5 * 60_000 }];
      save(db);
      return nonce;
    },
    /** Returns true exactly once per issued nonce (the nonce is deleted on use). */
    consumeLoginNonce(address: string, nonce: string): boolean {
      const db = load();
      const now = Date.now();
      const list = db.loginNonces ?? [];
      const hit = list.find((n) => n.nonce === nonce && n.address === lc(address) && n.expiresAt > now);
      db.loginNonces = list.filter((n) => n !== hit && n.expiresAt > now);
      save(db);
      return !!hit;
    },
    /**
     * Atomic (one synchronous read-modify-write, single process) claim of "this human reviews this seller",
     * mirroring UNIQUE(nullifier_hash, seller_wallet), together with the pending review row. One review per order.
     * Returns false (and writes nothing) if the human already reviewed this seller or the order already has a review.
     * A failed Arkiv write is retried against the SAME row, so a retry never needs a second claim.
     */
    claimReview(nullifierHash: string, review: Omit<ReviewRow, "status" | "createdAt" | "updatedAt" | "error">): boolean {
      const db = load();
      const claims = db.reviewClaims ?? [];
      const dup = claims.some(
        (c) => (c.nullifierHash === nullifierHash && c.sellerWallet === lc(review.sellerWallet)) || c.orderId === review.orderId,
      );
      if (dup || (db.reviews ?? []).some((r) => r.orderId === review.orderId)) return false;
      const now = new Date().toISOString();
      db.reviewClaims = [...claims, { nullifierHash, sellerWallet: lc(review.sellerWallet), orderId: review.orderId, createdAt: now }];
      db.reviews = [...(db.reviews ?? []), { ...review, status: "pending", createdAt: now, updatedAt: now }];
      save(db);
      return true;
    },
    review: (orderId: string) => load().reviews?.find((r) => r.orderId === orderId),
    reviewsBySeller: (w: string) => (load().reviews ?? []).filter((r) => lc(r.sellerWallet) === lc(w)),
    patchReview(orderId: string, patch: Partial<ReviewRow>) {
      const db = load();
      const r = db.reviews?.find((x) => x.orderId === orderId);
      if (!r) return;
      Object.assign(r, patch, { updatedAt: new Date().toISOString() });
      save(db);
    },
    patchOrder(id: string, patch: Partial<OrderRow>) {
      const db = load();
      const o = db.orders.find((x) => x.orderId === id);
      if (!o) return;
      Object.assign(o, patch, { updatedAt: new Date().toISOString() });
      save(db);
    },
  };
}
export type Store = ReturnType<typeof createFileStore>;
