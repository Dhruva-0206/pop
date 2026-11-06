import "server-only";
import { createPublicClient, http, type Address } from "viem";
import { checkoutAbi, chunkedLogs, registryAbi } from "@pop/shared";
import { readSellerReviews } from "@pop/shared/server/arkiv";
import { chainInfo } from "./pop";

export type Reputation = {
  active: boolean;
  completed: string;
  lostDisputes: string;
  totalOrders: number;
  reviews: { count: number; average: number | null; latest: { rating: number; text?: string; createdAt: number }[]; devIgnored: number; unmatchedIgnored: number };
  error?: string;
};

/**
 * Kurta Co.'s trust badge, read DIRECTLY from the sources, not through PoP's /api/verify:
 *  - counters from the contracts (completed, lostDisputes, every OrderFunded as the denominator),
 *  - reviews from Arkiv with THIS store's own access key (KURTA_ARKIV_ACCESS_KEY), keeping only entities created by PoP's attestor,
 *    readonly (enforced by readSellerReviews), and tied to a real payment on this checkout contract.
 */
export async function readReputation(seller: Address): Promise<Reputation> {
  const key = process.env.KURTA_ARKIV_ACCESS_KEY?.trim();
  const attestor = process.env.POP_ATTESTOR_ADDRESS?.trim() as Address | undefined;
  const cfg = await chainInfo();
  const pc = createPublicClient({ transport: http(cfg.rpcUrl) });
  const [active, completed, lostDisputes] = await Promise.all([
    pc.readContract({ address: cfg.registry, abi: registryAbi, functionName: "isActive", args: [seller] }),
    pc.readContract({ address: cfg.checkout, abi: checkoutAbi, functionName: "completed", args: [seller] }),
    pc.readContract({ address: cfg.checkout, abi: checkoutAbi, functionName: "lostDisputes", args: [seller] }),
  ]);
  const tip = await pc.getBlockNumber({ cacheTime: 0 });
  const funded = await chunkedLogs(BigInt(cfg.deployBlock), tip, (fromBlock, toBlock) =>
    pc.getContractEvents({ address: cfg.checkout, abi: checkoutAbi, eventName: "OrderFunded", args: { seller }, fromBlock, toBlock }),
  );
  const out: Reputation = {
    active,
    completed: completed.toString(),
    lostDisputes: lostDisputes.toString(),
    totalOrders: funded.length,
    reviews: { count: 0, average: null, latest: [], devIgnored: 0, unmatchedIgnored: 0 },
  };
  if (!key || !attestor) {
    out.error = "Reviews unavailable: KURTA_ARKIV_ACCESS_KEY / POP_ATTESTOR_ADDRESS not set for this store.";
    return out;
  }
  try {
    const all = await readSellerReviews(key, attestor, seller);
    const fundedTx = new Set(funded.map((e) => e.transactionHash.toLowerCase()));
    const matched = all.rows.filter((r) => fundedTx.has(r.payTx.toLowerCase()));
    const real = matched.filter((r) => !r.dev);
    out.reviews = {
      count: real.length,
      average: real.length ? real.reduce((s, r) => s + r.rating, 0) / real.length : null,
      latest: real.slice(0, 3).map((r) => ({ rating: r.rating, text: r.text, createdAt: r.createdAt })),
      devIgnored: matched.length - real.length,
      unmatchedIgnored: all.rows.length - matched.length,
    };
  } catch {
    out.error = "Reviews are temporarily unavailable.";
  }
  return out;
}
