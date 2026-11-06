/**
 * End-to-end check of "Pay with PoP" + the Kurta Co. demo store + the seller CSV, on the LOCAL FORK or on TESTNET.
 *  - PoP web on POP_URL (default http://localhost:3000), demo store on KURTA_URL (default http://localhost:3001), both started
 *    in the same NETWORK_MODE, `npx tsx scripts/seed-merchant.ts` already run.
 *  - Covers: merchant API auth + validation, a session created by the store's own server SDK, a buyer paying it, the five webhooks
 *    delivered (signed) and rechecked on-chain by the store, webhook attack cases, the refund path, the seller CSV.
 *  - fork: random funded buyer + time warp (anvil). testnet: TEST_BUYER_PK, REAL time (needs ALLOW_TESTNET_ORDER=yes; uses 2 small orders).
 * Usage: npx tsx scripts/e2e-merchant.ts
 */
import { createHmac } from "node:crypto";
import pg from "pg";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { decodeEventLog, erc20Abi, keccak256, toHex, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http } from "viem";
import { checkoutAbi, codeBytes, deliveryCodeHash, ORDER_STATES } from "../packages/shared/src/index";
import { createStore } from "../packages/shared/src/server/store";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { loadDeployment, mode, net, pub, walletOf } from "./chain";
import { need, opt } from "./env";

