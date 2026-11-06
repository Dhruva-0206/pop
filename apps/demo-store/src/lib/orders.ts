import "server-only";

/**
 * Kurta Co.'s own order book. In-memory on purpose (demo): a restart forgets it, but nothing here is the source of truth.
 * Every status below was confirmed against the contract before it was stored, so it can be rebuilt from the chain.
 */
export type OrderStatus = "created" | "funded" | "shipped" | "delivered" | "released" | "refunded";
export type KurtaOrder = {
  ref: string; // our merchantRef
  sessionId?: string;
  orderId?: string; // on-chain order id
  buyer?: string;
  amountUsdt?: string;
  status: OrderStatus;
  history: { event: string; at: number; onChainState: string }[];
  createdAt: number;
};

type Book = { orders: Map<string, KurtaOrder>; seen: Set<string> };
const g = globalThis as unknown as { __kurta?: Book };
const db: Book = (g.__kurta ??= { orders: new Map<string, KurtaOrder>(), seen: new Set<string>() });
const RANK: Record<OrderStatus, number> = { created: 0, funded: 1, shipped: 2, delivered: 3, released: 4, refunded: 4 };

export const orders = {
  create(): string {
    const ref = `KC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    db.orders.set(ref, { ref, status: "created", history: [], createdAt: Date.now() });
    return ref;
  },
  attach(ref: string, sessionId: string) {
    const o = db.orders.get(ref);
    if (o) o.sessionId = sessionId;
  },
  get: (ref: string) => db.orders.get(ref),
  all: () => [...db.orders.values()].sort((a, b) => b.createdAt - a.createdAt),
  /** Apply a verified + chain-confirmed event once (event id dedupes retries). Status only moves forward. */
  apply(
    ev: { id: string; type: string; created: number; data: { merchantRef: string | null; orderId: string; buyer: string } },
    onChainState: string,
    amountUsdt: string,
  ): "applied" | "duplicate" | "unknown-ref" {
    const o = ev.data.merchantRef ? db.orders.get(ev.data.merchantRef) : undefined;
    if (!o) return "unknown-ref";
    if (db.seen.has(ev.id)) return "duplicate";
    db.seen.add(ev.id);
    const next = ev.type.replace("order.", "") as OrderStatus;
    const rank: number | undefined = RANK[next];
    if (rank === undefined) return "unknown-ref";
    o.orderId = ev.data.orderId;
    o.buyer = ev.data.buyer;
    o.amountUsdt = amountUsdt;
    if (rank >= RANK[o.status]) o.status = next;
    o.history.push({ event: ev.type, at: ev.created, onChainState });
    return "applied";
  },
};
