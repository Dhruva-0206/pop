/**
 * LOCAL FORK end-to-end check of the Phase 2 ugly path, driving the same API routes and contract calls as the UI:
 * fresh TEST MODE buyer -> /api/faucet -> approve + pay (code hash only) -> /api/orders/confirm -> seller signs in
 * and marks shipped -> courier signs in, wrong code rejected, right code accepted -> time passes -> anyone finalizes
 * -> seller withdraws. Then a second order that is never shipped -> refund via finalize.
 * Needs: fork running, contracts deployed + seller seeded, web dev server on WEB_URL (default http://localhost:3000).
 * Usage: npx tsx scripts/e2e-fork.ts
 */
import { decodeEventLog, erc20Abi, keccak256, toHex, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http } from "viem";
import {
  APP_NAME,
  EIP712_VERSION,
  checkoutAbi,
  codeBytes,
  deliveryCodeHash,
  handleHash,
  listingIdHash,
  offerDomain,
  offerTypes,
  ORDER_STATES,
  registryAbi,
  termsHash,
} from "../packages/shared/src/index";
import { createStore } from "../packages/shared/src/server/store";
import { ReviewSchema, arkivReader, readSellerReviews } from "../packages/shared/src/server/arkiv";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { assertLocalAnvil, loadDeployment, net, pub, walletOf } from "./chain";
import { need, opt } from "./env";