const POP = opt("POP_URL") ?? "http://localhost:3000";
const KURTA = opt("KURTA_URL") ?? "http://localhost:3001";
const FORK = mode === "fork";
if (!FORK && opt("ALLOW_TESTNET_ORDER") !== "yes") throw new Error("Testnet run makes real test-USDT orders: set ALLOW_TESTNET_ORDER=yes");
const dep = loadDeployment();
const storeEnv = parse(readFileSync(resolve(import.meta.dirname, "..", "apps", "demo-store", ".env.local"), "utf8"));
const API_KEY = storeEnv.POP_API_KEY;
const SECRET = storeEnv.POP_WEBHOOK_SECRET;
if (!API_KEY || !SECRET) throw new Error("run scripts/seed-merchant.ts first");
const log = (s: string) => console.log(`✓ ${s}`);
const fail = (s: string): never => {
  throw new Error(`FAIL: ${s}`);
};
let checks = 0;
const ok = (cond: unknown, s: string) => {
  checks++;
  if (!cond) fail(s);
  log(s);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function http_(base: string, path: string, init?: { body?: unknown; headers?: Record<string, string>; raw?: string; method?: string }) {
  const r = await fetch(`${base}${path}`, {
    method: init?.method ?? (init?.body || init?.raw ? "POST" : "GET"),
    headers: { "content-type": "application/json", ...init?.headers },
    body: init?.raw ?? (init?.body ? JSON.stringify(init.body) : undefined),
  });
  const text = await r.text();
  let j: any = {};
  try {
    j = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: r.status, j, text, headers: r.headers };
}
const dispatch = () => http_(POP, "/api/webhooks/dispatch", { method: "POST", body: undefined });
const chainNow = async () => Number((await pub.getBlock()).timestamp);
async function warpTo(ts: number) {
  if (FORK) {
    const d = ts - (await chainNow()) + 1;
    if (d > 0) await pub.request({ method: "evm_increaseTime" as never, params: [d] as never });
    await pub.request({ method: "evm_mine" as never, params: [] as never });
  } else {
    while ((await chainNow()) <= ts) await sleep(4000);
  }
}
const getOrder = (id: bigint) => pub.readContract({ address: dep.checkout, abi: checkoutAbi, functionName: "getOrder", args: [id] });
const stateOf = async (id: bigint) => ORDER_STATES[(await getOrder(id)).state];
async function kurtaStatus(ref: string): Promise<{ status: string; history: { event: string }[] } | undefined> {
  const { j } = await http_(KURTA, "/api/orders");
  return (j.orders as any[] | undefined)?.find((o) => o.ref === ref);
}
async function waitStatus(ref: string, status: string, label: string) {
  for (let i = 0; i < 40; i++) {
    await dispatch();
    const o = await kurtaStatus(ref);
    if (o?.status === status) return o;
    await sleep(1000);
  }
  return fail(`${label}: store never reached "${status}" (last: ${(await kurtaStatus(ref))?.status})`);
}

// ---------------------------------------------------------------- 1) merchant API: auth and validation
const sellerWallet = walletOf("MERCHANT_PK");
const bad = await http_(POP, "/api/v1/checkout-sessions", { body: {}, headers: { authorization: "Bearer pop_test_wrongwrongwrongwrongwrong" } });
ok(bad.status === 401, "session with a wrong API key is rejected (401)");
const none = await http_(POP, "/api/v1/checkout-sessions", { body: {} });
ok(none.status === 401, "session without an API key is rejected (401)");
const empty = await http_(POP, "/api/v1/checkout-sessions", { body: { nope: 1 }, headers: { authorization: `Bearer ${API_KEY}` } });
ok(empty.status === 400, "malformed session body is rejected (400)");

async function newSession(title: string) {
  // Same path the store uses: its OWN server calls the SDK. We call the SDK directly here only for custom titles.
  const { PoP } = await import("@pop/checkout-sdk/server");
  const pop = new PoP({ baseUrl: POP, apiKey: API_KEY, webhookSecret: SECRET, merchantPk: need("MERCHANT_PK") as Hex });
  const ref = `E2E-${crypto.randomUUID().slice(0, 8)}`;
  const s = await pop.createSession({ title, priceInr: 1299, priceUsdt: "1.50", merchantRef: ref });
  return { ...s, ref, pop };
}
const probe = await newSession("probe");
const lst = (await http_(POP, `/api/listings/${probe.sessionId}`)).j.listing;
ok(lst && lst.offer.maxUnits === 1 && lst.sellerHandle === "kurta.co", "SDK-created session is live as a single-use listing for @kurta.co");
// replay / tamper with the same signed offer
const baseBody = { sessionId: probe.sessionId, merchantRef: probe.ref, terms: lst.terms, offer: lst.offer, offerSig: lst.offerSig };
const dup = await http_(POP, "/api/v1/checkout-sessions", { body: baseBody, headers: { authorization: `Bearer ${API_KEY}` } });
ok(dup.status === 409, "same sessionId again is rejected (409)");
const sid2 = "s_" + "0".repeat(16);
const wrongListing = await http_(POP, "/api/v1/checkout-sessions", { body: { ...baseBody, sessionId: sid2 }, headers: { authorization: `Bearer ${API_KEY}` } });
ok(wrongListing.status === 400, "offer not bound to the sessionId is rejected (400)");
const wrongTerms = await http_(POP, "/api/v1/checkout-sessions", {
  body: { ...baseBody, terms: { ...lst.terms, priceInr: 1 } },
  headers: { authorization: `Bearer ${API_KEY}` },
});
ok(wrongTerms.status === 400, "terms that do not match the signed termsHash are rejected (400)");
const stranger = privateKeyToAccount(generatePrivateKey());
const foreign = await http_(POP, "/api/v1/checkout-sessions", {
  body: { ...baseBody, sessionId: "s_" + "2".repeat(16), offer: { ...lst.offer, seller: stranger.address } },
  headers: { authorization: `Bearer ${API_KEY}` },
});
ok(foreign.status === 403, "an offer for another seller wallet is rejected (403)");
const badReturn = await http_(POP, "/api/v1/checkout-sessions", {
  body: { ...baseBody, returnUrl: "https://evil.example/x" },
  headers: { authorization: `Bearer ${API_KEY}` },
});
ok(badReturn.status === 403, "a returnUrl on a non-allowed origin is rejected (403)");

// ---------------------------------------------------------------- 2) buyer
const buyerAcct = FORK ? privateKeyToAccount(generatePrivateKey()) : privateKeyToAccount(need("TEST_BUYER_PK") as Hex);
const buyer = createWalletClient({ chain: net.chain, transport: http(net.rpcUrl), account: buyerAcct });
if (FORK) {
  const f = await http_(POP, "/api/faucet", { body: { address: buyerAcct.address } });
  if (f.status !== 200) fail(`faucet ${f.status} ${JSON.stringify(f.j)}`);
  // the app faucet gives ~1 USDT; this test buys three 1.50 USDT orders, so top up from the fork faucet wallet
  await pub.waitForTransactionReceipt({ hash: await walletOf("FAUCET_PK").writeContract({ address: dep.token, abi: erc20Abi, functionName: "transfer", args: [buyerAcct.address, 10_000_000n] }) });
}
const { orderRegisterMessage } = await import("../apps/web/src/lib/messages");

async function buyViaStore(label: string) {
  const c = await http_(KURTA, "/api/checkout", { body: {} });
  ok(c.status === 200 && c.j.url && c.j.ref, `${label}: the store's "Pay with PoP" endpoint returns a hosted checkout URL`);
  const sessionId = new URL(c.j.url).pathname.split("/").pop()!;
  const ref = c.j.ref as string;
  const l = (await http_(POP, `/api/listings/${sessionId}`)).j.listing;
  const o = l.offer;
  const offer = {
    seller: o.seller as Hex, listingId: o.listingId as Hex, termsHash: o.termsHash as Hex, externalRef: o.externalRef as Hex,
    price: BigInt(o.price), shipWithin: Number(o.shipWithin), deliverWithin: Number(o.deliverWithin), maxUnits: Number(o.maxUnits),
    validUntil: BigInt(o.validUntil), version: BigInt(o.version),
  };
  const code = Array.from(crypto.getRandomValues(new Uint16Array(6)), (n) => wordlist[n % 2048]).join(" ");
  await pub.waitForTransactionReceipt({ hash: await buyer.writeContract({ address: dep.token, abi: erc20Abi, functionName: "approve", args: [dep.checkout, offer.price] }) });
  const payTx = await buyer.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "pay", args: [offer, l.offerSig, deliveryCodeHash(net.chain.id, dep.checkout, code)] });
  const rc = await pub.waitForTransactionReceipt({ hash: payTx });
  let id = 0n;
  for (const lg of rc.logs) {
    try {
      const ev = decodeEventLog({ abi: checkoutAbi, data: lg.data, topics: lg.topics });
      if (ev.eventName === "OrderFunded") id = ev.args.orderId;
    } catch {
      /* token log */
    }
  }
  const delivery = { name: "Test Buyer", phone: "+91 90000 00000", address: "Flat 1, Test Building, Mumbai (test order)" };
  const reg = await http_(POP, "/api/orders/confirm", {
    body: { txHash: payTx, delivery, signature: await buyerAcct.signMessage({ message: orderRegisterMessage(payTx, delivery) }) },
  });
  ok(reg.status === 200, `${label}: order #${id} paid and registered with PoP`);
  return { id, code, ref, sessionId, payTx };
}

