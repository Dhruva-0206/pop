/**
 * ONE real test-USDT order on Whitechain Sepolia (1874), walked end to end with the funded wallets from .env:
 * test buyer approve + pay -> order registered in the app (needs the web server on WEB_URL in testnet mode) ->
 * seller markShipped -> courier confirmDelivery with the buyer's 6-word code -> wait out the dispute window ->
 * finalize (anyone) -> seller withdraw. Prints every tx hash. Test USDT only; no value.
 * Guarded: NETWORK_MODE=testnet and ALLOW_TESTNET_ORDER=yes. Run it ONCE; re-running makes another order.
 * Usage: NETWORK_MODE=testnet ALLOW_TESTNET_ORDER=yes npx tsx scripts/testnet-order.ts
 */
import { decodeEventLog, erc20Abi, keccak256, toHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { checkoutAbi, codeBytes, deliveryCodeHash, ORDER_STATES } from "../packages/shared/src/index";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { loadDeployment, mode, net, pub, walletOf } from "./chain";
import { need, opt } from "./env";

if (mode !== "testnet" || opt("ALLOW_TESTNET_ORDER") !== "yes") {
  throw new Error("Testnet only: set NETWORK_MODE=testnet and ALLOW_TESTNET_ORDER=yes for this one run.");
}
const WEB = opt("WEB_URL") ?? "http://localhost:3000";
const dep = loadDeployment();
const buyer = walletOf("TEST_BUYER_PK");
const seller = walletOf("SELLER_PK");
const courier = walletOf("COURIER_PK");
const buyerAcct = privateKeyToAccount(need("TEST_BUYER_PK") as Hex);
const out: Record<string, string> = {};
const step = (name: string, hash: Hex) => {
  out[name] = hash;
  console.log(`${name}: ${hash}`);
};
const wait = (hash: Hex) => pub.waitForTransactionReceipt({ hash });
const getOrder = (id: bigint) => pub.readContract({ address: dep.checkout, abi: checkoutAbi, functionName: "getOrder", args: [id] });

const lr = await fetch(`${WEB}/api/listings/jhumka-01`);
const listing = (await lr.json()).listing;
if (!listing) throw new Error("listing jhumka-01 not found (seed first, web server in testnet mode?)");
const o = listing.offer;
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

const code = Array.from(crypto.getRandomValues(new Uint16Array(6)), (n) => wordlist[n % 2048]).join(" ");
console.log(`delivery code (test order): ${code}`);

// 1) buyer approve + pay
const approveTx = await buyer.writeContract({ address: dep.token, abi: erc20Abi, functionName: "approve", args: [dep.checkout, offer.price] });
await wait(approveTx);
step("approve", approveTx);
const payTx = await buyer.writeContract({
  address: dep.checkout,
  abi: checkoutAbi,
  functionName: "pay",
  args: [offer, listing.offerSig, deliveryCodeHash(net.chain.id, dep.checkout, code)],
});
const payRc = await wait(payTx);
step("pay", payTx);
let id = 0n;
for (const l of payRc.logs) {
  try {
    const ev = decodeEventLog({ abi: checkoutAbi, data: l.data, topics: l.topics });
    if (ev.eventName === "OrderFunded") id = ev.args.orderId;
  } catch {
    /* token log */
  }
}
console.log(`order #${id} state=${ORDER_STATES[(await getOrder(id)).state]}`);

// 2) register with the app (buyer-signed), so the order page, /verify and buyer_history see it
const { orderRegisterMessage } = await import("../apps/web/src/lib/messages");
const delivery = { name: "Test Buyer", phone: "+91 90000 00000", address: "Flat 1, Test Building, Mumbai (test order)" };
const reg = await fetch(`${WEB}/api/orders/confirm`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ txHash: payTx, delivery, signature: await buyerAcct.signMessage({ message: orderRegisterMessage(payTx, delivery) }) }),
});
console.log(`app registration: HTTP ${reg.status} ${JSON.stringify(await reg.json())}`);

// 3) seller ships
const shipTx = await seller.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "markShipped", args: [id, keccak256(toHex("TEST-TRACKING-1"))] });
await wait(shipTx);
step("markShipped", shipTx);

// 4) courier submits the buyer's code
const deliverTx = await courier.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "confirmDelivery", args: [id, codeBytes(code)] });
await wait(deliverTx);
step("confirmDelivery", deliverTx);
const delivered = await getOrder(id);
const releaseAt = Number(delivered.deliveredAt) + Number(delivered.disputeWindow);
console.log(`state=${ORDER_STATES[delivered.state]} dispute window ${delivered.disputeWindow}s, release after chain time ${releaseAt}`);

// 5) wait for chain time to pass the dispute window (real time; no skipping)
for (;;) {
  const now = Number((await pub.getBlock()).timestamp);
  if (now > releaseAt) break;
  await new Promise((r) => setTimeout(r, 4000));
}
const finTx = await buyer.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "finalize", args: [id] });
await wait(finTx);
step("finalize", finTx);
console.log(`state=${ORDER_STATES[(await getOrder(id)).state]}`);

// 6) seller withdraws
const before = await pub.readContract({ address: dep.token, abi: erc20Abi, functionName: "balanceOf", args: [seller.account.address] });
const wdTx = await seller.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "withdraw" });
await wait(wdTx);
step("sellerWithdraw", wdTx);
const after = await pub.readContract({ address: dep.token, abi: erc20Abi, functionName: "balanceOf", args: [seller.account.address] });
console.log(`seller USDT before=${before} after=${after} (raw, 6 decimals)`);
console.log(JSON.stringify({ orderId: id.toString(), ...out }, null, 2));
