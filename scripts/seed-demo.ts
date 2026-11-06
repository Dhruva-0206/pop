/**
 * Seeds the demo scenes (see docs/demo-script.md) on the current NETWORK_MODE. Idempotent: a scene that already exists in the
 * wanted state is skipped, so it is safe to run again before a demo. Prints order numbers and links, never keys.
 *
 *   scene 1  expiring   @meera.jewels order, Funded, never shipped: ship-by passes about 3 minutes after the run (refund scene)
 *   scene 2  delivered  @meera.jewels order, Delivered, dispute window open for a short time (report-a-problem scene)
 *   scene 3  disputed   @meera.jewels order, Disputed by the courier ("handover refused") waiting for the arbiter (5 minutes)
 *   scene 4  banned     @bad.bazaar: registered, one open order, then banned by the arbiter (force refund scene)
 *   scene 5  fake       @meera.jewels.official: a listing for a handle that is NOT registered (red warning scene)
 *
 * Because the windows are short and real, run it a few minutes before the segment that needs each scene.
 *
 * Needs the web app running on WEB_URL (default http://localhost:3000) in the same NETWORK_MODE, and the demo seller already
 * seeded (`npm run seed` / `npm run fork:up`). On testnet it sends a handful of real test transactions (about 0.02 WBT) and
 * refuses to run unless you pass  ALLOW_DEMO_SEED=yes.
 * Usage:  npx tsx scripts/seed-demo.ts --scenes=all   (fork: every scene)
 *         NETWORK_MODE=testnet ALLOW_DEMO_SEED=yes npx tsx scripts/seed-demo.ts   (default --scenes=persistent: scenes 4 and 5 only)
 *         --scenes=1,2,3 runs the timed scenes; do that only minutes before the segment that needs them.
 */