const A = await buyViaStore("order A");
const B = await buyViaStore("order B (the seller will never ship)");
await waitStatus(A.ref, "funded", "order A funded");
log("order A: store received order.funded, signed + rechecked on-chain");
await waitStatus(B.ref, "funded", "order B funded");

// session status API
const st = await http_(POP, `/api/v1/checkout-sessions/${A.sessionId}`, { headers: { authorization: `Bearer ${API_KEY}` } });
ok(st.status === 200 && st.j.status === "paid" && st.j.orderId === A.id.toString() && st.j.merchantRef === A.ref, "session status API shows paid + the merchantRef");
const otherSessionStatus = await http_(POP, `/api/v1/checkout-sessions/${A.sessionId}`);
ok(otherSessionStatus.status === 401, "session status without a key is rejected");

// ---------------------------------------------------------------- 3) webhook attack cases against the STORE's receiver
const evFor = (type: string, o: { id: bigint; ref: string; payTx: Hex }, extra: Record<string, unknown> = {}) => ({
  id: `evt_${o.id}_${type}_test`, type, created: Math.floor(Date.now() / 1000),
  data: { orderId: o.id.toString(), sessionId: null, merchantRef: o.ref, buyer: buyerAcct.address, seller: sellerWallet.account.address,
    amount: "1500000", chainId: net.chain.id, checkout: dep.checkout, txHash: o.payTx, ...extra },
});
const sign = (body: string, t = Math.floor(Date.now() / 1000), secret = SECRET) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
const post = (body: string, sig?: string) => http_(KURTA, "/api/pop/webhook", { raw: body, headers: sig ? { "pop-signature": sig } : {} });
{
  const body = JSON.stringify(evFor("order.funded", A));
  ok((await post(body)).status === 400, "webhook without a signature is rejected (400)");
  ok((await post(body, sign(body, undefined, "whsec_wrong"))).status === 400, "webhook signed with the wrong secret is rejected (400)");
  ok((await post(body, sign(body, Math.floor(Date.now() / 1000) - 3600))).status === 400, "a correctly signed but old webhook (replay) is rejected (400)");
  ok((await post(body + " ", sign(body))).status === 400, "a body changed after signing is rejected (400)");
  const refundedLie = JSON.stringify(evFor("order.refunded", A));
  ok((await post(refundedLie, sign(refundedLie))).status === 422, "signed 'refunded' for an order that is not refunded: the on-chain recheck refuses it (422)");
  const wrongAmount = JSON.stringify(evFor("order.funded", A, { amount: "1" }));
  ok((await post(wrongAmount, sign(wrongAmount))).status === 422, "signed event with a wrong amount: refused (422)");
  const wrongRef = JSON.stringify(evFor("order.funded", { ...A, ref: B.ref }));
  ok((await post(wrongRef, sign(wrongRef))).status === 422, "signed event pairing order A with order B's merchantRef: refused (422)");
  const fakeOrder = JSON.stringify(evFor("order.funded", { id: 99999n, ref: A.ref, payTx: A.payTx }));
  ok((await post(fakeOrder, sign(fakeOrder))).status === 422, "signed event for an order id that does not exist: refused (422)");
  const afterAttacks = await kurtaStatus(A.ref);
  ok(afterAttacks?.status === "funded" && afterAttacks.history.length === 1, "none of the attacks changed the store's order book");
}

