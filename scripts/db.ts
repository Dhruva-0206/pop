/** Shared helpers for DB scripts: connect to DATABASE_URL, apply the migration into the schema for a network mode. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { schemaFor } from "../packages/shared/src/server/store";
import type { NetworkMode } from "../packages/shared/src/network";
import { need } from "./env";

export async function withClient<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: need("DATABASE_URL"), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Applies supabase/migrations/0001_init.sql (idempotent; upgrades an older 0001) into the schema for `mode`, in one transaction. */
export async function migrate(mode: NetworkMode) {
  const schema = schemaFor(mode);
  const sql = readFileSync(resolve(import.meta.dirname, "..", "supabase", "migrations", "0001_init.sql"), "utf8");
  await withClient(async (c) => {
    await c.query("begin");
    try {
      if (schema !== "public") await c.query(`create schema if not exists "${schema}"`);
      await c.query(`set local search_path to "${schema}"`);
      await c.query(sql);
      await c.query("commit");
    } catch (e) {
      await c.query("rollback").catch(() => {});
      throw e;
    }
  });
  return schema;
}