await assertLocalAnvil();
const WEB = opt("WEB_URL") ?? "http://localhost:3000";
const dep = loadDeployment();
const jar: Record<string, string> = {};
async function api(path: string, body?: unknown, cookie?: string) {
  const r = await fetch(`${WEB}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", ...(cookie && jar[cookie] ? { cookie: jar[cookie] } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = r.headers.get("set-cookie");
  if (set) jar[set.split("=")[0]] = set.split(";")[0];
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
}
const words = () => Array.from(crypto.getRandomValues(new Uint16Array(6)), (n) => wordlist[n % 2048]).join(" ");
const state = async (id: bigint) =>
  ORDER_STATES[(await pub.readContract({ address: dep.checkout, abi: checkoutAbi, functionName: "getOrder", args: [id] })).state];
const warp = async (secs: number) => {
  await pub.request({ method: "evm_increaseTime" as never, params: [secs] as never });
  await pub.request({ method: "evm_mine" as never, params: [] as never });
};
const log = (s: string) => console.log(`✓ ${s}`);

const { j: listing } = await api("/api/listings/jhumka-01");
const o = listing.listing.offer;
const offer = {
  seller: o.seller as Hex,
  listingId: o.listingId as Hex,
  termsHash: o.termsHash as Hex,
  externalRef: o.externalRef as Hex,
  price: BigInt(o.price),
  shipWithin: Number(o.shipWithin),
  deliverWithin: Number(o.deliverWithin),
  maxUnits: Number(o.maxUnits),
  validUntil: BigInt(o.validUntil),
  version: BigInt(o.version),
};

async function buyerPays(
  useOffer: typeof offer = offer,
  useSig: Hex = listing.listing.offerSig,
): Promise<{ id: bigint; code: string; buyer: Hex; acct: ReturnType<typeof privateKeyToAccount> }> {
  const acct = privateKeyToAccount(generatePrivateKey());
  const w = createWalletClient({ chain: net.chain, transport: http(net.rpcUrl), account: acct });
  const f = await api("/api/faucet", { address: acct.address });
  if (f.status !== 200) throw new Error(`faucet ${f.status} ${JSON.stringify(f.j)}`);
  const code = words();
  const a = await w.writeContract({ address: dep.token, abi: erc20Abi, functionName: "approve", args: [dep.checkout, offer.price] });
  await pub.waitForTransactionReceipt({ hash: a });
  const tx = await w.writeContract({
    address: dep.checkout,
    abi: checkoutAbi,
    functionName: "pay",
    args: [useOffer, useSig, deliveryCodeHash(net.chain.id, dep.checkout, code)],
  });
  const rc = await pub.waitForTransactionReceipt({ hash: tx });
  let id = 0n;
  for (const l of rc.logs) {
    try {
      const ev = decodeEventLog({ abi: checkoutAbi, data: l.data, topics: l.topics });
      if (ev.eventName === "OrderFunded") id = ev.args.orderId;
    } catch {
      /* token log */
    }
  }
  const { orderRegisterMessage } = await import("../apps/web/src/lib/messages");
  const delivery = { name: "Arjun (test)", phone: "+91 90000 00000", address: "Flat 1, Test Building, Mumbai" };
  // A stranger (not the buyer) must not be able to pre-register the order with fake ship-to details.
  const stranger = privateKeyToAccount(generatePrivateKey());
  const fake = { name: "Fake", phone: "00000", address: "Fake address nowhere" };
  const denied = await api("/api/orders/confirm", {
    txHash: tx,
    delivery: fake,
    signature: await stranger.signMessage({ message: orderRegisterMessage(tx, fake) }),
  });
  if (denied.status !== 403) throw new Error(`non-buyer registration not rejected: ${denied.status}`);
  const c = await api("/api/orders/confirm", {
    txHash: tx,
    delivery,
    signature: await acct.signMessage({ message: orderRegisterMessage(tx, delivery) }),
  });
  if (c.j.orderId !== id.toString()) throw new Error(`confirm mismatch ${JSON.stringify(c.j)}`);
  const again = await api("/api/orders/confirm", {
    txHash: tx,
    signature: await acct.signMessage({ message: orderRegisterMessage(tx, undefined) }),
  });
  if (again.j.fresh !== false) throw new Error("confirm not idempotent");
  return { id, code, buyer: acct.address, acct };
}

// ---------------- happy path ----------------
const A = await buyerPays();
log(`order #${A.id} paid (${await state(A.id)}); confirm stored once, second confirm idempotent`);

const seller = walletOf("SELLER_PK");
const { sellerLoginMessage } = await import("../apps/web/src/lib/messages");
const { j: nj } = await api("/api/auth/seller/nonce", { address: seller.account.address });
const sig = await seller.signMessage({ message: sellerLoginMessage(seller.account.address, nj.nonce) });
const login = await api("/api/auth/seller", { address: seller.account.address, nonce: nj.nonce, signature: sig });
if (login.status !== 200) throw new Error(`seller login ${JSON.stringify(login.j)}`);
const replay = await api("/api/auth/seller", { address: seller.account.address, nonce: nj.nonce, signature: sig });
if (replay.status !== 401) throw new Error("login replay not rejected");
const so = await api("/api/seller/orders", undefined, "pop_seller");
const mine = so.j.orders.find((x: { orderId: string }) => x.orderId === A.id.toString());
if (!mine?.delivery?.address) throw new Error("seller can't see decrypted delivery details");
log(`seller signed in; sees order #${A.id} with decrypted ship-to (${mine.delivery.name})`);
await api("/api/seller/tracking", { orderId: A.id.toString(), trackingNo: "DTDC-TEST-123" }, "pop_seller");
const ship = await seller.writeContract({
  address: dep.checkout,
  abi: checkoutAbi,
  functionName: "markShipped",
  args: [A.id, keccak256(toHex("DTDC-TEST-123"))],
});
await pub.waitForTransactionReceipt({ hash: ship });
log(`seller marked shipped (${await state(A.id)})`);

const bad = await api("/api/courier/login", { passcode: "wrong" });
if (bad.status !== 401) throw new Error("courier passcode not enforced");
await api("/api/courier/login", { passcode: need("COURIER_PASSCODE") });
await api("/api/courier/status", { orderId: A.id.toString(), status: "Out for delivery" }, "pop_courier");
const wrong = await api("/api/courier/deliver", { orderId: A.id.toString(), code: words() }, "pop_courier");
if (wrong.status !== 400) throw new Error("wrong code accepted?!");
log(`courier: wrong code rejected by the contract ("${wrong.j.error}")`);
const right = await api("/api/courier/deliver", { orderId: A.id.toString(), code: `  ${A.code.toUpperCase()} ` }, "pop_courier");
if (!right.j.ok) throw new Error(`deliver failed ${JSON.stringify(right.j)}`);
log(`courier: buyer's code accepted (normalised) -> ${await state(A.id)}`);

const early = await api(`/api/orders/${A.id}`);
if (early.j.order.canFinalize) throw new Error("finalize allowed too early");
await warp(130); // past the 120 s default window
const anyone = createWalletClient({ chain: net.chain, transport: http(net.rpcUrl), account: privateKeyToAccount(generatePrivateKey()) });
await pub.request({ method: "anvil_setBalance" as never, params: [anyone.account.address, "0x16345785D8A0000"] as never });
const fin = await anyone.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "finalize", args: [A.id] });
await pub.waitForTransactionReceipt({ hash: fin });
log(`a random wallet finalized after the window -> ${await state(A.id)}`);
const before = await pub.readContract({ address: dep.token, abi: erc20Abi, functionName: "balanceOf", args: [seller.account.address] });
const wd = await seller.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "withdraw" });
await pub.waitForTransactionReceipt({ hash: wd });
const after = await pub.readContract({ address: dep.token, abi: erc20Abi, functionName: "balanceOf", args: [seller.account.address] });
log(`seller withdrew ${(Number(after - before) / 10 ** dep.tokenDecimals).toFixed(2)} test USDT (price minus 1% fee)`);