// ---------------------------------------------------------------- 4) happy path A: ship -> deliver -> release
const seller = walletOf("MERCHANT_PK");
const courier = walletOf("COURIER_PK");
await pub.waitForTransactionReceipt({ hash: await seller.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "markShipped", args: [A.id, keccak256(toHex("E2E-TRACK"))] }) });
await waitStatus(A.ref, "shipped", "order A shipped");
log("order A: order.shipped received and confirmed on-chain");
await pub.waitForTransactionReceipt({ hash: await courier.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "confirmDelivery", args: [A.id, codeBytes(A.code)] }) });
await waitStatus(A.ref, "delivered", "order A delivered");
log("order A: order.delivered received (courier submitted the buyer's code)");

const delivered = await getOrder(A.id);
await warpTo(Number(delivered.deliveredAt) + Number(delivered.disputeWindow));
await pub.waitForTransactionReceipt({ hash: await buyer.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "finalize", args: [A.id] }) });
ok((await stateOf(A.id)) === "Released", "order A finalized -> Released");

// ---------------------------------------------------------------- 5) refund path B: seller never ships
const funded = await getOrder(B.id);
await warpTo(Number(funded.shipBy));
await pub.waitForTransactionReceipt({ hash: await buyer.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "finalize", args: [B.id] }) });
ok((await stateOf(B.id)) === "Refunded", "order B finalized after ship-by -> Refunded");

await waitStatus(A.ref, "released", "order A released");
await waitStatus(B.ref, "refunded", "order B refunded");
const a = (await kurtaStatus(A.ref))!;
ok(a.history.map((h) => h.event).join(",") === "order.funded,order.shipped,order.delivered,order.released", "order A: the store saw funded, shipped, delivered, released, in order");
const b = (await kurtaStatus(B.ref))!;
ok(b.history.map((h) => h.event).join(",") === "order.funded,order.refunded", "order B: the store saw funded, refunded");

