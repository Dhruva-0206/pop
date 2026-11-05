import "server-only";
import { checkoutAbi, ORDER_STATES } from "@pop/shared";
import { deployment, pub } from "./chain";

export type LiveOrder = {
  orderId: string;
  buyer: string;
  seller: string;
  amount: string;
  termsHash: string;
  state: (typeof ORDER_STATES)[number];
  fundedAt: number;
  shipBy: number;
  shippedAt: number;
  deliverBy: number;
  deliveredAt: number;
  disputedAt: number;
  disputeWindow: number;
  releaseAt: number; // deliveredAt + disputeWindow
  arbiterDeadline: number; // disputedAt + arbiterTimeout
  canFinalize: boolean;
  now: number;
};

/** Reads the order straight from the contract (no caching). */
export async function readOrder(orderId: bigint): Promise<LiveOrder | null> {
  const d = deployment();
  const [o, block, timeout] = await Promise.all([
    pub.readContract({ address: d.checkout, abi: checkoutAbi, functionName: "getOrder", args: [orderId] }),
    pub.getBlock(),
    pub.readContract({ address: d.checkout, abi: checkoutAbi, functionName: "arbiterTimeout" }),
  ]);
  const state = ORDER_STATES[o.state];
  if (state === "None") return null;
  const now = Number(block.timestamp);
  const releaseAt = Number(o.deliveredAt) + Number(o.disputeWindow);
  const arbiterDeadline = Number(o.disputedAt) + Number(timeout);
  const canFinalize =
    (state === "Funded" && now > Number(o.shipBy)) ||
    (state === "Shipped" && now > Number(o.deliverBy)) ||
    (state === "Delivered" && now > releaseAt) ||
    (state === "Disputed" && now > arbiterDeadline);
  return {
    orderId: orderId.toString(),
    buyer: o.buyer,
    seller: o.seller,
    amount: o.amount.toString(),
    termsHash: o.termsHash,
    state,
    fundedAt: Number(o.fundedAt),
    shipBy: Number(o.shipBy),
    shippedAt: Number(o.shippedAt),
    deliverBy: Number(o.deliverBy),
    deliveredAt: Number(o.deliveredAt),
    disputedAt: Number(o.disputedAt),
    disputeWindow: Number(o.disputeWindow),
    releaseAt,
    arbiterDeadline,
    canFinalize,
    now,
  };
}
