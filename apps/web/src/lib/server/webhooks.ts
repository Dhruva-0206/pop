import "server-only";
import type { Address, Hex } from "viem";
import { checkoutAbi } from "@pop/shared";
import { decryptPII } from "@pop/shared/server/crypto";
import { deployment, encKey, net, pub, store } from "./chain";
import { signWebhook } from "./merchants";

/**
 * Webhook dispatcher for "Pay with PoP" merchants.
 * There is no indexer: anyone can finalize or withdraw straight on-chain, so we read the checkout's own events
 * (OrderFunded/Shipped/Delivered/Released/Refunded) from a stored block cursor, enqueue ONE delivery per (merchant, order, event)
 * (unique index = idempotent), and POST the enqueued ones with an HMAC signature. Failed deliveries are retried with a backoff.
 * The merchant must not trust the payload alone: @pop/checkout-sdk `confirmOnChain` rechecks the order on-chain.
 */
const EVENT_TYPE = {
  OrderFunded: "order.funded",
  OrderShipped: "order.shipped",
  OrderDelivered: "order.delivered",
  OrderReleased: "order.released",
  OrderRefunded: "order.refunded",
} as const;
type EventName = keyof typeof EVENT_TYPE;
const CHUNK = BigInt(20_000);
const MAX_ATTEMPTS = 8;
const BACKOFF_SEC = 20;
const MIN_INTERVAL_MS = 1500;

type Summary = { scannedTo: number; enqueued: number; delivered: number; failed: number };
const g = globalThis as unknown as { __popWh?: { running?: Promise<Summary>; last?: { at: number; s: Summary } } };
const state = (g.__popWh ??= {});

/** One dispatch pass. Concurrent callers share the same pass; calls within 1.5 s of the last pass return its result. */
export function dispatchWebhooks(): Promise<Summary> {
  if (state.running) return state.running;
  if (state.last && Date.now() - state.last.at < MIN_INTERVAL_MS) return Promise.resolve(state.last.s);
  state.running = run()
    .then((s) => ((state.last = { at: Date.now(), s }), s))
    .finally(() => {
      state.running = undefined;
    });
  return state.running;
}

async function run(): Promise<Summary> {
  const merchants = (await store.merchants()).filter((m) => m.webhookUrl && m.webhookSecretEnc);
  const out: Summary = { scannedTo: 0, enqueued: 0, delivered: 0, failed: 0 };
  if (!merchants.length) return out;
  const d = deployment();
  const byWallet = new Map(merchants.map((m) => [m.sellerWallet.toLowerCase(), m]));

  // ---- 1) scan new chain events and enqueue
  const key = `webhooks:${net.chain.id}:${d.checkout.toLowerCase()}`;
  const cursor = await store.webhookCursor(key);
  const latest = await pub.getBlockNumber();
  let from = cursor === undefined ? BigInt(d.deployBlock) : BigInt(cursor) + BigInt(1);
  const blockTs = new Map<bigint, number>();
  const orderInfo = new Map<string, { seller: Address; buyer: Address; amount: bigint; txHash: Hex; listingId: Hex }>();

  async function info(orderId: bigint) {
    const k = orderId.toString();
    const hit = orderInfo.get(k);
    if (hit) return hit;
    const evs = await pub.getContractEvents({ address: d.checkout, abi: checkoutAbi, eventName: "OrderFunded", args: { orderId }, fromBlock: BigInt(d.deployBlock), toBlock: "latest" });
    const e = evs[0];
    if (!e) return undefined;
    const v = { seller: e.args.seller!, buyer: e.args.buyer!, amount: e.args.amount!, txHash: e.transactionHash, listingId: e.args.listingId! };
    orderInfo.set(k, v);
    return v;
  }

  while (from <= latest) {
    const to = from + CHUNK - BigInt(1) < latest ? from + CHUNK - BigInt(1) : latest;
    const logs = (
      await Promise.all(
        (Object.keys(EVENT_TYPE) as EventName[]).map(async (name) =>
          (await pub.getContractEvents({ address: d.checkout, abi: checkoutAbi, eventName: name, fromBlock: from, toBlock: to })).map((l) => ({ name, l })),
        ),
      )
    )
      .flat()
      .sort((a, b) => Number(a.l.blockNumber - b.l.blockNumber) || a.l.logIndex - b.l.logIndex);
    for (const { name, l } of logs) {
      const orderId = (l.args as { orderId: bigint }).orderId;
      const inf = await info(orderId);
      if (!inf) continue;
      const m = byWallet.get(inf.seller.toLowerCase());
      if (!m) continue;
      const listing = await store.listingByIdHash(inf.listingId);
      const session = listing ? await store.sessionByListing(listing.id) : undefined;
      if (!session || session.merchantId !== m.id) continue; // only orders paid through a merchant checkout session
      if (!blockTs.has(l.blockNumber)) blockTs.set(l.blockNumber, Number((await pub.getBlock({ blockNumber: l.blockNumber })).timestamp));
      const type = EVENT_TYPE[name];
      const payload = {
        id: `evt_${orderId}_${type}`,
        type,
        created: blockTs.get(l.blockNumber)!,
        data: {
          orderId: orderId.toString(),
          sessionId: session.id,
          merchantRef: session.merchantRef,
          buyer: inf.buyer,
          seller: inf.seller,
          amount: inf.amount.toString(),
          chainId: net.chain.id,
          checkout: d.checkout,
          txHash: inf.txHash, // the FUNDING tx: the merchant checks it on-chain
          eventTx: l.transactionHash,
        },
      };
      if (await store.enqueueWebhook(m.id, orderId.toString(), type, payload)) out.enqueued++;
    }
    await store.setWebhookCursor(key, Number(to));
    out.scannedTo = Number(to);
    from = to + BigInt(1);
  }

  // ---- 2) deliver what is due
  const secretOf = new Map<number, string>();
  for (const x of await store.dueWebhooks(MAX_ATTEMPTS, BACKOFF_SEC)) {
    const m = merchants.find((y) => y.id === x.merchantId);
    if (!m) continue;
    if (!secretOf.has(m.id)) secretOf.set(m.id, decryptPII(m.webhookSecretEnc!, encKey()));
    const body = JSON.stringify(x.payload);
    const t = Math.floor(Date.now() / 1000);
    try {
      const r = await fetch(m.webhookUrl!, {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
        headers: {
          "content-type": "application/json",
          "pop-signature": signWebhook(secretOf.get(m.id)!, t, body),
          "pop-event-id": (x.payload as { id: string }).id,
        },
        body,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await store.markWebhook(x.id, true);
      out.delivered++;
    } catch (e) {
      await store.markWebhook(x.id, false, e instanceof Error ? e.message : "failed");
      out.failed++;
    }
  }
  return out;
}