// idempotency + delivery bookkeeping
const db = createStore(mode);
const merchant = (await db.merchants()).find((m) => m.sellerWallet.toLowerCase() === sellerWallet.account.address.toLowerCase())!;
// A slow receiver can time out once; PoP retries after a backoff and the receiver is idempotent, so wait for the retries to land.
let rows = (await db.webhookDeliveries(merchant.id)).filter((r) => [A.id, B.id].map(String).includes(r.orderId));
for (let i = 0; i < 20 && !(rows.length === 6 && rows.every((r) => r.status === "delivered")); i++) {
  await sleep(4000);
  await dispatch();
  rows = (await db.webhookDeliveries(merchant.id)).filter((r) => [A.id, B.id].map(String).includes(r.orderId));
}
ok(rows.length === 6 && rows.every((r) => r.status === "delivered"), `webhook_deliveries: 6 rows (4 for A, 2 for B), all delivered (attempts ${rows.map((r) => r.attempts).join(",")})`);
// per-merchant rate limit on session creation (counted in Postgres)
await newSession("rate probe"); // a session created just now (on testnet the run is minutes old by this point, so the last-minute count would be 0)
await db.setMerchantRateLimit(merchant.id, 1);
let rl: Awaited<ReturnType<typeof http_>>;
try {
  rl = await http_(POP, "/api/v1/checkout-sessions", { body: {}, headers: { authorization: `Bearer ${API_KEY}` } });
} finally {
  await db.setMerchantRateLimit(merchant.id, 30); // never leave the limit at 1 if this run dies
}
ok(rl.status === 429 && rl.headers.get("retry-after") === "60", "session creation over the merchant's per-minute limit is rejected (429, Retry-After)");
const otherKey = await http_(POP, "/api/v1/checkout-sessions", { body: {}, headers: { authorization: "Bearer pop_test_wrongwrongwrongwrongwrong" } });
ok(otherKey.status === 401, "the limit does not leak: a wrong key still gets 401, not 429");
await db.setMerchantRateLimit(merchant.id, 30);
const rl2 = await http_(POP, "/api/v1/checkout-sessions", { body: {}, headers: { authorization: `Bearer ${API_KEY}` } });
ok(rl2.status === 400, "after restoring the limit the same call reaches validation again (400)");

// the store's order book lives in Postgres and can be REBUILT from the chain: wipe A and B, age them, let reconcile heal them
const kc = new pg.Client({ connectionString: need("DATABASE_URL"), ssl: { rejectUnauthorized: false } });
await kc.connect();
const KS = `kurta_${net.chain.id}`;
const persisted = await kc.query(`select status, order_id from "${KS}".orders where ref = $1`, [A.ref]);
ok(persisted.rows[0]?.status === "released" && String(persisted.rows[0].order_id) === A.id.toString(), "the store's order book is in Postgres (not memory): order A is stored as released");
for (const r of [A.ref, B.ref]) {
  await kc.query(`delete from "${KS}".order_events where ref = $1`, [r]);
  await kc.query(`update "${KS}".orders set status = 'created', order_id = null, buyer = null, amount_usdt = null, updated_at = now() - interval '5 minutes' where ref = $1`, [r]);
}
await sleep(9000); // reconcile is throttled to once per 8 s
const healed = await kurtaStatus(A.ref);
const healedB = await kurtaStatus(B.ref);
ok(healed?.status === "released" && healedB?.status === "refunded", "wiped order book rebuilt from chain events alone: A released, B refunded");
const row = await kc.query(`select order_id from "${KS}".orders where ref = $1`, [A.ref]);
ok(String(row.rows[0].order_id) === A.id.toString(), "rebuild found order A by keccak(ref) in OrderFunded.externalRef");
await kc.end();

const again = (await dispatch()).j;
ok(again.enqueued === 0, "running the dispatcher again enqueues nothing new (idempotent)");

// ---------------------------------------------------------------- 6) reputation read by the store (own key)
const home = await http_(KURTA, "/");
ok(home.status === 200 && home.text.includes("Our protected record"), "store home renders its own record (counters from the contracts)");
const rec = (await http_(KURTA, "/api/record")).j;
ok(rec.active === true && Number(rec.completed) >= 1 && rec.totalOrders >= 2 && rec.lostDisputes === "0", `store reads the contract counters itself: ${rec.completed} of ${rec.totalOrders} completed, ${rec.lostDisputes} disputes lost`);
ok(rec.reviews && typeof rec.reviews.count === "number" && !rec.error, `store reads Arkiv with its own key: ${rec.reviews.count} verified review(s), ${rec.reviews.unmatchedIgnored} unmatched and ${rec.reviews.devIgnored} dev entries ignored`);

