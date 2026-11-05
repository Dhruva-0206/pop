/**
 * Smoke E: apply supabase/migrations/0001_init.sql to DATABASE_URL, then prove
 * one insert and one UNIQUE(nullifier_hash, seller_wallet) violation on review_nullifiers.
 * Uses fake test values and cleans them up. Usage: npx tsx scripts/smoke-db.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { need } from "./env";

const client = new pg.Client({ connectionString: need("DATABASE_URL"), ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const sql = readFileSync(resolve(import.meta.dirname, "..", "supabase", "migrations", "0001_init.sql"), "utf8");
  await client.query(sql);
  console.log("migration 0001_init.sql applied (idempotent)");

  const nullifier = "0xsmoke_nullifier_" + Date.now();
  const sellerA = "0x000000000000000000000000000000000000a11a";
  const sellerB = "0x000000000000000000000000000000000000b22b";

  await client.query("insert into review_nullifiers (nullifier_hash, seller_wallet, order_id) values ($1,$2,1)", [nullifier, sellerA]);
  console.log("insert #1 (human X, seller A): OK");

  await client.query("insert into review_nullifiers (nullifier_hash, seller_wallet, order_id) values ($1,$2,2)", [nullifier, sellerB]);
  console.log("insert #2 (same human X, different seller B): OK (allowed: one review per seller)");

  try {
    await client.query("insert into review_nullifiers (nullifier_hash, seller_wallet, order_id) values ($1,$2,3)", [nullifier, sellerA]);
    throw new Error("expected unique violation, but insert succeeded");
  } catch (e) {
    const err = e as { code?: string; constraint?: string };
    if (err.code !== "23505") throw e;
    console.log(`insert #3 (same human X, seller A again): REJECTED ${err.code} ${err.constraint}`);
  }

  await client.query("delete from review_nullifiers where nullifier_hash = $1", [nullifier]);
  console.log("cleaned up. SMOKE E PASS");
} finally {
  await client.end();
}
