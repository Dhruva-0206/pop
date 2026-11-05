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
import { checkoutAbi, codeBytes, deliveryCodeHash, ORDER_STATES } from "../packages/shared/src/index";
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

async function buyerPays(): Promise<{ id: bigint; code: string; buyer: Hex }> {
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
    args: [offer, listing.listing.offerSig, deliveryCodeHash(net.chain.id, dep.checkout, code)],
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
  return { id, code, buyer: acct.address };
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
console.log(`\nE2E (LOCAL FORK) PASS · mode=${net.mode} chainId=${net.chain.id} checkout=${dep.checkout}`);