// ---------------------------------------------------------------- 7) seller CSV
const { sellerLoginMessage } = await import("../apps/web/src/lib/messages");
const nonce = (await http_(POP, "/api/auth/seller/nonce", { body: { address: sellerWallet.account.address } })).j.nonce;
const login = await fetch(`${POP}/api/auth/seller`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ address: sellerWallet.account.address, nonce, signature: await sellerWallet.signMessage({ message: sellerLoginMessage(sellerWallet.account.address, nonce) }) }),
});
ok(login.status === 200, "merchant seller signs in to the dashboard session");
const cookie = login.headers.get("set-cookie")!.split(";")[0];
const noAuth = await fetch(`${POP}/api/seller/orders.csv`);
ok(noAuth.status === 401, "CSV export without a seller session is rejected (401)");
const csvRes = await fetch(`${POP}/api/seller/orders.csv`, { headers: { cookie } });
const csv = await csvRes.text();
const lines = csv.trim().split("\r\n");
ok(csvRes.status === 200 && (csvRes.headers.get("content-type") ?? "").startsWith("text/csv"), "seller CSV export returns text/csv");
ok(lines[0].startsWith("order_id,state,"), "CSV header present");
const rowA = lines.find((l) => l.startsWith(`"${A.id}",`));
const rowB = lines.find((l) => l.startsWith(`"${B.id}",`));
ok(rowA && rowA.includes(A.payTx) && rowA.includes("Released") && rowA.includes("OrderReleased") && rowA.includes(A.ref), "CSV row for A: state Released, fund tx, release event + merchant ref");
const cols = (l: string) => l.slice(1, -1).split('","');
const ca = cols(rowA!);
ok(/^0x[0-9a-f]{64}$/.test(ca[11]) && /^0x[0-9a-f]{64}$/.test(ca[12]) && /^0x[0-9a-f]{64}$/.test(ca[14]), "CSV row for A carries ship, deliver and settle tx hashes");
ok(rowB && rowB.includes("Refunded") && rowB.includes("OrderRefunded") && cols(rowB)[11] === "", "CSV row for B: Refunded, no ship tx");
ok(!/Flat 1|Test Building|\+91/.test(csv), "CSV contains no buyer ship-to details");
if (FORK) {
  const C = await newSession("=2+2 formula test");
  const l = (await http_(POP, `/api/listings/${C.sessionId}`)).j.listing;
  const o = l.offer;
  const offer = { seller: o.seller as Hex, listingId: o.listingId as Hex, termsHash: o.termsHash as Hex, externalRef: o.externalRef as Hex, price: BigInt(o.price), shipWithin: Number(o.shipWithin), deliverWithin: Number(o.deliverWithin), maxUnits: Number(o.maxUnits), validUntil: BigInt(o.validUntil), version: BigInt(o.version) };
  await pub.waitForTransactionReceipt({ hash: await buyer.writeContract({ address: dep.token, abi: erc20Abi, functionName: "approve", args: [dep.checkout, offer.price] }) });
  await pub.waitForTransactionReceipt({ hash: await buyer.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "pay", args: [offer, l.offerSig, deliveryCodeHash(net.chain.id, dep.checkout, "one two three four five six")] }) });
  const csv2 = await (await fetch(`${POP}/api/seller/orders.csv`, { headers: { cookie } })).text();
  ok(csv2.includes(`"'=2+2 formula test"`) && !csv2.includes(`,"=2+2`), "CSV neutralises a title that starts with '=' (no formula injection)");
}
console.log(`\nE2E (MERCHANT, ${mode.toUpperCase()}) PASS: ${checks} checks`);
console.log(JSON.stringify({ mode, orderA: A.id.toString(), orderB: B.id.toString(), pay: { A: A.payTx, B: B.payTx } }));
