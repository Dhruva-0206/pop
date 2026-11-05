import { randomBytes } from "node:crypto";
import pg from "pg";
import { getAddress } from "viem";
import type { NetworkMode } from "../network";
import { listingIdHash } from "../terms";

/**
 * Private app data in Supabase Postgres (schema: supabase/migrations/0001_init.sql). SERVER / SCRIPTS ONLY.
 * Same method names and row shapes as the earlier JSON-file store, but every method is async.
 * There is NO file fallback: without DATABASE_URL every call throws a clear error (nothing runs on a JSON store).
 *
 * One Postgres SCHEMA per network mode so a local fork never mixes with real data:
 *   testnet -> "public", fork -> "pop_fork". Table names are schema-qualified in every query (the Supabase pooler runs in
 *   transaction mode, so session settings such as search_path would not stick).
 *
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
  buyerHistory: number; // bucket lower bound: 1, 2 (2-5 orders) or 6 (6+ orders)
  arkivKey?: string;
  createTx?: string;
  transferTx?: string;
  status: ReviewStatus;
  error?: string;
  createdAt: string;
  updatedAt: string;
};
export type FaucetGrant = { address: string; ipHash: string; gasTx?: string; usdtTx?: string; createdAt: string };

/** Postgres schema for a network mode. */
export const schemaFor = (mode: NetworkMode) => (mode === "fork" ? "pop_fork" : "public");

/** 1 order -> 1, 2 to 5 -> 2, 6 or more -> 6 (the bucket's lower bound; also what is written to Arkiv `buyer_history`). */
export const historyBucket = (orders: number): number => (orders >= 6 ? 6 : orders >= 2 ? 2 : 1);

export const DB_MISSING_MESSAGE =
  "DATABASE_URL is not set. PoP stores private data in Supabase Postgres only (there is no file fallback). " +
  "Set DATABASE_URL in pop/.env (local) or in the Vercel project env, then run `npm run db:migrate`.";

type Q = { query: (text: string, params?: unknown[]) => Promise<pg.QueryResult> };

const g = globalThis as unknown as { __popPgPool?: pg.Pool };

/** Lazy, shared pool: building the app never needs the database, the first query does. */
function pool(): pg.Pool {
  if (g.__popPgPool) return g.__popPgPool;
  const url = process.env.DATABASE_URL?.split("#")[0]?.trim();
  if (!url) throw new Error(DB_MISSING_MESSAGE);
  g.__popPgPool = new pg.Pool({
    connectionString: url,
    // Supabase's pooler certificate is not in Node's default trust store. Encrypted, but the server is not verified.
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
  });
  g.__popPgPool.on("error", () => {}); // idle-client errors must not crash the server
  return g.__popPgPool;
}

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : String(d));
const ck = (a: string) => getAddress(a);
const opt = <T>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v);

