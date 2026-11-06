/**
 * ONE late-ship refund order on Whitechain Sepolia (1874) with the funded test wallets from .env:
 * test buyer approve + pay -> app registration -> the seller never ships -> chain time passes ship-by (real time) ->
 * a third party (the deployer wallet, "anyone") calls finalize -> the buyer withdraws the full refund.
 * Prints every tx hash. Test USDT only. Guarded: NETWORK_MODE=testnet and ALLOW_TESTNET_ORDER=yes. Run ONCE.
 * Usage: NETWORK_MODE=testnet ALLOW_TESTNET_ORDER=yes npx tsx scripts/testnet-refund.ts
 */
import { decodeEventLog, erc20Abi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { checkoutAbi, deliveryCodeHash, ORDER_STATES } from "../packages/shared/src/index";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { loadDeployment, mode, net, pub, walletOf } from "./chain";
import { need, opt } from "./env";

if (mode !== "testnet" || opt("ALLOW_TESTNET_ORDER") !== "yes") {
  throw new Error("Testnet only: set NETWORK_MODE=testnet and ALLOW_TESTNET_ORDER=yes for this one run.");
}
const WEB = opt("WEB_URL") ?? "http://localhost:3000";
const dep = loadDeployment();
const buyer = walletOf("TEST_BUYER_PK");
const anyone = walletOf("DEPLOYER_PK"); // not buyer, seller or courier: proves "anyone can finalize"
const buyerAcct = privateKeyToAccount(need("TEST_BUYER_PK") as Hex);
const out: Record<string, string> = {};
const step = (name: string, hash: Hex) => {
  out[name] = hash;
  console.log(`${name}: ${hash}`);
};
const wait = (hash: Hex) => pub.waitForTransactionReceipt({ hash });
const getOrder = (id: bigint) => pub.readContract({ address: dep.checkout, abi: checkoutAbi, functionName: "getOrder", args: [id] });

const listing = (await (await fetch(`${WEB}/api/listings/jhumka-01`)).json()).listing;
if (!listing) throw new Error("listing jhumka-01 not found (web server in testnet mode?)");
const o = listing.offer;
const offer = {
  seller: o.seller as Hex, listingId: o.listingId as Hex, termsHash: o.termsHash as Hex, externalRef: o.externalRef as Hex,
  price: BigInt(o.price), shipWithin: Number(o.shipWithin), deliverWithin: Number(o.deliverWithin), maxUnits: Number(o.maxUnits),
  validUntil: BigInt(o.validUntil), version: BigInt(o.version),
};
const code = Array.from(crypto.getRandomValues(new Uint16Array(6)), (n) => wordlist[n % 2048]).join(" ");

const approveTx = await buyer.writeContract({ address: dep.token, abi: erc20Abi, functionName: "approve", args: [dep.checkout, offer.price] });
await wait(approveTx);
step("approve", approveTx);
const payTx = await buyer.writeContract({
  address: dep.checkout, abi: checkoutAbi, functionName: "pay",
  args: [offer, listing.offerSig, deliveryCodeHash(net.chain.id, dep.checkout, code)],
});
const rc = await wait(payTx);
step("pay", payTx);
let id = 0n;
for (const l of rc.logs) {
  try {
    const ev = decodeEventLog({ abi: checkoutAbi, data: l.data, topics: l.topics });
    if (ev.eventName === "OrderFunded") id = ev.args.orderId;
  } catch {
    /* token log */
  }
}
const funded = await getOrder(id);
console.log(`order #${id} state=${ORDER_STATES[funded.state]} shipBy(chain)=${funded.shipBy}`);

const { orderRegisterMessage } = await import("../apps/web/src/lib/messages");
const delivery = { name: "Test Buyer", phone: "+91 90000 00000", address: "Flat 1, Test Building, Mumbai (test order)" };
const reg = await fetch(`${WEB}/api/orders/confirm`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ txHash: payTx, delivery, signature: await buyerAcct.signMessage({ message: orderRegisterMessage(payTx, delivery) }) }),
});
console.log(`app registration: HTTP ${reg.status}`);

// The seller never ships. Wait (real time, no skipping) until chain time passes ship-by.
for (;;) {
  if (Number((await pub.getBlock()).timestamp) > Number(funded.shipBy)) break;
  await new Promise((r) => setTimeout(r, 5000));
}
const creditBefore = await pub.readContract({ address: dep.checkout, abi: checkoutAbi, functionName: "credit", args: [buyerAcct.address] });
const finTx = await anyone.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "finalize", args: [id] });
await wait(finTx);
step("finalize", finTx);
console.log(`state=${ORDER_STATES[(await getOrder(id)).state]} (finalize sent by ${anyone.account.address})`);
const creditAfter = await pub.readContract({ address: dep.checkout, abi: checkoutAbi, functionName: "credit", args: [buyerAcct.address] });
console.log(`buyer credit ${creditBefore} -> ${creditAfter}`);

const usdtBefore = await pub.readContract({ address: dep.token, abi: erc20Abi, functionName: "balanceOf", args: [buyerAcct.address] });
const wdTx = await buyer.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "withdraw" });
await wait(wdTx);
step("buyerWithdraw", wdTx);
const usdtAfter = await pub.readContract({ address: dep.token, abi: erc20Abi, functionName: "balanceOf", args: [buyerAcct.address] });
console.log(`buyer USDT ${usdtBefore} -> ${usdtAfter} (raw, 6 decimals)`);
console.log(JSON.stringify({ orderId: id.toString(), ...out }, null, 2));
