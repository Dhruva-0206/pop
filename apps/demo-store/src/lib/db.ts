import "server-only";
import pg from "pg";
import { chainInfo } from "./pop";

/**
 * The store's own Postgres tables (same Supabase project is fine; its own schema `kurta_<chainId>`, so a fork never mixes with 1874).
 * No migration step: the schema is created on first use. There is no in-memory or file fallback.
 */
const g = globalThis as unknown as { __kurtaPool?: pg.Pool; __kurtaSchema?: Promise<string> };

export function pool(): pg.Pool {
  if (g.__kurtaPool) return g.__kurtaPool;
  const url = process.env.DATABASE_URL?.split("#")[0]?.trim();
  if (!url) throw new Error("DATABASE_URL is not set for the Kurta Co. store (Supabase Postgres). There is no file or in-memory fallback.");
  return (g.__kurtaPool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 3 }));
}

/** Schema name, created (with its tables) on first use. Serialised with an advisory lock so concurrent cold starts do not race. */
export function schema(): Promise<string> {
  return (g.__kurtaSchema ??= (async () => {
    const S = `kurta_${(await chainInfo()).id}`;
    const c = await pool().connect();
    try {
      await c.query("begin");
      await c.query("select pg_advisory_xact_lock(7342001)");
      await c.query(`create schema if not exists "${S}"`);
      await c.query(`create table if not exists "${S}".orders (
        ref         text primary key,                 -- our merchantRef (echoed by PoP in every webhook)
        session_id  text,
        order_id    numeric(78,0),                    -- on-chain order id once paid
        buyer       text,
        amount_usdt text,
        status      text not null default 'created',  -- created|funded|shipped|delivered|released|refunded|split (chain-confirmed)
        created_at  timestamptz not null default now(),
        updated_at  timestamptz not null default now()
      )`);
      // Order ids restart on every checkout deployment, so an order is identified by (checkout address, order id), never by the id alone.
      await c.query(`alter table "${S}".orders add column if not exists checkout text`);
      await c.query(`drop index if exists "${S}".orders_order_id_uq`); // older versions keyed on order_id alone
      await c.query(`create unique index if not exists orders_checkout_order_uq on "${S}".orders (checkout, order_id) where order_id is not null and checkout is not null`);
      await c.query(`create table if not exists "${S}".order_events (
        event_id    text primary key,                 -- PoP event id: dedupes webhook retries
        ref         text not null,
        type        text not null,
        at          bigint not null,
        onchain_state text not null,
        created_at  timestamptz not null default now()
      )`);
      await c.query("commit");
    } catch (e) {
      await c.query("rollback").catch(() => undefined);
      g.__kurtaSchema = undefined;
      throw e;
    } finally {
      c.release();
    }
    return S;
  })());
}
