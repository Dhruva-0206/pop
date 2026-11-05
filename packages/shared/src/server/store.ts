import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { NetworkMode } from "../network";

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
type Db = {
  sellers: SellerRow[];
  listings: ListingRow[];
  orders: OrderRow[];
  processedEvents: string[]; // `${chainId}:${txHash}:${logIndex}`
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
