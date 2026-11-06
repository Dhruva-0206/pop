/**
 * Drives ONE order that a person placed in the browser, on Whitechain Sepolia (1874) only.
 *   markShipped (as the order's seller) -> confirmDelivery (courier, with the six words you pass in) -> wait out the problem window
 *   -> finalize (a third party, the deployer wallet) -> seller withdraw.
 * Prints an explorer link and the time each step took. Test USDT and test WBT only. Never prints keys.
 *
 * Usage (Git Bash):
 *   NETWORK_MODE=testnet ALLOW_DEMO_ORDER=yes npx tsx scripts/demo-driver.ts <orderId> "<six words>" [--stop-after=ship|deliver|finalize] [--no-withdraw]
 *   (export NETWORK_MODE after anything that sources .env: the file says fork)
 *
 * --stop-after=deliver leaves the order Delivered with the problem window open (the "report a problem" scene).
 * Sellers it can act for: the wallet in SELLER_PK (@meera.jewels) and in MERCHANT_PK (@kurta.co). Any other seller is refused.
 * It sends real test transactions, so the chain lock in parallel.md applies. Do not stop the webhook loop; it does not interfere.
 */
import { keccak256, toHex, type Address } from "viem";
import { checkoutAbi, codeBytes, ORDER_STATES } from "../packages/shared/src/index";
import { loadDeployment, mode, net, pub, walletOf } from "./chain";
import { opt } from "./env";

if (mode !== "testnet" || net.chain.id !== 1874) throw new Error(`testnet only (mode is ${mode}, chain ${net.chain.id}); export NETWORK_MODE=testnet`);
if (opt("ALLOW_DEMO_ORDER") !== "yes") throw new Error("This sends real test transactions: set ALLOW_DEMO_ORDER=yes for this run.");

const args = process.argv.slice(2);
const flag = (n: string) => args.find((a) => a.startsWith(`--${n}`));
const pos = args.filter((a) => !a.startsWith("--"));
const [idArg, ...wordArgs] = pos;
const words = wordArgs.join(" "); // works with or without quotes around the six words
if (!idArg || !/^\d+$/.test(idArg) || !words || words.trim().split(/\s+/).length !== 6) {
  throw new Error('usage: <orderId> "<six words>" [--stop-after=ship|deliver|finalize] [--no-withdraw]');
}
const stopAfter = flag("stop-after")?.split("=")[1] as "ship" | "deliver" | "finalize" | undefined;
if (stopAfter && !["ship", "deliver", "finalize"].includes(stopAfter)) throw new Error("--stop-after must be ship, deliver or finalize");
const noWithdraw = !!flag("no-withdraw");

const id = BigInt(idArg);
const dep = loadDeployment();
const EX = "https://explorer.testnet.whitechain.io/tx/";
const t0 = Date.now();
const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const getOrder = () => pub.readContract({ address: dep.checkout, abi: checkoutAbi, functionName: "getOrder", args: [id] });
const stateName = (o: { state: number }) => ORDER_STATES[Number(o.state)] ?? String(o.state);

async function step<T extends `0x${string}`>(label: string, send: () => Promise<T>) {
  const s = Date.now();
  const hash = await send();
  const rc = await pub.waitForTransactionReceipt({ hash });
  console.log(`${label.padEnd(16)} ${rc.status === "success" ? "ok " : "FAIL"} ${secs(Date.now() - s).padStart(7)} (total ${secs(Date.now() - t0)}) block ${rc.blockNumber} ${EX}${hash}`);
  if (rc.status !== "success") throw new Error(`${label} reverted`);
}

let o = await getOrder();
if (o.buyer === "0x0000000000000000000000000000000000000000") throw new Error(`order #${id} does not exist`);
console.log(`order #${id} on chain ${net.chain.id}: state ${stateName(o)}, amount ${Number(o.amount) / 1e6} test USDT`);

// ---- who is the seller? only the two known demo wallets can be driven
const candidates = (["SELLER_PK", "MERCHANT_PK"] as const).map((v) => ({ v, w: walletOf(v) }));
const seller = candidates.find((c) => c.w.account.address.toLowerCase() === (o.seller as Address).toLowerCase());
if (!seller) throw new Error(`order #${id} belongs to a seller this script has no wallet for (${o.seller}); only SELLER_PK and MERCHANT_PK are supported`);
const courier = walletOf("COURIER_PK");
const third = walletOf("DEPLOYER_PK");
console.log(`seller wallet: ${seller.v} (${seller.w.account.address})`);

// ---- 1) ship
if (stateName(o) === "Funded") {
  const left = Number(o.shipBy) - Math.floor(Date.now() / 1000);
  if (left <= 0) throw new Error(`ship-by already passed ${-left} s ago; anyone can finalize this order into a refund now`);
  console.log(`ship-by in ${left} s`);
  await step("markShipped", () => seller.w.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "markShipped", args: [id, keccak256(toHex(`DEMO-DRIVER-${id}`))] }));
} else if (stateName(o) !== "Shipped") {
  console.log(`skipping markShipped (state is ${stateName(o)})`);
}
if (stopAfter === "ship") process.exit(0);

// ---- 2) courier delivers with the buyer's six words
o = await getOrder();
if (stateName(o) === "Shipped") {
  await step("confirmDelivery", () => courier.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "confirmDelivery", args: [id, codeBytes(words)] }));
} else if (stateName(o) !== "Delivered") {
  throw new Error(`cannot deliver from state ${stateName(o)}`);
}
if (stopAfter === "deliver") {
  o = await getOrder();
  console.log(`stopped after delivery. Problem window: ${o.disputeWindow} s, ends at ${new Date((Number(o.deliveredAt) + Number(o.disputeWindow)) * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST`);
  process.exit(0);
}

// ---- 3) wait out the problem window, then finalize as a third party
o = await getOrder();
if (stateName(o) === "Delivered") {
  const endsAt = (Number(o.deliveredAt) + Number(o.disputeWindow)) * 1000;
  const w0 = Date.now();
  console.log(`waiting for the problem window (${o.disputeWindow} s, ends in ${Math.max(0, Math.round((endsAt - Date.now()) / 1000))} s)`);
  for (;;) {
    try {
      await pub.simulateContract({ address: dep.checkout, abi: checkoutAbi, functionName: "finalize", args: [id], account: third.account });
      break;
    } catch {
      if (Date.now() - w0 > 300_000) throw new Error("finalize still not allowed after 300 s");
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  console.log(`window wait: ${secs(Date.now() - w0)}`);
  await step("finalize", () => third.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "finalize", args: [id] }));
}
o = await getOrder();
console.log(`order #${id} state: ${stateName(o)}`);
if (stopAfter === "finalize" || noWithdraw) process.exit(0);

// ---- 4) seller withdraws the credit
const credit = (await pub.readContract({ address: dep.checkout, abi: checkoutAbi, functionName: "credit", args: [seller.w.account.address] })) as bigint;
if (credit > 0n) {
  await step("seller withdraw", () => seller.w.writeContract({ address: dep.checkout, abi: checkoutAbi, functionName: "withdraw" }));
  console.log(`withdrew ${Number(credit) / 1e6} test USDT`);
} else {
  console.log("nothing to withdraw for the seller");
}
console.log(`done in ${secs(Date.now() - t0)}`);
