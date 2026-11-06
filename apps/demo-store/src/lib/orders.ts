import "server-only";
import { createPublicClient, formatUnits, http, keccak256, toHex, type Address } from "viem";
import { checkoutAbi, chunkedLogs, ORDER_STATES } from "@pop/shared";
import { pool, schema } from "./db";
import { chainInfo } from "./pop";

/**
 * Kurta Co.'s order book, in Postgres (schema kurta_<chainId>). Every status in it was confirmed against the contract before it
 * was stored (webhook + on-chain recheck), and `reconcile()` can rebuild it from the chain alone: it finds paid orders by
 * `OrderFunded.externalRef == keccak(ref)` and re-derives each status from the order's own on-chain state and timestamps.
 */
export type OrderStatus = "created" | "funded" | "shipped" | "delivered" | "released" | "refunded" | "split";
export type KurtaOrder = {
  ref: string;
  sessionId?: string;
  orderId?: string;
  buyer?: string;
  amountUsdt?: string;
  status: OrderStatus;
  history: { event: string; at: number; onChainState: string }[];
  createdAt: number;
};
const RANK: Record<OrderStatus, number> = { created: 0, funded: 1, shipped: 2, delivered: 3, released: 4, refunded: 4, split: 4 };
const TERMINAL = ["released", "refunded", "split"];

type Row = { ref: string; session_id: string | null; order_id: string | null; buyer: string | null; amount_usdt: string | null; status: OrderStatus; created_at: Date };
const toOrder = (r: Row, history: KurtaOrder["history"] = []): KurtaOrder => ({
  ref: r.ref,
  sessionId: r.session_id ?? undefined,
  orderId: r.order_id ?? undefined,
  buyer: r.buyer ?? undefined,
  amountUsdt: r.amount_usdt ?? undefined,
  status: r.status,
  history,
  createdAt: r.created_at.getTime(),
});