// ---------------- never shipped -> refund ----------------
const B = await buyerPays();
await warp(190); // past the 180 s ship-by
const fin2 = await anyone.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "finalize", args: [B.id] });
await pub.waitForTransactionReceipt({ hash: fin2 });
const bBefore = await pub.readContract({ address: dep.token, abi: erc20Abi, functionName: "balanceOf", args: [B.buyer] });
const push = await anyone.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "withdrawFor", args: [B.buyer] });
await pub.waitForTransactionReceipt({ hash: push });
const bAfter = await pub.readContract({ address: dep.token, abi: erc20Abi, functionName: "balanceOf", args: [B.buyer] });
log(`order #${B.id} never shipped -> ${await state(B.id)}; buyer got ${(Number(bAfter - bBefore) / 10 ** dep.tokenDecimals).toFixed(2)} back`);

// ---------------- handover refused -> dispute (no money moves) ----------------
const C = await buyerPays();
const ship2 = await seller.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "markShipped", args: [C.id, keccak256(toHex("T2"))] });
await pub.waitForTransactionReceipt({ hash: ship2 });
const ref = await api("/api/courier/refused", { orderId: C.id.toString() }, "pop_courier");
if (!ref.j.ok) throw new Error(`refused failed ${JSON.stringify(ref.j)}`);
log(`order #${C.id}: courier reported handover refused -> ${await state(C.id)} (no payout)`);
void codeBytes;

// ---------------- full review: rating + text -> Arkiv readonly entity -> owned by the buyer ----------------
const { reviewAuthMessage, reviewRetryMessage } = await import("../apps/web/src/lib/messages");
const cfgJson = (await api("/api/config")).j;
const HANDLE = "meera.jewels";
const attestorAddr = walletOf("ATTESTOR_PK").account.address;
type Signer = { signMessage: (a: { message: string }) => Promise<Hex> };
const reviewBody = async (signer: Signer, id: bigint, rating: number, text: string, extra: object = { skipWorld: true }) => ({
  seller: HANDLE,
  orderId: id.toString(),
  rating,
  text,
  buyerSignature: await signer.signMessage({ message: reviewAuthMessage(id.toString(), HANDLE, rating, text) }),
  ...extra,
});
const rejected = (label: string, r: { status: number }, want: number) => {
  if (r.status !== want) throw new Error(`${label}: expected ${want}, got ${r.status}`);
  log(`review rejected as expected: ${label} (${want})`);
};