export function createStore(mode: NetworkMode) {
  const S = `"${schemaFor(mode)}"`;
  const T = (name: string) => `${S}."${name}"`;

  /** Run a query; turn "table does not exist" into an actionable message. */
  async function q(client: Q, text: string, params: unknown[] = []) {
    try {
      return await client.query(text, params);
    } catch (e) {
      if ((e as { code?: string }).code === "42P01" || (e as { code?: string }).code === "3F000") {
        throw new Error(`Database schema "${schemaFor(mode)}" is not set up. Run: npm run db:migrate`);
      }
      throw e;
    }
  }
  const one = (text: string, params?: unknown[]) => q(pool(), text, params);

  async function tx<R>(fn: (c: Q) => Promise<R>): Promise<R> {
    const c = await pool().connect();
    try {
      await q(c, "begin");
      const r = await fn(c);
      await q(c, "commit");
      return r;
    } catch (e) {
      await c.query("rollback").catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  }

  const sellerOf = (r: pg.QueryResultRow): SellerRow => ({
    wallet: ck(r.wallet),
    handle: r.handle,
    handleHash: r.handle_hash,
    handleTier: Number(r.handle_tier),
    bioCode: opt(r.bio_code),
    createdAt: iso(r.created_at),
  });
  const LISTING_SELECT = `select l.*, s.wallet as seller_wallet, s.handle as seller_handle
    from ${T("listings")} l join ${T("sellers")} s on s.id = l.seller_id`;
  const listingOf = (r: pg.QueryResultRow): ListingRow => ({
    id: r.id,
    sellerWallet: ck(r.seller_wallet),
    sellerHandle: r.seller_handle,
    title: r.title,
    imageUrl: opt(r.image_url),
    priceUnits: String(r.price_units),
    priceInr: Number(r.price_inr),
    terms: r.terms_json,
    termsHash: r.terms_hash,
    offer: r.offer_json,
    offerSig: r.offer_sig,
    active: r.active,
    createdAt: iso(r.created_at),
  });
  const orderOf = (r: pg.QueryResultRow): OrderRow => ({
    orderId: String(r.order_id),
    sellerWallet: ck(r.seller_wallet),
    buyerWallet: ck(r.buyer_wallet),
    listingId: opt(r.listing_id),
    amountUnits: String(r.amount_units),
    addressEnc: opt(r.address_enc),
    trackingNo: opt(r.tracking_no),
    courierStatus: opt(r.courier_status),
    fundTx: r.fund_tx ?? "",
    updatedAt: iso(r.updated_at),
  });
  const reviewOf = (r: pg.QueryResultRow): ReviewRow => ({
    orderId: String(r.order_id),
    sellerWallet: ck(r.seller_wallet),
    sellerHandle: r.seller_handle ?? "",
    buyerWallet: ck(r.buyer_wallet),
    rating: Number(r.rating),
    text: r.text ?? "",
    reviewerKey: r.reviewer_key ?? "",
    buyerSig: r.buyer_sig ?? "",
    payTx: opt(r.pay_tx),
    devSkippedWorld: !!r.dev_skipped_world,
    buyerHistory: Number(r.buyer_history),
    arkivKey: opt(r.arkiv_key),
    createTx: opt(r.create_tx),
    transferTx: opt(r.transfer_tx),
    status: r.status,
    error: opt(r.error),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  });
  const grantOf = (r: pg.QueryResultRow): FaucetGrant => ({
    address: ck(r.address),
    ipHash: r.ip_hash ?? "",
    gasTx: opt(r.gas_tx),
    usdtTx: opt(r.usdt_tx),
    createdAt: iso(r.created_at),
  });

  /** Build `col = $n, ...` for the keys PRESENT in `patch` (an explicit undefined clears the column). */
  function setClause(patch: Record<string, unknown>, cols: Record<string, string>, startAt: number) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, col] of Object.entries(cols)) {
      if (!(key in patch)) continue;
      vals.push(patch[key] === undefined ? null : patch[key]);
      sets.push(`${col} = $${startAt + vals.length - 1}`);
    }
    return { sets, vals };
  }

  return {
    kind: "postgres" as const,
    schema: schemaFor(mode),

    // ------------------------------------------------------------ sellers + listings
    async upsertSeller(s: SellerRow) {
      await one(
        `insert into ${T("sellers")} (wallet, handle, handle_hash, handle_tier, bio_code, created_at)
         values (lower($1), lower($2), $3, $4, $5, $6)
         on conflict (wallet) do update set handle = excluded.handle, handle_hash = excluded.handle_hash,
           handle_tier = excluded.handle_tier, bio_code = excluded.bio_code`,
        [s.wallet, s.handle, s.handleHash, s.handleTier, s.bioCode ?? null, s.createdAt],
      );
    },
    async sellerByWallet(w: string) {
      const r = await one(`select * from ${T("sellers")} where wallet = lower($1)`, [w]);
      return r.rows[0] ? sellerOf(r.rows[0]) : undefined;
    },
    async sellerByHandle(h: string) {
      const r = await one(`select * from ${T("sellers")} where handle = lower($1)`, [h]);
      return r.rows[0] ? sellerOf(r.rows[0]) : undefined;
    },
    async upsertListing(l: ListingRow) {
      const s = await one(`select id from ${T("sellers")} where wallet = lower($1)`, [l.sellerWallet]);
      if (!s.rows[0]) throw new Error(`upsertListing: seller ${l.sellerWallet} is not in the database`);
      await one(
        `insert into ${T("listings")} (id, seller_id, title, image_url, price_units, price_inr, terms_json, terms_hash,
           offer_json, offer_sig, listing_id_hash, active, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         on conflict (id) do update set seller_id = excluded.seller_id, title = excluded.title, image_url = excluded.image_url,
           price_units = excluded.price_units, price_inr = excluded.price_inr, terms_json = excluded.terms_json,
           terms_hash = excluded.terms_hash, offer_json = excluded.offer_json, offer_sig = excluded.offer_sig,
           listing_id_hash = excluded.listing_id_hash, active = excluded.active`,
        [
          l.id,
          s.rows[0].id,
          l.title,
          l.imageUrl ?? null,
          l.priceUnits,
          l.priceInr,
          JSON.stringify(l.terms),
          l.termsHash,
          JSON.stringify(l.offer),
          l.offerSig,
          listingIdHash(l.id).toLowerCase(),
          l.active,
          l.createdAt,
        ],
      );
    },
    async listing(id: string) {
      const r = await one(`${LISTING_SELECT} where l.id = $1`, [id]);
      return r.rows[0] ? listingOf(r.rows[0]) : undefined;
    },
    async listingsBySeller(w: string) {
      const r = await one(`${LISTING_SELECT} where s.wallet = lower($1) order by l.created_at`, [w]);
      return r.rows.map(listingOf);
    },
    /** Listing whose Offer.listingId (on-chain bytes32) equals keccak(slug). */
    async listingByIdHash(hash: string) {
      const r = await one(`${LISTING_SELECT} where l.listing_id_hash = lower($1)`, [hash]);
      return r.rows[0] ? listingOf(r.rows[0]) : undefined;
    },

    // ------------------------------------------------------------ orders
    /** Idempotent: keyed by chain event `chainId:txHash:logIndex` (table processed_events); returns false if already processed. */
    async recordOrder(eventKey: string, o: OrderRow): Promise<boolean> {
      const [chainId, txHash, logIndex] = eventKey.split(":");
      return tx(async (c) => {
        const ev = await q(
          c,
          `insert into ${T("processed_events")} (chain_id, tx_hash, log_index) values ($1,$2,$3) on conflict do nothing`,
          [Number(chainId), txHash.toLowerCase(), Number(logIndex)],
        );
        if (ev.rowCount === 0) return false;
        await q(
          c,
          `insert into ${T("orders")} (order_id, seller_wallet, buyer_wallet, listing_id, amount_units, address_enc, fund_tx, updated_at)
           values ($1::numeric, lower($2), lower($3), $4, $5::numeric, $6, $7, now())
           on conflict (order_id) do update set seller_wallet = excluded.seller_wallet, buyer_wallet = excluded.buyer_wallet,
             listing_id = excluded.listing_id, amount_units = excluded.amount_units, address_enc = excluded.address_enc,
             fund_tx = excluded.fund_tx, updated_at = now()`,
          [o.orderId, o.sellerWallet, o.buyerWallet, o.listingId ?? null, o.amountUnits, o.addressEnc ?? null, o.fundTx],
        );
        return true;
      });
    },
    async order(id: string) {
      const r = await one(`select * from ${T("orders")} where order_id = $1::numeric`, [id]);
      return r.rows[0] ? orderOf(r.rows[0]) : undefined;
    },
    async ordersBySeller(w: string) {
      const r = await one(`select * from ${T("orders")} where seller_wallet = lower($1) order by order_id`, [w]);
      return r.rows.map(orderOf);
    },
    async allOrders() {
      const r = await one(`select * from ${T("orders")} order by order_id`);
      return r.rows.map(orderOf);
    },
    /** How many protected orders this buyer wallet has in the orders table (includes the order being reviewed). */
    async buyerOrderCount(buyer: string) {
      const r = await one(`select count(*)::int as n from ${T("orders")} where buyer_wallet = lower($1)`, [buyer]);
      return Number(r.rows[0].n);
    },
    async patchOrder(id: string, patch: Partial<Pick<OrderRow, "trackingNo" | "courierStatus" | "addressEnc">>) {
      const { sets, vals } = setClause(patch, { trackingNo: "tracking_no", courierStatus: "courier_status", addressEnc: "address_enc" }, 2);
      await one(`update ${T("orders")} set ${[...sets, "updated_at = now()"].join(", ")} where order_id = $1::numeric`, [id, ...vals]);
    },

    // ------------------------------------------------------------ faucet
    async faucetGrantFor(a: string) {
      const r = await one(`select * from ${T("faucet_grants")} where address = lower($1)`, [a]);
      return r.rows[0] ? grantOf(r.rows[0]) : undefined;
    },
    async faucetGrantsToday() {
      const r = await one(`select * from ${T("faucet_grants")} where created_at > now() - interval '24 hours'`);
      return r.rows.map(grantOf);
    },
    /** Atomic: true if this call recorded the grant, false if the wallet already had one (no double grant under concurrency). */
    async recordFaucetGrant(g: { address: string; ipHash: string; gasTx?: string; usdtTx?: string }) {
      const r = await one(
        `insert into ${T("faucet_grants")} (address, ip_hash, gas_tx, usdt_tx) values (lower($1), $2, $3, $4)
         on conflict (address) do nothing`,
        [g.address, g.ipHash, g.gasTx ?? null, g.usdtTx ?? null],
      );
      return r.rowCount === 1;
    },
    /** Remove a grant (used when the faucet transfer failed, so the wallet can try again). */
    async removeFaucetGrant(address: string) {
      await one(`delete from ${T("faucet_grants")} where address = lower($1)`, [address]);
    },

    // ------------------------------------------------------------ seller login nonces
    /** One-time login nonce, bound to an address, valid 5 minutes. At most 5 pending per address. */
    async issueLoginNonce(address: string): Promise<string> {
      const nonce = randomBytes(16).toString("hex");
      await tx(async (c) => {
        await q(c, `delete from ${T("login_nonces")} where expires_at < now()`);
        await q(
          c,
          `delete from ${T("login_nonces")} where address = lower($1) and nonce not in
             (select nonce from ${T("login_nonces")} where address = lower($1) order by created_at desc limit 4)`,
          [address],
        );
        await q(c, `insert into ${T("login_nonces")} (nonce, address, expires_at) values ($1, lower($2), now() + interval '5 minutes')`, [nonce, address]);
      });
      return nonce;
    },
    /** True exactly once per issued nonce: the DELETE is the atomic check. */
    async consumeLoginNonce(address: string, nonce: string): Promise<boolean> {
      const r = await one(
        `delete from ${T("login_nonces")} where nonce = $1 and address = lower($2) and expires_at > now() returning nonce`,
        [nonce, address],
      );
      return r.rowCount === 1;
    },

    // ------------------------------------------------------------ reviews
    /**
     * Atomic claim of "this human reviews this seller" TOGETHER with the pending review row, in one transaction:
     * the INSERT into review_nullifiers hits UNIQUE(nullifier_hash, seller_wallet); the INSERT into reviews hits the
     * unique order_id (one review per order). Either conflict rolls back everything and returns false.
     * A failed Arkiv write is retried against the SAME row, so a retry never needs a second claim.
     */
    async claimReview(
      nullifierHash: string,
      r: Omit<ReviewRow, "status" | "createdAt" | "updatedAt" | "error">,
    ): Promise<boolean> {
      return tx(async (c) => {
        const n = await q(
          c,
          `insert into ${T("review_nullifiers")} (nullifier_hash, seller_wallet, order_id) values ($1, lower($2), $3::numeric)
           on conflict on constraint review_nullifiers_human_seller_uq do nothing`,
          [nullifierHash, r.sellerWallet, r.orderId],
        );
        if (n.rowCount === 0) throw new Rollback();
        const ins = await q(
          c,
          `insert into ${T("reviews")} (order_id, seller_wallet, seller_handle, buyer_wallet, rating, text, reviewer_key, buyer_sig,
             pay_tx, dev_skipped_world, buyer_history, status)
           values ($1::numeric, lower($2), $3, lower($4), $5, $6, $7, $8, $9, $10, $11, 'pending')
           on conflict (order_id) do nothing`,
          [r.orderId, r.sellerWallet, r.sellerHandle, r.buyerWallet, r.rating, r.text, r.reviewerKey, r.buyerSig, r.payTx ?? null, r.devSkippedWorld, r.buyerHistory],
        );
        if (ins.rowCount === 0) throw new Rollback();
        return true;
      }).catch((e) => {
        if (e instanceof Rollback) return false;
        throw e;
      });
    },
    async review(orderId: string) {
      const r = await one(`select * from ${T("reviews")} where order_id = $1::numeric`, [orderId]);
      return r.rows[0] ? reviewOf(r.rows[0]) : undefined;
    },
    async reviewsBySeller(w: string) {
      const r = await one(`select * from ${T("reviews")} where seller_wallet = lower($1) order by created_at desc`, [w]);
      return r.rows.map(reviewOf);
    },
    async patchReview(orderId: string, patch: Partial<Pick<ReviewRow, "status" | "arkivKey" | "createTx" | "transferTx" | "error">>) {
      const { sets, vals } = setClause(
        patch,
        { status: "status", arkivKey: "arkiv_key", createTx: "create_tx", transferTx: "transfer_tx", error: "error" },
        2,
      );
      await one(`update ${T("reviews")} set ${[...sets, "updated_at = now()"].join(", ")} where order_id = $1::numeric`, [orderId, ...vals]);
    },
    /** Test helper (e2e): number of rows in review_nullifiers. */
    async reviewClaimCount() {
      const r = await one(`select count(*)::int as n from ${T("review_nullifiers")}`);
      return Number(r.rows[0].n);
    },
  };
}

class Rollback extends Error {}

export type Store = ReturnType<typeof createStore>;