export const orders = {
  async create(): Promise<string> {
    const S = await schema();
    const ref = `KC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    await pool().query(`insert into "${S}".orders (ref) values ($1)`, [ref]);
    return ref;
  },
  async attach(ref: string, sessionId: string) {
    const S = await schema();
    await pool().query(`update "${S}".orders set session_id = $2, updated_at = now() where ref = $1`, [ref, sessionId]);
  },
  async all(): Promise<KurtaOrder[]> {
    const S = await schema();
    const rows = (await pool().query(`select * from "${S}".orders order by created_at desc limit 100`)).rows as Row[];
    const ev = (
      await pool().query(`select ref, type, at, onchain_state from "${S}".order_events where ref = any($1) order by at, created_at`, [rows.map((r) => r.ref)])
    ).rows as { ref: string; type: string; at: string; onchain_state: string }[];
    return rows.map((r) => toOrder(r, ev.filter((e) => e.ref === r.ref).map((e) => ({ event: e.type, at: Number(e.at), onChainState: e.onchain_state }))));
  },
  /** Apply a verified + chain-confirmed event once (the PoP event id dedupes retries). Status only moves forward. */
  async apply(
    ev: { id: string; type: string; created: number; data: { merchantRef: string | null; orderId: string; buyer: string; checkout: string } },
    onChainState: string,
    amountUsdt: string,
  ): Promise<"applied" | "duplicate" | "unknown-ref"> {
    const S = await schema();
    const next = ev.type.replace("order.", "") as OrderStatus;
    const rank: number | undefined = RANK[next];
    if (!ev.data.merchantRef || rank === undefined) return "unknown-ref";
    const c = await pool().connect();
    try {
      await c.query("begin");
      const cur = (await c.query(`select status from "${S}".orders where ref = $1 for update`, [ev.data.merchantRef])).rows[0] as { status: OrderStatus } | undefined;
      if (!cur) {
        await c.query("rollback");
        return "unknown-ref";
      }
      const ins = await c.query(
        `insert into "${S}".order_events (event_id, ref, type, at, onchain_state) values ($1,$2,$3,$4,$5) on conflict do nothing`,
        [ev.id, ev.data.merchantRef, ev.type, ev.created, onChainState],
      );
      if (ins.rowCount === 0) {
        await c.query("rollback");
        return "duplicate";
      }
      await c.query(
        `update "${S}".orders set order_id = $2::numeric, checkout = lower($6), buyer = $3, amount_usdt = $4, status = $5, updated_at = now() where ref = $1`,
        [ev.data.merchantRef, ev.data.orderId, ev.data.buyer, amountUsdt, rank >= RANK[cur.status] ? next : cur.status, ev.data.checkout],
      );
      await c.query("commit");
      return "applied";
    } catch (e) {
      await c.query("rollback").catch(() => undefined);
      throw e;
    } finally {
      c.release();
    }
  },
};

/**
 * Rebuild from the chain: for every open order (and every order still unpaid) that has not changed for 45 s (webhooks normally
 * arrive within seconds; this is the safety net for lost ones), look at the contract and move the status forward.
 * Safe to run any time and as often as you like (throttled to once per 8 s per instance unless forced).
 */
let lastReconcile = 0;
export async function reconcile(sellerAddr: Address, force = false): Promise<{ checked: number; advanced: number }> {
  if (!force && Date.now() - lastReconcile < 8000) return { checked: 0, advanced: 0 };
  lastReconcile = Date.now();
  const S = await schema();
  const open = (await pool().query(`select * from "${S}".orders where status <> all($1) and created_at > now() - interval '30 days' and updated_at < now() - interval '45 seconds'`, [TERMINAL])).rows as Row[];
  if (!open.length) return { checked: 0, advanced: 0 };
  const ch = await chainInfo();
  const pc = createPublicClient({ transport: http(ch.rpcUrl) });

  // Unpaid orders: find their payment by externalRef = keccak(ref).
  const byRef = new Map(open.filter((r) => !r.order_id).map((r) => [keccak256(toHex(r.ref)).toLowerCase(), r.ref]));
  const found = new Map<string, { orderId: bigint; buyer: string; amount: bigint }>();
  if (byRef.size) {
    const tip = await pc.getBlockNumber({ cacheTime: 0 });
    const funded = await chunkedLogs(BigInt(ch.deployBlock), tip, (fromBlock, toBlock) =>
      pc.getContractEvents({ address: ch.checkout, abi: checkoutAbi, eventName: "OrderFunded", args: { seller: sellerAddr }, fromBlock, toBlock }),
    );
    for (const e of funded) {
      const ref = byRef.get(e.args.externalRef!.toLowerCase());
      if (ref) found.set(ref, { orderId: e.args.orderId!, buyer: e.args.buyer!, amount: e.args.amount! });
    }
  }
  let advanced = 0;
  for (const r of open) {
    const hit = found.get(r.ref);
    const orderId = r.order_id ? BigInt(r.order_id) : hit?.orderId;
    if (orderId === undefined) continue;
    const o = await pc.readContract({ address: ch.checkout, abi: checkoutAbi, functionName: "getOrder", args: [orderId] });
    const st = ORDER_STATES[o.state];
    const status: OrderStatus | undefined =
      st === "Released" ? "released" : st === "Refunded" ? "refunded" : st === "Split" ? "split"
      : st === "None" ? undefined : o.deliveredAt > BigInt(0) ? "delivered" : o.shippedAt > BigInt(0) ? "shipped" : "funded";
    if (!status || RANK[status] < RANK[r.status]) continue;
    if (status === r.status && r.order_id) continue;
    await pool().query(
      `update "${S}".orders set order_id = $2::numeric, checkout = lower($6), buyer = coalesce(buyer, $3), amount_usdt = coalesce(amount_usdt, $4), status = $5, updated_at = now() where ref = $1`,
      [r.ref, orderId.toString(), hit?.buyer ?? o.buyer, formatUnits(o.amount, 6), status, ch.checkout],
    );
    await pool().query(
      `insert into "${S}".order_events (event_id, ref, type, at, onchain_state) values ($1,$2,$3,$4,$5) on conflict do nothing`,
      [`reconcile_${r.ref}_${status}`, r.ref, `order.${status}`, Math.floor(Date.now() / 1000), st],
    );
    advanced++;
  }
  return { checked: open.length, advanced };
}