import { createWalletClient, decodeEventLog, erc20Abi, getAddress, http, keccak256, parseEther, toHex, zeroHash, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import {
  APP_NAME,
  EIP712_VERSION,
  checkoutAbi,
  deliveryCodeHash,
  codeBytes,
  handleHash,
  listingIdHash,
  offerDomain,
  offerTypes,
  registryAbi,
  termsHash,
  ORDER_STATES,
  type Terms,
} from "../packages/shared/src/index";
import { createStore } from "../packages/shared/src/server/store";
import { loadDeployment, mode, net, pub, walletOf } from "./chain";
import { need, opt } from "./env";

if (mode === "testnet" && opt("ALLOW_DEMO_SEED") !== "yes") {
  throw new Error("Testnet seeding sends real test transactions: set ALLOW_DEMO_SEED=yes for this run.");
}
const WEB = opt("WEB_URL") ?? "http://localhost:3000";
const dep = loadDeployment();
const store = createStore(mode);
const seller = walletOf("SELLER_PK");
const buyer = walletOf("TEST_BUYER_PK");
const courier = walletOf("COURIER_PK");
const arbiter = walletOf("ARBITER_PK");
const attestor = walletOf("ATTESTOR_PK");
const buyerAcct = privateKeyToAccount(need("TEST_BUYER_PK") as Hex);
const now = () => Math.floor(Date.now() / 1000);
const wait = (hash: Hex) => pub.waitForTransactionReceipt({ hash });
const getOrder = (id: bigint) => pub.readContract({ address: dep.checkout, abi: checkoutAbi, functionName: "getOrder", args: [id] });
const words = () => Array.from(crypto.getRandomValues(new Uint16Array(6)), (n) => wordlist[n % 2048]).join(" ");
const out: string[] = [];
// --scenes=persistent (default: 4 and 5, which stay valid until someone acts on them), --scenes=all, or a list such as --scenes=1,3.
// Scenes 1 to 3 are TIMED (ship-by, problem window and arbiter timeout are real seconds), so they never run unless asked for.
const scenesArg = process.argv.find((a) => a.startsWith("--scenes="))?.split("=")[1] ?? "persistent";
const wanted = new Set<number>(scenesArg === "all" ? [1, 2, 3, 4, 5] : scenesArg === "persistent" ? [4, 5] : scenesArg.split(",").map(Number));
const want = (n: number) => wanted.has(n);
console.log(`scenes to seed: ${[...wanted].sort().join(", ")} (${scenesArg})`);
const walletFromKey = (pk: Hex) => createWalletClient({ chain: net.chain, transport: http(net.rpcUrl), account: privateKeyToAccount(pk) });

async function fundGas(to: Hex) {
  if ((await pub.getBalance({ address: to })) > parseEther("0.005")) return;
  if (mode === "fork") {
    await pub.request({ method: "anvil_setBalance" as never, params: [to, "0x16345785D8A0000"] as never });
  } else {
    await wait(await walletOf("DEPLOYER_PK").sendTransaction({ to, value: parseEther("0.02") }));
  }
}

const TERMS = (title: string, price: number): Terms => ({
  title,
  priceInr: price,
  shipWithinSec: 180,
  deliverWithinSec: 300,
  returnPolicy: "Report a problem within the window after delivery; the arbiter decides refund, release or split.",
});

/** Seller-signed offer + listing in the app database (same as scripts/seed-seller.ts, one per scene). */
async function ensureListing(slug: string, handle: string, signer: ReturnType<typeof walletFromKey>, title: string, inr: number) {
  if (await store.listing(slug)) return;
  const addr = signer.account.address;
  const terms = TERMS(title, inr);
  const offer = {
    seller: addr,
    listingId: listingIdHash(slug),
    termsHash: termsHash(terms),
    externalRef: zeroHash,
    price: 1_000_000n,
    shipWithin: terms.shipWithinSec,
    deliverWithin: terms.deliverWithinSec,
    maxUnits: 200,
    validUntil: BigInt(now() + 6 * 86400),
    version: 1n,
  };
  const offerSig = await signer.signTypedData({ domain: offerDomain(net.chain.id, dep.checkout), types: offerTypes, primaryType: "Offer", message: offer });
  await store.upsertListing({
    id: slug,
    sellerWallet: getAddress(addr),
    sellerHandle: handle,
    title,
    imageUrl: undefined,
    priceUnits: offer.price.toString(),
    priceInr: inr,
    terms,
    termsHash: offer.termsHash,
    offer: { ...offer, price: offer.price.toString(), validUntil: offer.validUntil.toString(), version: offer.version.toString() },
    offerSig,
    active: true,
    createdAt: new Date().toISOString(),
  });
}

/** Buyer pays the listing's offer, registers the order with the app (buyer-signed). Returns the order id and the code. */
async function buy(slug: string): Promise<{ id: bigint; code: string; payTx: Hex }> {
  const l = (await store.listing(slug))!;
  const o = l.offer;
  const offer = {
    seller: o.seller as Hex, listingId: o.listingId as Hex, termsHash: o.termsHash as Hex, externalRef: o.externalRef as Hex,
    price: BigInt(o.price), shipWithin: Number(o.shipWithin), deliverWithin: Number(o.deliverWithin), maxUnits: Number(o.maxUnits),
    validUntil: BigInt(o.validUntil), version: BigInt(o.version),
  };
  const code = words();
  await wait(await buyer.writeContract({ address: dep.token, abi: erc20Abi, functionName: "approve", args: [dep.checkout, offer.price] }));
  const payTx = await buyer.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "pay", args: [offer, l.offerSig as Hex, deliveryCodeHash(net.chain.id, dep.checkout, code)] });
  const rc = await wait(payTx);
  let id = 0n;
  for (const lg of rc.logs) {
    try {
      const ev = decodeEventLog({ abi: checkoutAbi, data: lg.data, topics: lg.topics });
      if (ev.eventName === "OrderFunded") id = ev.args.orderId;
    } catch {
      /* token log */
    }
  }
  try {
    const { orderRegisterMessage } = await import("../apps/web/src/lib/messages");
    const delivery = { name: "Demo Buyer", phone: "+91 90000 00000", address: "Flat 1, Demo Building, Mumbai (demo order)" };
    const r = await fetch(`${WEB}/api/orders/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ txHash: payTx, delivery, signature: await buyerAcct.signMessage({ message: orderRegisterMessage(payTx, delivery) }) }),
    });
    if (!r.ok) console.warn(`  warning: could not register order #${id} with the app (HTTP ${r.status})`);
  } catch {
    console.warn(`  warning: the web app at ${WEB} is not reachable; order #${id} exists on chain but is not registered with the app`);
  }
  return { id, code, payTx };
}

