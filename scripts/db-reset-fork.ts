/**
 * Wipes the LOCAL FORK test data: drops the "pop_fork" schema and recreates it empty. Run it after restarting the fork
 * (the chain state is gone, so the order rows are stale). Hard-locked: it only ever touches the schema "pop_fork",
 * never "public" (real data), and refuses unless NETWORK_MODE=fork. Usage: npm run db:reset-fork
 */
import { mode } from "./chain";
import { migrate, withClient } from "./db";

if (mode !== "fork") throw new Error("db:reset-fork only runs with NETWORK_MODE=fork");
await withClient((c) => c.query('drop schema if exists "pop_fork" cascade'));
await migrate("fork");
console.log('schema "pop_fork" dropped and recreated empty (fork test data only; "public" untouched)');