if (!cfgJson.devSkipWorld) {
  console.log("\nSKIPPED review + ban sections: start the web server with POP_DEV_SKIP_WORLD=1 (local dev only) to cover the Arkiv review path.");
} else {
  const longText = "Lovely jhumkas, packed well and arrived on time. Código ₹ é ✓. ".repeat(8).slice(0, 480);
  rejected("rating 6", await api("/api/world/verify-review", await reviewBody(A.acct, A.id, 6, "x")), 400);
  rejected("text over 500 chars", await api("/api/world/verify-review", await reviewBody(A.acct, A.id, 5, "y".repeat(501))), 400);
  rejected("no World proof and no dev skip", await api("/api/world/verify-review", await reviewBody(A.acct, A.id, 5, "z", {})), 400);
  rejected("Refunded order", await api("/api/world/verify-review", await reviewBody(B.acct, B.id, 5, "nope")), 409);
  rejected("Disputed order", await api("/api/world/verify-review", await reviewBody(C.acct, C.id, 5, "nope")), 409);
  const impostor = privateKeyToAccount(generatePrivateKey());
  rejected("non-buyer signature", await api("/api/world/verify-review", await reviewBody(impostor, A.id, 5, longText)), 403);
  const tampered = { ...(await reviewBody(A.acct, A.id, 5, longText)), rating: 1 }; // buyer signed rating 5
  rejected("rating changed after signing", await api("/api/world/verify-review", tampered), 403);

  const ok = await api("/api/world/verify-review", await reviewBody(A.acct, A.id, 5, longText));
  if (ok.status !== 200 || ok.j.status !== "synced" || !ok.j.arkivKey) throw new Error(`review failed: ${JSON.stringify(ok.j)}`);
  if (!ok.j.devSkippedWorld) throw new Error("expected the DEV flag path");
  const key = ok.j.arkivKey as Hex;
  log(`review for #${A.id} accepted + published: entity ${key.slice(0, 12)}… (DEV: World proof skipped)`);
  rejected("second review for the same order", await api("/api/world/verify-review", await reviewBody(A.acct, A.id, 4, "again")), 409);

  const reader = arkivReader(need("ARKIV_ACCESS_KEY"));
  const ent = await reader.getEntity(key, ReviewSchema);
  const sellerAddr = walletOf("SELLER_PK").account.address;
  if (ent.$creator?.toLowerCase() !== attestorAddr.toLowerCase()) throw new Error("creator is not the attestor");
  if (ent.$owner?.toLowerCase() !== A.buyer.toLowerCase()) throw new Error("owner is not the buyer");
  if (!ent.$creationFlags?.readonly) throw new Error("entity is not readonly");
  if (Number(ent.rating.value) !== 5 || String(ent.seller.value).toLowerCase() !== sellerAddr.toLowerCase()) throw new Error("entity fields wrong");
  if (!String(ent.reviewer_key.value).startsWith("dev-")) throw new Error("dev review must carry a dev- reviewer key");
  // buyer_history comes from the orders table: buckets 1, 2-5, 6+ (stored as the bucket's lower bound).
  const { historyBucket } = await import("../packages/shared/src/server/store");
  const bucketsOk = [historyBucket(1), historyBucket(2), historyBucket(5), historyBucket(6), historyBucket(40)].join(",") === "1,2,2,6,6";
  if (!bucketsOk) throw new Error("historyBucket boundaries wrong");
  const buyerOrders = await createStore("fork").buyerOrderCount(A.buyer);
  if (buyerOrders !== 1 || Number(ent.buyer_history.value) !== historyBucket(buyerOrders)) {
    throw new Error(`buyer_history wrong: orders=${buyerOrders} entity=${String(ent.buyer_history.value)}`);
  }
  const raw = ent.text.value as unknown;
  const textBack = typeof raw === "string" && raw.startsWith("0x") ? Buffer.from(raw.slice(2), "hex").toString("utf8") : String(raw);
  if (textBack !== longText.trim()) throw new Error("review text mismatch on Arkiv");
  log("Arkiv entity: creator = attestor, owner = buyer, readonly, rating/text match what the buyer signed");

  // Retry without a second nullifier row: mark the row failed (as if the write had died), then retry.
  const db = createStore("fork"); // Postgres, schema pop_fork: the same database the web server uses
  const claimsBefore = await db.reviewClaimCount();
  await db.patchReview(A.id.toString(), { status: "failed", arkivKey: undefined, error: "simulated failure" });
  const retryBody = async (signer: Signer) => ({
    seller: HANDLE,
    orderId: A.id.toString(),
    buyerSignature: await signer.signMessage({ message: reviewRetryMessage(A.id.toString(), HANDLE) }),
  });
  rejected("retry by a non-buyer", await api("/api/reviews/retry", await retryBody(impostor)), 403);
  const rt = await api("/api/reviews/retry", await retryBody(A.acct));
  if (rt.j.status !== "synced" || rt.j.arkivKey !== key) throw new Error(`retry did not reuse the entity: ${JSON.stringify(rt.j)}`);
  if ((await db.reviewClaimCount()) !== claimsBefore) throw new Error("retry created a second nullifier claim");
  // Order ids restart on every fork/deployment, so entities from earlier runs can share (order id, seller): match the payment tx too.
  const payTxA = (await db.order(A.id.toString()))?.fundTx.toLowerCase();
  const sameOrderId = (await readSellerReviews(need("ARKIV_ACCESS_KEY"), attestorAddr, sellerAddr)).rows.filter((r) => r.orderId === A.id.toString());
  const mine = sameOrderId.filter((r) => r.payTx.toLowerCase() === payTxA);
  if (mine.length !== 1) throw new Error(`expected exactly 1 Arkiv entity for this payment, found ${mine.length}`);
  if (sameOrderId.length > 1) log(`(${sameOrderId.length - 1} older Arkiv entit${sameOrderId.length === 2 ? "y" : "ies"} share order id #${A.id} from earlier fork runs: ignored because their payment tx differs)`);
  log("failed write retried: same entity key, no second Arkiv entity, no second nullifier claim");

  // /verify data: contract counters + Arkiv, dev reviews kept out of the verified count.
  const v = await api(`/api/verify/${HANDLE}`);
  if (v.status !== 200 || !v.j.registered) throw new Error("verify: seller should be registered");
  const total = v.j.counters.totalOrders as number;
  const completedN = Number(v.j.counters.completed);
  if (!(completedN >= 1 && total >= completedN)) throw new Error("verify: counters/denominator wrong");
  if (v.j.reviews.verified.items.some((r: { key: string }) => r.key === key)) throw new Error("dev review counted as verified");
  if (v.j.reviews.dev.count < 1) throw new Error("dev review not listed separately");
  log(`/api/verify/${HANDLE}: ${completedN} of ${total} orders completed; ${v.j.reviews.verified.count} verified reviews, ${v.j.reviews.dev.count} DEV test review(s) shown separately`);
  rejected("unknown handle on /verify", await api("/api/verify/nobody.here.x"), 404);

  // ---- banned seller: /verify goes red, arbiter force-refunds the open order, buyer gets the money back ----
  const sAcct = privateKeyToAccount(generatePrivateKey());
  const bHandle = `banme.t${Math.floor(Math.random() * 1e6)}`;
  const attestorW = walletOf("ATTESTOR_PK");
  const sW = createWalletClient({ chain: net.chain, transport: http(net.rpcUrl), account: sAcct });
  await pub.request({ method: "anvil_setBalance" as never, params: [sAcct.address, "0x16345785D8A0000"] as never });
  const nonce = BigInt(Date.now());
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const regSig = await attestorW.signTypedData({
    domain: { name: APP_NAME, version: EIP712_VERSION, chainId: net.chain.id, verifyingContract: dep.registry },
    types: {
      Registration: [
        { name: "seller", type: "address" },
        { name: "handleHash", type: "bytes32" },
        { name: "handleTier", type: "uint8" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint64" },
      ],
    },
    primaryType: "Registration",
    message: { seller: sAcct.address, handleHash: handleHash(bHandle), handleTier: 1, nonce, deadline },
  });
  await pub.waitForTransactionReceipt({
    hash: await sW.writeContract({
      address: dep.registry,
      abi: registryAbi,
      functionName: "registerSeller",
      args: [sAcct.address, handleHash(bHandle), 1, nonce, deadline, regSig],
    }),
  });
  const okV = await api(`/api/verify/${bHandle}`);
  if (okV.status !== 200) throw new Error("throwaway seller should be registered before the ban");
  const terms = { title: "ban test", priceInr: 1, shipWithinSec: 180, deliverWithinSec: 300, returnPolicy: "n/a" };
  const bOffer = { ...offer, seller: sAcct.address, listingId: listingIdHash(bHandle), termsHash: termsHash(terms), maxUnits: 5 };
  const bSig = await sW.signTypedData({ domain: offerDomain(net.chain.id, dep.checkout), types: offerTypes, primaryType: "Offer", message: bOffer });
  const D = await buyerPays(bOffer, bSig);
  log(`order #${D.id} paid to throwaway seller @${bHandle} (${await state(D.id)})`);
  const arbiterW = walletOf("ARBITER_PK");
  await pub.request({ method: "anvil_setBalance" as never, params: [arbiterW.account.address, "0x16345785D8A0000"] as never });
  await pub.waitForTransactionReceipt({ hash: await arbiterW.writeContract({ address: dep.registry, abi: registryAbi, functionName: "ban", args: [sAcct.address] }) });
  const red = await api(`/api/verify/${bHandle}`);
  if (red.status !== 404 || red.j.registered !== false || red.j.reason !== "banned") throw new Error(`banned handle should be red: ${JSON.stringify(red.j)}`);
  log(`/api/verify/${bHandle}: 404 registered=false reason=banned (red "Not a registered seller" page)`);
  let nonArbiterBlocked = false;
  await anyone.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "forceRefundBanned", args: [D.id] }).catch(() => (nonArbiterBlocked = true));
  if (!nonArbiterBlocked) throw new Error("non-arbiter force refund was not blocked");
  const before2 = await pub.readContract({ address: dep.token, abi: erc20Abi, functionName: "balanceOf", args: [D.buyer] });
  await pub.waitForTransactionReceipt({ hash: await arbiterW.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "forceRefundBanned", args: [D.id] }) });
  await pub.waitForTransactionReceipt({ hash: await anyone.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "withdrawFor", args: [D.buyer] }) });
  const after2 = await pub.readContract({ address: dep.token, abi: erc20Abi, functionName: "balanceOf", args: [D.buyer] });
  if ((await state(D.id)) !== "Refunded" || after2 - before2 !== offer.price) throw new Error("force refund did not return the full price to the buyer");
  log(`arbiter force-refunded open order #${D.id} of the banned seller: buyer got ${(Number(after2 - before2) / 10 ** dep.tokenDecimals).toFixed(2)} back; a non-arbiter was blocked`);
}