/** Existing order of this listing that still fits the scene, if any. */
async function existing(slug: string, fits: (o: Awaited<ReturnType<typeof getOrder>>) => boolean): Promise<bigint | undefined> {
  const rows = (await store.allOrders()).filter((r) => r.listingId === slug).sort((a, b) => Number(b.orderId) - Number(a.orderId));
  for (const r of rows) {
    const o = await getOrder(BigInt(r.orderId));
    if (fits(o)) return BigInt(r.orderId);
  }
  return undefined;
}

// ---------------------------------------------------------------- scene 1: expiring
if (want(1)) {
  const slug = "demo-expiring";
  await ensureListing(slug, "meera.jewels", seller, "Silver jhumkas, ship-by demo", 899);
  const id = await existing(slug, (o) => ORDER_STATES[o.state] === "Funded" && Number(o.shipBy) > now() + 30);
  if (id !== undefined) out.push(`scene 1 expiring: order #${id} already Funded and not yet expired (skipped)`);
  else {
    const b = await buy(slug);
    const o = await getOrder(b.id);
    out.push(`scene 1 expiring: order #${b.id} paid; the seller never ships; ship-by passes at ${new Date(Number(o.shipBy) * 1000).toLocaleTimeString("en-IN")} (about 3 minutes from now). Open ${WEB}/o/${b.id} in the browser that holds the TEST_BUYER wallet.`);
  }
}

// ---------------------------------------------------------------- scene 2: delivered, window open
if (want(2)) {
  const slug = "demo-delivered";
  await ensureListing(slug, "meera.jewels", seller, "Silver jhumkas, problem-window demo", 899);
  const id = await existing(slug, (o) => ORDER_STATES[o.state] === "Delivered" && Number(o.deliveredAt) + Number(o.disputeWindow) > now() + 20);
  if (id !== undefined) out.push(`scene 2 delivered: order #${id} already Delivered with the window open (skipped)`);
  else {
    const b = await buy(slug);
    await wait(await seller.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "markShipped", args: [b.id, keccak256(toHex("DEMO-TRACK-2"))] }));
    await wait(await courier.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "confirmDelivery", args: [b.id, codeBytes(b.code)] }));
    const o = await getOrder(b.id);
    out.push(`scene 2 delivered: order #${b.id} Delivered; the problem window (${o.disputeWindow} s) ends at ${new Date((Number(o.deliveredAt) + Number(o.disputeWindow)) * 1000).toLocaleTimeString("en-IN")}. Open ${WEB}/o/${b.id} and press "Report a problem" before then.`);
  }
}

// ---------------------------------------------------------------- scene 3: disputed (courier refused handover)
if (want(3)) {
  const slug = "demo-disputed";
  await ensureListing(slug, "meera.jewels", seller, "Silver jhumkas, dispute demo", 899);
  const arbiterTimeout = Number(await pub.readContract({ address: dep.checkout, abi: checkoutAbi, functionName: "arbiterTimeout" }));
  const id = await existing(slug, (o) => ORDER_STATES[o.state] === "Disputed" && Number(o.disputedAt) + arbiterTimeout > now() + 60);
  if (id !== undefined) out.push(`scene 3 disputed: order #${id} already Disputed with time left (skipped)`);
  else {
    const b = await buy(slug);
    await wait(await seller.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "markShipped", args: [b.id, keccak256(toHex("DEMO-TRACK-3"))] }));
    await wait(await courier.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "reportHandoverRefused", args: [b.id] }));
    out.push(`scene 3 disputed: order #${b.id} Disputed (the courier reported a refused handover); the arbiter has ${arbiterTimeout} s to decide, then the buyer is refunded automatically. Decide it at ${WEB}/arbiter.`);
  }
}

