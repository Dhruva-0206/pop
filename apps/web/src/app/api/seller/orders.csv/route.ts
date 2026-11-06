import { connection } from "next/server";
import { formatUnits, type Address } from "viem";
import { checkoutAbi, chunkedLogs, ORDER_STATES } from "@pop/shared";
import { getSession } from "@/lib/server/auth";
import { deployment, net, pub, store } from "@/lib/server/chain";

const MAX_ORDERS = 500;
const COLS = [
  "order_id", "state", "listing_id", "title", "merchant_ref", "buyer_wallet", "amount_test_usdt",
  "funded_at_utc", "shipped_at_utc", "delivered_at_utc",
  "fund_tx", "ship_tx", "deliver_tx", "settle_event", "settle_tx", "explorer_base",
] as const;

/** CSV cell: always quoted; a leading = + - @ tab or CR is neutralised so spreadsheets never run seller/merchant-controlled text as a formula. */
function cell(v: unknown): string {
  let s = v === undefined || v === null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}
const utc = (sec: bigint) => (sec > BigInt(0) ? new Date(Number(sec) * 1000).toISOString() : "");

/**
 * Seller CSV export: every order paid to the signed-in seller (read from the contract's own OrderFunded events, so orders the
 * buyer never registered with the app are included) with live state and the tx hash of each step. No buyer ship-to details (no PII).
 */
export async function GET() {
  await connection();
  const s = await getSession<{ wallet: string }>("pop_seller");
  if (!s) return new Response("sign in", { status: 401 });
  const seller = s.wallet as Address;
  const d = deployment();
  const latest = await pub.getBlockNumber();
  const from = BigInt(d.deployBlock);
  const base = { address: d.checkout, abi: checkoutAbi } as const;

  const funded = (
    await chunkedLogs(from, latest, (fromBlock, toBlock) => pub.getContractEvents({ ...base, eventName: "OrderFunded", args: { seller }, fromBlock, toBlock }))
  ).slice(-MAX_ORDERS);
  const ids = funded.map((e) => e.args.orderId!);
  const byOrder = async (eventName: "OrderShipped" | "OrderDelivered" | "OrderReleased" | "OrderRefunded" | "DisputeResolved") => {
    const m = new Map<string, Hex>();
    if (!ids.length) return m;
    const evs = await chunkedLogs(from, latest, (fromBlock, toBlock) => pub.getContractEvents({ ...base, eventName, args: { orderId: ids }, fromBlock, toBlock }));
    for (const e of evs) m.set(e.args.orderId!.toString(), e.transactionHash);
    return m;
  };
  type Hex = `0x${string}`;
  const [shipped, delivered, released, refunded, resolved] = await Promise.all([
    byOrder("OrderShipped"), byOrder("OrderDelivered"), byOrder("OrderReleased"), byOrder("OrderRefunded"), byOrder("DisputeResolved"),
  ]);
  const orders = await Promise.all(ids.map((id) => pub.readContract({ address: d.checkout, abi: checkoutAbi, functionName: "getOrder", args: [id] })));

  const lines = [COLS.join(",")];
  for (let i = 0; i < funded.length; i++) {
    const e = funded[i];
    const id = e.args.orderId!.toString();
    const o = orders[i];
    const listing = await store.listingByIdHash(e.args.listingId!);
    const session = listing ? await store.sessionByListing(listing.id) : undefined;
    const settle = released.has(id) ? ["OrderReleased", released.get(id)] : refunded.has(id) ? ["OrderRefunded", refunded.get(id)] : resolved.has(id) ? ["DisputeResolved", resolved.get(id)] : ["", ""];
    const row: Record<(typeof COLS)[number], unknown> = {
      order_id: id,
      state: ORDER_STATES[o.state],
      listing_id: listing?.id ?? "",
      title: listing?.title ?? "",
      merchant_ref: session?.merchantRef ?? "",
      buyer_wallet: e.args.buyer,
      amount_test_usdt: formatUnits(o.amount, d.tokenDecimals),
      funded_at_utc: utc(o.fundedAt),
      shipped_at_utc: utc(o.shippedAt),
      delivered_at_utc: utc(o.deliveredAt),
      fund_tx: e.transactionHash,
      ship_tx: shipped.get(id) ?? "",
      deliver_tx: delivered.get(id) ?? "",
      settle_event: settle[0],
      settle_tx: settle[1],
      explorer_base: net.isLocalFork ? "(local fork: no explorer)" : "https://explorer.testnet.whitechain.io/tx/",
    };
    lines.push(COLS.map((c) => cell(row[c])).join(","));
  }
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="pop-orders-${seller.slice(0, 8)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