// ================= Pass 3: dispute flow, arbiter API, onboarding, badge, proof page =================
{
  const chk = (cond: unknown, s: string) => {
    if (!cond) throw new Error(`FAIL: ${s}`);
    log(s);
  };
  const sellerW = walletOf("SELLER_PK");
  const courierW = walletOf("COURIER_PK");
  const arbW = walletOf("ARBITER_PK");
  const walletFor = (acct: ReturnType<typeof privateKeyToAccount>) => createWalletClient({ chain: net.chain, transport: http(net.rpcUrl), account: acct });

  // ---- buyer reports a problem inside the window, arbiter resolves with a split
  const E = await buyerPays();
  await pub.waitForTransactionReceipt({ hash: await sellerW.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "markShipped", args: [E.id, keccak256(toHex("T-DISPUTE"))] }) });
  await pub.waitForTransactionReceipt({ hash: await courierW.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "confirmDelivery", args: [E.id, codeBytes(E.code)] }) });
  chk((await state(E.id)) === "Delivered", `dispute test: order #${E.id} delivered`);
  const reason = "The parcel was empty (test dispute).";
  const buyerW = walletFor(E.acct);
  await api("/api/arbiter/disputes"); // warms the server's block-number cache: the reason POST right after openDispute must still see the new block (regression: viem caches getBlockNumber for 4 s)
  await pub.waitForTransactionReceipt({ hash: await buyerW.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "openDispute", args: [E.id, keccak256(toHex(reason))] }) });
  chk((await state(E.id)) === "Disputed", "buyer's openDispute inside the window -> Disputed");
  const { disputeReasonMessage } = await import("../apps/web/src/lib/messages");
  const strangerAcct = privateKeyToAccount(generatePrivateKey());
  const badSig = await api(`/api/orders/${E.id}/dispute`, { text: reason, signature: await strangerAcct.signMessage({ message: disputeReasonMessage(E.id.toString(), reason) }) });
  chk(badSig.status === 403, "dispute reason signed by a non-buyer is rejected (403)");
  const other = "A different text than the one hashed on-chain.";
  const mismatch = await api(`/api/orders/${E.id}/dispute`, { text: other, signature: await E.acct.signMessage({ message: disputeReasonMessage(E.id.toString(), other) }) });
  chk(mismatch.status === 409, "dispute reason that does not match the on-chain evidence hash is rejected (409)");
  const goodReason = await api(`/api/orders/${E.id}/dispute`, { text: reason, signature: await E.acct.signMessage({ message: disputeReasonMessage(E.id.toString(), reason) }) });
  chk(goodReason.status === 200, "the buyer's matching, signed reason is saved");
  const list = (await api("/api/arbiter/disputes")).j.disputes as { orderId: string; kind: string; reason: string | null; sellerHandle: string | null }[];
  const mine = list.find((d) => d.orderId === E.id.toString());
  chk(mine && mine.kind === "buyer-dispute" && mine.reason === reason, "arbiter page API lists the dispute with the buyer's reason");
  const handover = list.find((d) => d.orderId !== E.id.toString());
  void handover; // the earlier handover-refused order (Disputed too) is listed as well
  chk(list.some((d) => d.kind === "handover-refused"), "arbiter page API also lists the courier's handover-refused dispute");
  await pub.waitForTransactionReceipt({ hash: await arbW.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "resolveDispute", args: [E.id, 5000, keccak256(toHex("split 50/50 (test)"))] }) });
  chk((await state(E.id)) === "Split", "arbiter resolved the dispute 50/50 -> Split");
  chk(!((await api("/api/arbiter/disputes")).j.disputes as { orderId: string }[]).some((d) => d.orderId === E.id.toString()), "a resolved dispute leaves the arbiter list");
  const lookup = await api("/api/arbiter/seller?handle=meera.jewels");
  chk(lookup.status === 200 && lookup.j.active === true && lookup.j.banned === false && Array.isArray(lookup.j.openOrders), "arbiter seller lookup returns standing and open orders");
  chk((await api("/api/arbiter/seller?handle=nobody.here.zz")).status === 404, "arbiter lookup of an unknown handle -> 404");

  // ---- /onboard: bio code -> staff approval -> on-chain registration -> one signed product -> link, badge
  const { onboardRequestMessage } = await import("../apps/web/src/lib/messages");
  const nw = privateKeyToAccount(generatePrivateKey());
  const nwW = walletFor(nw);
  await pub.request({ method: "anvil_setBalance" as never, params: [nw.address, "0x16345785D8A0000"] as never });
  const oh = `onb${Math.random().toString(36).slice(2, 8)}`;
  chk((await api("/api/staff/onboard")).status === 401, "staff list needs a staff session");
  const strangerReq = await api("/api/onboard/request", { handle: oh, wallet: nw.address, signature: await strangerAcct.signMessage({ message: onboardRequestMessage(oh, nw.address) }) });
  chk(strangerReq.status === 403, "onboarding request not signed by the wallet is rejected (403)");
  // One human, one shop: a request needs a World ID proof for the handle (this dev server skips it with POP_DEV_SKIP_WORLD=1).
  const noProof = await api("/api/onboard/request", { handle: `@${oh}`, wallet: nw.address, signature: await nw.signMessage({ message: onboardRequestMessage(oh, nw.address) }) });
  chk(noProof.status === 400 && /proof required/i.test(String(noProof.j.error)), "onboarding request without a World ID proof is refused (400)");
  const req1 = await api("/api/onboard/request", { handle: `@${oh}`, wallet: nw.address, skipWorld: true, signature: await nw.signMessage({ message: onboardRequestMessage(oh, nw.address) }) });
  chk(req1.status === 201 && /^POP-[0-9A-F]{6}$/.test(req1.j.bioCode), `onboarding request created, bio code ${req1.j.bioCode}`);
  const thief = privateKeyToAccount(generatePrivateKey());
  const dupHandle = await api("/api/onboard/request", { handle: oh, wallet: thief.address, skipWorld: true, signature: await thief.signMessage({ message: onboardRequestMessage(oh, thief.address) }) });
  chk(dupHandle.status === 409, "the same handle requested by another wallet is rejected (409)");
  const takenHandle = await api("/api/onboard/request", { handle: "meera.jewels", wallet: thief.address, signature: await thief.signMessage({ message: onboardRequestMessage("meera.jewels", thief.address) }) });
  chk(takenHandle.status === 409, "an already registered handle cannot be requested (409)");
  const st1 = await api(`/api/onboard/status?wallet=${nw.address}`);
  chk(st1.j.status === "pending" && !st1.j.registration, "status is pending with no registration yet");

  const mkListing = async (acct: ReturnType<typeof privateKeyToAccount>, slug: string, signer = acct) => {
    const t = { title: "Onboarding test product", priceInr: 499, shipWithinSec: 180, deliverWithinSec: 300, returnPolicy: "Report a problem within the window." };
    const o = { seller: acct.address, listingId: listingIdHash(slug), termsHash: termsHash(t), externalRef: `0x${"00".repeat(32)}` as Hex, price: 1_000_000n, shipWithin: 180, deliverWithin: 300, maxUnits: 5, validUntil: BigInt(Math.floor(Date.now() / 1000) + 6 * 86400), version: 1n };
    const sig = await walletFor(signer).signTypedData({ domain: offerDomain(net.chain.id, dep.checkout), types: offerTypes, primaryType: "Offer", message: o });
    return api("/api/onboard/listing", { slug, terms: t, offerSig: sig, offer: { ...o, price: o.price.toString(), validUntil: o.validUntil.toString(), version: o.version.toString() } });
  };
  const early = await mkListing(nw, `${oh}-early`);
  chk(early.status === 403, "a product before approval is rejected (403)");

  const pend = (await api("/api/staff/onboard", undefined, "pop_courier")).j.pending as { id: number; handle: string }[];
  const row = pend.find((p) => p.handle === oh);
  chk(row, "staff (team passcode) sees the pending request");
  chk((await api("/api/staff/onboard", { id: row!.id, approve: true })).status === 401, "approving without a staff session is rejected (401)");
  chk((await api("/api/staff/onboard", { id: row!.id, approve: true }, "pop_courier")).j.status === "approved", "staff approved: the attestor signed the registration");
  chk((await api("/api/staff/onboard", { id: row!.id, approve: true }, "pop_courier")).status === 404, "a decided request cannot be decided again");
  const st2 = await api(`/api/onboard/status?wallet=${nw.address}`);
  const rg = st2.j.registration;
  chk(st2.j.status === "approved" && rg?.signature, "status is approved with the signed registration");
  const preReg = await mkListing(nw, `${oh}-pre`);
  chk(preReg.status === 403, "a product before the on-chain registration is rejected (403: not an active seller)");
  await pub.waitForTransactionReceipt({ hash: await nwW.writeContract({ address: dep.registry, abi: registryAbi, functionName: "registerSeller", args: [rg.seller, rg.handleHash, rg.handleTier, BigInt(rg.nonce), BigInt(rg.deadline), rg.signature] }) });
  chk(await pub.readContract({ address: dep.registry, abi: registryAbi, functionName: "isActive", args: [nw.address] }), "the new seller registered on-chain with the attestor's signature (tier 1)");

  const slug = `${oh}-product`;
  const forged = await mkListing(nw, `${oh}-forged`, privateKeyToAccount(generatePrivateKey()));
  chk(forged.status === 403, "an offer signed by another key is rejected (403)");
  const made = await mkListing(nw, slug);
  chk(made.status === 201 && made.j.link === `/p/${slug}`, `the seller's one product is live at ${made.j.link}`);
  chk((await mkListing(nw, `${oh}-second`)).status === 409, "a second product is rejected: one product per seller (409)");
  const pub1 = await api(`/api/listings/${slug}`);
  chk(pub1.status === 200 && pub1.j.listing.sellerHandle === oh && pub1.j.termsHashMatches === true, "the checkout page API serves the new listing with matching terms");
  const badge = await fetch(`${WEB}/api/badge/${oh}`);
  const svg = await badge.text();
  chk(badge.status === 200 && (badge.headers.get("content-type") ?? "").startsWith("image/svg+xml") && svg.includes("Protected by PoP") && svg.includes("0 of 0"), "the badge is an SVG showing 0 of 0 protected orders");
  const redBadge = await fetch(`${WEB}/api/badge/nobody.here.zz`);
  chk(redBadge.status === 404 && (await redBadge.text()).includes("Not a registered seller"), "the badge for an unknown handle is the red 'Not a registered seller'");
  const evil = await fetch(`${WEB}/api/badge/${encodeURIComponent('x"><script>')}`);
  chk(evil.status === 404 && !(await evil.text()).includes("<script"), "a hostile handle in the badge URL is refused and not echoed");
  const dark = await fetch(`${WEB}/api/badge/${oh}?theme=dark`);
  const darkSvg = await dark.text();
  chk(dark.status === 200 && darkSvg.includes(`@${oh}`) && darkSvg.includes("<title>Protected by PoP"), "the dark badge returns 200 with the handle and a full-sentence title");
  const longBadge = await fetch(`${WEB}/api/badge/${"z".repeat(30)}`);
  const longW = Number((await longBadge.text()).match(/<svg[^>]* width="(\d+)"/)?.[1] ?? 0);
  chk(longBadge.status === 404 && longW >= 240 && longW <= 420, `a 30-character handle's badge stays between 240 and 420 px wide (${longW})`);

  // ---- pages render
  for (const path of ["/onboard", "/arbiter", "/proof", `/p/${slug}`]) {
    const r = await fetch(`${WEB}${path}`);
    chk(r.status === 200, `GET ${path} -> 200`);
  }
  const proof = await (await fetch(`${WEB}/proof`)).text();
  chk(proof.includes("Contracts (live)") && proof.includes(dep.checkout) && proof.includes("World ID verification log"), "/proof shows the live contract addresses and the World log section");
  if (cfgJson.devSkipWorld) chk(proof.includes("dev-skipped"), "/proof's World log lists the DEV-skipped review attempts (no secrets)");
}

console.log(`\nE2E (LOCAL FORK) PASS · mode=${net.mode} chainId=${net.chain.id} checkout=${dep.checkout}`);