// ---------------------------------------------------------------- scene 4: banned seller with an open order
const badKey = keccak256(toHex(`pop-demo-bad-seller:${net.chain.id}:${need("SELLER_PK")}`));
if (want(4)) {
  const slug = "demo-bad-bazaar";
  const handle = "bad.bazaar";
  const bad = walletFromKey(badKey);
  const badAcct = bad.account;
  const banned = await pub.readContract({ address: dep.registry, abi: registryAbi, functionName: "bannedWallet", args: [badAcct.address] });
  const active = await pub.readContract({ address: dep.registry, abi: registryAbi, functionName: "isActive", args: [badAcct.address] });
  if (banned) {
    out.push(`scene 4 banned: @${handle} is already banned (skipped). Look it up at ${WEB}/verify/${handle} (red page) and ${WEB}/arbiter.`);
  } else {
    await fundGas(badAcct.address);
    if (!active) {
      const hHash = handleHash(handle);
      const nonce = BigInt(Date.now());
      const deadline = BigInt(now() + 3600);
      const sig = await attestor.signTypedData({
        domain: { name: APP_NAME, version: EIP712_VERSION, chainId: net.chain.id, verifyingContract: dep.registry },
        types: { Registration: [{ name: "seller", type: "address" }, { name: "handleHash", type: "bytes32" }, { name: "handleTier", type: "uint8" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint64" }] },
        primaryType: "Registration",
        message: { seller: badAcct.address, handleHash: hHash, handleTier: 1, nonce, deadline },
      });
      await wait(await bad.writeContract({ address: dep.registry, abi: registryAbi, functionName: "registerSeller", args: [badAcct.address, hHash, 1, nonce, deadline, sig] }));
      await store.upsertSeller({ wallet: badAcct.address, handle, handleHash: hHash, handleTier: 1, bioCode: "POP-DEMO00", createdAt: new Date().toISOString() });
    }
    await ensureListing(slug, handle, bad, "Gold-look necklace (demo seller)", 1299);
    const b = await buy(slug);
    await wait(await arbiter.writeContract({ address: dep.registry, abi: registryAbi, functionName: "ban", args: [badAcct.address] }));
    out.push(`scene 4 banned: @${handle} registered, order #${b.id} paid and still open, then the seller was banned. Refund it from ${WEB}/arbiter (look up @${handle}, press Force refund). ${WEB}/verify/${handle} is the red page.`);
  }
}

// ---------------------------------------------------------------- scene 5: a handle that is not registered
if (want(5)) {
  const slug = "demo-fake-meera";
  const handle = "meera.jewels.official";
  const fake = walletFromKey(keccak256(toHex(`pop-demo-fake-seller:${net.chain.id}:${need("SELLER_PK")}`)));
  const fakeAcct = fake.account;
  if (!(await store.sellerByHandle(handle))) {
    await store.upsertSeller({ wallet: fakeAcct.address, handle, handleHash: handleHash(handle), handleTier: 0, bioCode: "POP-FAKE00", createdAt: new Date().toISOString() });
  }
  await ensureListing(slug, handle, fake, "Silver jhumkas (look-alike seller)", 799);
  out.push(`scene 5 fake: ${WEB}/p/${slug} shows a listing for @${handle}, a handle that is NOT registered on chain: the page warns and Pay is disabled. ${WEB}/verify/${handle} is the red "Not a registered seller" page. No transaction was sent for this scene.`);
}

console.log(`\nDemo scenes on ${mode} (chain ${net.chain.id}):`);
for (const l of out) console.log(" - " + l);
process.exit(0);
