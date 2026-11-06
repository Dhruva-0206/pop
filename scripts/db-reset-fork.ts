/**
 * Wipes the LOCAL FORK test data: drops the "pop_fork" schema and recreates it empty. Run it after restarting the fork
 * (the chain state is gone, so the order rows are stale). Hard-locked: it only ever touches the schema "pop_fork",
 * never "public" (real data) or kurta_1874, and refuses unless NETWORK_MODE=fork. Usage: npm run db:reset-fork
 */
import { mode } from "./chain";
import { migrate, withClient } from "./db";

if (mode !== "fork") throw new Error("db:reset-fork only runs with NETWORK_MODE=fork");
// The Kurta store keeps its order book in its own schema kurta_<chainId> (31337 on the fork); it goes with the fork too.
await withClient(async (c) => {
  await c.query('drop schema if exists "pop_fork" cascade');
  await c.query('drop schema if exists "kurta_31337" cascade');
});
await migrate("fork");
console.log('schema "pop_fork" dropped and recreated empty (fork test data only; "public" untouched)');
