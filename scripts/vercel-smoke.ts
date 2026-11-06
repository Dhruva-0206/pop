/**
 * Post-deploy smoke check for the two Vercel projects. Read-only: only GET requests, no keys, no .env needed.
 * Usage: npx tsx scripts/vercel-smoke.ts <PoP URL> <Kurta store URL>
 *   e.g. npx tsx scripts/vercel-smoke.ts https://pop.vercel.app https://kurta.vercel.app
 * Prints PASS or FAIL per check and exits 1 if any check failed.
 *
 * Side effects to know about (same as the live site has anyway):
 *  - GET /api/webhooks/dispatch runs one webhook pass, exactly what the cron does. It only delivers events that are already on chain.
 *  - GET <store>/api/orders runs the store's reconcile (it heals its own order book from chain events).
 * Expected addresses come from deployments/testnet.json in this repo (committed, public).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const [popArg, storeArg] = process.argv.slice(2);
if (!popArg || !storeArg) {
  console.error("Usage: npx tsx scripts/vercel-smoke.ts <PoP URL> <Kurta store URL>");
  process.exit(2);
}
const POP = popArg.replace(/\/+$/, "");
const STORE = storeArg.replace(/\/+$/, "");
const dep = JSON.parse(readFileSync(resolve(import.meta.dirname, "..", "deployments", "testnet.json"), "utf8")) as {
  chainId: number;
  checkout: string;
  registry: string;
  token: string;
};
const same = (a: unknown, b: string) => typeof a === "string" && a.toLowerCase() === b.toLowerCase();

type Res = { status: number; text: string; json: Record<string, unknown> | null; ms: number };
async function get(url: string): Promise<Res> {
  const t0 = Date.now();
  const r = await fetch(url, { headers: { accept: "application/json,text/html" }, signal: AbortSignal.timeout(60_000), redirect: "follow" });
  const text = await r.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  return { status: r.status, text, json, ms: Date.now() - t0 };
}

let failed = 0;
let total = 0;
async function check(name: string, fn: () => Promise<string | true>) {
  total++;
  try {
    const r = await fn();
    if (r === true) console.log(`PASS  ${name}`);
    else {
      failed++;
      console.log(`FAIL  ${name}: ${r}`);
    }
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

console.log(`PoP:   ${POP}\nStore: ${STORE}\nExpected checkout ${dep.checkout}, registry ${dep.registry}, chain ${dep.chainId}\n`);

// ---------------------------------------------------------------- PoP
await check("pop: home page", async () => {
  const r = await get(`${POP}/`);
  return r.status === 200 || `HTTP ${r.status}`;
});

await check("pop: /api/config is testnet 1874 with the deployed addresses, dev World skip off", async () => {
  const r = await get(`${POP}/api/config`);
  if (r.status !== 200 || !r.json) return `HTTP ${r.status}: ${r.text.slice(0, 120)}`;
  const j = r.json;
  if (j.mode !== "testnet") return `mode is ${String(j.mode)}`;
  if (j.chainId !== dep.chainId) return `chainId is ${String(j.chainId)}`;
  if (!same(j.checkout, dep.checkout)) return `checkout is ${String(j.checkout)}`;
  if (!same(j.registry, dep.registry)) return `registry is ${String(j.registry)}`;
  if (!same(j.token, dep.token)) return `token is ${String(j.token)}`;
  if (j.devSkipWorld !== false) return `devSkipWorld is ${String(j.devSkipWorld)} (must be false on a deployed build)`;
  if (j.isLocalFork) return "isLocalFork is true";
  return true;
});

await check("pop: /api/verify/meera.jewels is registered", async () => {
  const r = await get(`${POP}/api/verify/meera.jewels`);
  if (r.status !== 200 || !r.json) return `HTTP ${r.status}: ${r.text.slice(0, 120)}`;
  return r.json.registered === true || `registered is ${String(r.json.registered)}`;
});

await check("pop: /api/verify of an unknown handle is 404 and not registered", async () => {
  const r = await get(`${POP}/api/verify/no.such.seller.zz`);
  if (r.status !== 404) return `HTTP ${r.status}`;
  return r.json?.registered === false || "registered is not false";
});

await check("pop: /api/listings/jhumka-01 (signed offer, terms hash matches, seller active)", async () => {
  const r = await get(`${POP}/api/listings/jhumka-01`);
  if (r.status !== 200 || !r.json) return `HTTP ${r.status}: ${r.text.slice(0, 120)}`;
  if (r.json.termsHashMatches !== true) return "termsHashMatches is not true";
  const s = r.json.sellerStanding as { active?: boolean } | undefined;
  return s?.active === true || "seller is not active";
});

await check("pop: /proof renders and shows the deployed checkout address", async () => {
  const r = await get(`${POP}/proof`);
  if (r.status !== 200) return `HTTP ${r.status}`;
  return r.text.toLowerCase().includes(dep.checkout.toLowerCase()) || "checkout address not found in the page";
});

await check("pop: /api/webhooks/dispatch runs one pass without error", async () => {
  const r = await get(`${POP}/api/webhooks/dispatch`);
  if (r.status !== 200 || !r.json) return `HTTP ${r.status}: ${r.text.slice(0, 120)}`;
  return !("error" in r.json) || `error: ${String(r.json.error)}`;
});

// ---------------------------------------------------------------- Kurta store
await check("store: home page", async () => {
  const r = await get(`${STORE}/`);
  return r.status === 200 || `HTTP ${r.status}`;
});

await check("store: /api/record reads the seller record (contracts plus Arkiv with the store's own key)", async () => {
  const r = await get(`${STORE}/api/record`);
  if (r.status !== 200 || !r.json) return `HTTP ${r.status}: ${r.text.slice(0, 120)}`;
  return !("error" in r.json) || `error: ${String(r.json.error)}`;
});

await check("store: /orders page", async () => {
  const r = await get(`${STORE}/orders`);
  return r.status === 200 || `HTTP ${r.status}`;
});

await check("store: /api/orders returns an order list", async () => {
  const r = await get(`${STORE}/api/orders`);
  if (r.status !== 200 || !r.json) return `HTTP ${r.status}: ${r.text.slice(0, 120)}`;
  return Array.isArray(r.json.orders) || "no orders array";
});

console.log(`\n${total - failed} of ${total} checks passed${failed ? `, ${failed} FAILED` : ""}.`);
process.exit(failed ? 1 : 0);
