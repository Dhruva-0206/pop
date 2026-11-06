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
export type MerchantRow = {
  id: number;
  name: string;
  sellerWallet: string;
  apiKeyHash: string;
  webhookUrl?: string;
  webhookSecretEnc?: string;
  allowedReturnOrigin?: string;
  rateLimitPerMin: number;
};
export type SessionRow = { id: string; merchantId: number; listingId: string; merchantRef: string; returnUrl?: string; expiresAt: string };
export type WebhookDelivery = {
  id: number;
  merchantId: number;
  orderId: string;
  event: string;
  payload: unknown;
  attempts: number;
  status: "pending" | "delivered" | "failed";
};
export type OnboardingRow = {
  id: number;
  handle: string;
  wallet: string;
  bioCode: string;
  status: "pending" | "approved" | "rejected";
  regNonce?: string;
  regDeadline?: number;
  regSig?: string;
  createdAt: string;
};
export type WorldLogRow = { at: string; sellerHandle?: string; orderId?: string; outcome: string; detail?: string; environment?: string; action?: string; nullifierHint?: string };
export type VendorVerification = { id: number; nullifierHash: string; nullifierHint: string; handle: string; createdAt: string; banned: boolean };
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

  const vendorOf = (r: pg.QueryResultRow): VendorVerification => ({
    id: Number(r.id),
    nullifierHash: r.nullifier_hash,
    nullifierHint: r.nullifier_hint,
    handle: r.handle,
    createdAt: new Date(r.created_at).toISOString(),
    banned: Boolean(r.banned),
  });
  const onboardingOf = (r: pg.QueryResultRow): OnboardingRow => ({
    id: Number(r.id),
    handle: r.handle,
    wallet: ck(r.wallet),
    bioCode: r.bio_code,
    status: r.status,
    regNonce: opt(r.reg_nonce),
    regDeadline: r.reg_deadline === null ? undefined : Number(r.reg_deadline),
    regSig: opt(r.reg_sig),
    createdAt: iso(r.created_at),
  });
  const merchantOf = (r: pg.QueryResultRow): MerchantRow => ({
    id: Number(r.id),
    name: r.name,
    sellerWallet: ck(r.seller_wallet),
    apiKeyHash: r.api_key_hash,
    webhookUrl: opt(r.webhook_url),
    webhookSecretEnc: opt(r.webhook_secret_enc),
    allowedReturnOrigin: opt(r.allowed_return_origin),
    rateLimitPerMin: Number(r.rate_limit_per_min ?? 30),
  });
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
    // ------------------------------------------------------------ onboarding (/onboard)
    /** Returns the row, or undefined if the handle or wallet already has a non-rejected request. */
    async createOnboarding(handle: string, wallet: string, bioCode: string): Promise<OnboardingRow | undefined> {
      const r = await one(
        `insert into ${T("onboarding_requests")} (handle, wallet, bio_code) values (lower($1), lower($2), $3) on conflict do nothing returning *`,
        [handle, wallet, bioCode],
      );
      return r.rows[0] ? onboardingOf(r.rows[0]) : undefined;
    },
    async onboardingByWallet(wallet: string): Promise<OnboardingRow | undefined> {
      const r = await one(`select * from ${T("onboarding_requests")} where wallet = lower($1) and status <> 'rejected' order by id desc limit 1`, [wallet]);
      return r.rows[0] ? onboardingOf(r.rows[0]) : undefined;
    },
    async onboardingById(id: number): Promise<OnboardingRow | undefined> {
      const r = await one(`select * from ${T("onboarding_requests")} where id = $1`, [id]);
      return r.rows[0] ? onboardingOf(r.rows[0]) : undefined;
    },
    async pendingOnboarding(): Promise<OnboardingRow[]> {
      return (await one(`select * from ${T("onboarding_requests")} where status = 'pending' order by id limit 100`)).rows.map(onboardingOf);
    },
    /** Only a pending request can be decided (returns false otherwise). */
    async decideOnboarding(id: number, approve: boolean, reg?: { nonce: string; deadline: number; sig: string }): Promise<boolean> {
      const r = await one(
        `update ${T("onboarding_requests")} set status = $2, reg_nonce = $3, reg_deadline = $4, reg_sig = $5, decided_at = now() where id = $1 and status = 'pending'`,
        [id, approve ? "approved" : "rejected", reg?.nonce ?? null, reg?.deadline ?? null, reg?.sig ?? null],
      );
      return (r.rowCount ?? 0) > 0;
    },
    // ------------------------------------------------------------ vendor verification (one human, one shop)
    /** Inserts the claim; returns false if this nullifier hash is already claimed (UNIQUE). */
    async claimVendor(nullifierHash: string, handle: string): Promise<boolean> {
      const r = await one(
        `insert into ${T("vendor_verifications")} (nullifier_hash, nullifier_hint, handle) values ($1, $2, lower($3)) on conflict (nullifier_hash) do nothing`,
        [nullifierHash, nullifierHash.slice(0, 12), handle],
      );
      return (r.rowCount ?? 0) > 0;
    },
    async vendorByNullifier(nullifierHash: string): Promise<VendorVerification | undefined> {
      const r = await one(`select * from ${T("vendor_verifications")} where nullifier_hash = $1`, [nullifierHash]);
      return r.rows[0] ? vendorOf(r.rows[0]) : undefined;
    },
    async vendorsByHandle(handle: string): Promise<VendorVerification[]> {
      return (await one(`select * from ${T("vendor_verifications")} where handle = lower($1) order by id`, [handle])).rows.map(vendorOf);
    },
    /** Mirrors an on-chain ban onto every verification row of that handle. Returns how many rows changed. */
    async markVendorBanned(handle: string): Promise<number> {
      const r = await one(`update ${T("vendor_verifications")} set banned = true where handle = lower($1) and banned = false`, [handle]);
      return r.rowCount ?? 0;
    },
    /** Undo a claim (only used when the rest of the onboarding request could not be created). */
    async releaseVendor(nullifierHash: string): Promise<void> {
      await one(`delete from ${T("vendor_verifications")} where nullifier_hash = $1 and banned = false`, [nullifierHash]);
    },
    // ------------------------------------------------------------ World verification log (no secrets)
    async logWorldVerification(x: Omit<WorldLogRow, "at">) {
      await one(
        `insert into ${T("world_verifications")} (seller_handle, order_id, outcome, detail, environment, action, nullifier_hint) values ($1, $2::numeric, $3, $4, $5, $6, $7)`,
        [x.sellerHandle ?? null, x.orderId ?? null, x.outcome, x.detail?.slice(0, 200) ?? null, x.environment ?? null, x.action ?? null, x.nullifierHint ?? null],
      );
    },
    async worldVerifications(limit = 50): Promise<WorldLogRow[]> {
      const r = await one(`select * from ${T("world_verifications")} order by id desc limit $1`, [limit]);
      return r.rows.map((x) => ({
        at: iso(x.at), sellerHandle: opt(x.seller_handle), orderId: x.order_id === null ? undefined : String(x.order_id),
        outcome: x.outcome, detail: opt(x.detail), environment: opt(x.environment), action: opt(x.action), nullifierHint: opt(x.nullifier_hint),
      }));
    },
    // ------------------------------------------------------------ dispute reasons
    async saveDisputeReason(orderId: string, reason: string, evidenceHash: string, openedBy: string) {
      await one(
        `insert into ${T("disputes")} (order_id, reason, evidence_hash, opened_by) values ($1::numeric, $2, $3, lower($4))
         on conflict (order_id) do update set reason = excluded.reason, evidence_hash = excluded.evidence_hash, opened_by = excluded.opened_by`,
        [orderId, reason, evidenceHash, openedBy],
      );
    },
    async disputeReason(orderId: string): Promise<{ reason?: string; evidenceHash?: string } | undefined> {
      const r = await one(`select reason, evidence_hash from ${T("disputes")} where order_id = $1::numeric`, [orderId]);
      return r.rows[0] ? { reason: opt(r.rows[0].reason), evidenceHash: opt(r.rows[0].evidence_hash) } : undefined;
    },
    // ------------------------------------------------------------ merchants (Pay with PoP)
    async upsertMerchant(m: Omit<MerchantRow, "id" | "rateLimitPerMin">): Promise<number> {
      const r = await one(
        `insert into ${T("merchants")} (name, seller_wallet, api_key_hash, webhook_url, webhook_secret_enc, allowed_return_origin)
         values ($1, lower($2), $3, $4, $5, $6)
         on conflict (seller_wallet) do update set name = excluded.name, api_key_hash = excluded.api_key_hash,
           webhook_url = excluded.webhook_url, webhook_secret_enc = excluded.webhook_secret_enc,
           allowed_return_origin = excluded.allowed_return_origin
         returning id`,
        [m.name, m.sellerWallet, m.apiKeyHash, m.webhookUrl ?? null, m.webhookSecretEnc ?? null, m.allowedReturnOrigin ?? null],
      );
      return Number(r.rows[0].id);
    },
    /** Sessions this merchant created in the last `seconds` (rate limiting; counted in the database, so it holds across serverless instances). */
    async countRecentSessions(merchantId: number, seconds: number): Promise<number> {
      const r = await one(
        `select count(*)::int as n from ${T("checkout_sessions")} where merchant_id = $1 and created_at > now() - make_interval(secs => $2)`,
        [merchantId, seconds],
      );
      return Number(r.rows[0].n);
    },
    async setMerchantRateLimit(merchantId: number, perMin: number) {
      await one(`update ${T("merchants")} set rate_limit_per_min = $2 where id = $1`, [merchantId, perMin]);
    },
    async merchantByKeyHash(h: string): Promise<MerchantRow | undefined> {
      const r = await one(`select * from ${T("merchants")} where api_key_hash = $1`, [h]);
      return r.rows[0] ? merchantOf(r.rows[0]) : undefined;
    },
    async merchantByWallet(w: string): Promise<MerchantRow | undefined> {
      const r = await one(`select * from ${T("merchants")} where seller_wallet = lower($1)`, [w]);
      return r.rows[0] ? merchantOf(r.rows[0]) : undefined;
    },
    async merchants(): Promise<MerchantRow[]> {
      return (await one(`select * from ${T("merchants")} order by id`)).rows.map(merchantOf);
    },
    /** Session = listing (same id, holds the signed Offer) + a checkout_sessions row. One transaction; false if the id is taken. */
    async createSession(l: ListingRow, x: { merchantId: number; merchantRef: string; returnUrl?: string; expiresAt: string }): Promise<boolean> {
      return tx(async (c) => {
        const seller = await q(c, `select id from ${T("sellers")} where wallet = lower($1)`, [l.sellerWallet]);
        if (!seller.rows[0]) throw new Error("createSession: seller is not in the database");
        const ins = await q(
          c,
          `insert into ${T("listings")} (id, seller_id, title, image_url, price_units, price_inr, terms_json, terms_hash, offer_json, offer_sig, listing_id_hash, active, created_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12) on conflict (id) do nothing`,
          [l.id, seller.rows[0].id, l.title, l.imageUrl ?? null, l.priceUnits, l.priceInr, JSON.stringify(l.terms), l.termsHash,
            JSON.stringify(l.offer), l.offerSig, listingIdHash(l.id).toLowerCase(), l.createdAt],
        );
        if (ins.rowCount === 0) return false;
        await q(
          c,
          `insert into ${T("checkout_sessions")} (id, seller_id, external_order_id, offer_json, offer_sig, return_url, expires_at, merchant_id, listing_id)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$1)`,
          [l.id, seller.rows[0].id, x.merchantRef, JSON.stringify(l.offer), l.offerSig, x.returnUrl ?? null, x.expiresAt, x.merchantId],
        );
        return true;
      });
    },
    async sessionByListing(listingId: string): Promise<(SessionRow & { merchantName: string }) | undefined> {
      const r = await one(
        `select cs.*, m.name as merchant_name from ${T("checkout_sessions")} cs join ${T("merchants")} m on m.id = cs.merchant_id where cs.listing_id = $1`,
        [listingId],
      );
      const x = r.rows[0];
      return x
        ? { id: x.id, merchantId: Number(x.merchant_id), listingId: x.listing_id, merchantRef: x.external_order_id, returnUrl: opt(x.return_url), expiresAt: iso(x.expires_at), merchantName: x.merchant_name }
        : undefined;
    },
    // ------------------------------------------------------------ webhooks
    async webhookCursor(key: string): Promise<number | undefined> {
      const r = await one(`select block from ${T("webhook_cursor")} where key = $1`, [key]);
      return r.rows[0] ? Number(r.rows[0].block) : undefined;
    },
    async setWebhookCursor(key: string, block: number) {
      await one(
        `insert into ${T("webhook_cursor")} (key, block) values ($1, $2) on conflict (key) do update set block = greatest(${T("webhook_cursor")}.block, excluded.block)`,
        [key, block],
      );
    },
    /** Enqueue once per (merchant, order, event). Returns false if it was already enqueued. */
    async enqueueWebhook(merchantId: number, orderId: string, event: string, payload: unknown): Promise<boolean> {
      const r = await one(
        `insert into ${T("webhook_deliveries")} (merchant_id, order_id, event, payload) values ($1, $2::numeric, $3, $4)
         on conflict (merchant_id, order_id, event) do nothing`,
        [merchantId, orderId, event, JSON.stringify(payload)],
      );
      return (r.rowCount ?? 0) > 0;
    },
    /** Pending, or failed with attempts left and last tried more than backoffSec ago. Oldest first. */
    async dueWebhooks(maxAttempts: number, backoffSec: number): Promise<WebhookDelivery[]> {
      const r = await one(
        `select * from ${T("webhook_deliveries")}
         where merchant_id is not null and (status = 'pending' or (status = 'failed' and attempts < $1 and updated_at < now() - make_interval(secs => $2)))
         order by id limit 50`,
        [maxAttempts, backoffSec],
      );
      return r.rows.map((x) => ({
        id: Number(x.id), merchantId: Number(x.merchant_id), orderId: String(x.order_id), event: x.event,
        payload: x.payload, attempts: Number(x.attempts), status: x.status,
      }));
    },
    /**
     * Atomically takes ONE due delivery (so a cron pass and an order-page pass in different serverless instances never send the
     * same row at once). The row moves to status 'sending'; if the claimer dies, the row becomes due again after `leaseSec`.
     * Due = pending, or failed with attempts left past the backoff, or 'sending' past its lease.
     */
    async claimWebhook(maxAttempts: number, backoffSec: number, leaseSec: number): Promise<WebhookDelivery | undefined> {
      const r = await one(
        `update ${T("webhook_deliveries")} set status = 'sending', updated_at = now()
         where id = (
           select id from ${T("webhook_deliveries")}
           where merchant_id is not null and (
             status = 'pending'
             or (status = 'failed' and attempts < $1 and updated_at < now() - make_interval(secs => $2))
             or (status = 'sending' and updated_at < now() - make_interval(secs => $3))
           )
           order by id limit 1 for update skip locked
         )
         returning *`,
        [maxAttempts, backoffSec, leaseSec],
      );
      const x = r.rows[0];
      return x
        ? { id: Number(x.id), merchantId: Number(x.merchant_id), orderId: String(x.order_id), event: x.event, payload: x.payload, attempts: Number(x.attempts), status: x.status }
        : undefined;
    },
    async markWebhook(id: number, ok: boolean, error?: string) {
      await one(
        `update ${T("webhook_deliveries")} set attempts = attempts + 1, status = $2, last_error = $3, updated_at = now(),
           delivered_at = case when $2 = 'delivered' then now() else delivered_at end where id = $1 and status <> 'delivered'`,
        [id, ok ? "delivered" : "failed", ok ? null : (error ?? "failed").slice(0, 300)],
      );
    },
    async webhookDeliveries(merchantId: number): Promise<WebhookDelivery[]> {
      const r = await one(`select * from ${T("webhook_deliveries")} where merchant_id = $1 order by id`, [merchantId]);
      return r.rows.map((x) => ({
        id: Number(x.id), merchantId: Number(x.merchant_id), orderId: String(x.order_id), event: x.event,
        payload: x.payload, attempts: Number(x.attempts), status: x.status,
      }));
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
