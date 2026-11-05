import { formatUnits } from "viem";

/** "₹899 · 1.00 test USDT" */
export function priceLabel(priceInr: number, units: string | bigint, decimals: number): string {
  const usdt = Number(formatUnits(BigInt(units), decimals)).toFixed(2);
  return `₹${priceInr.toLocaleString("en-IN")} · ${usdt} test USDT`;
}

export const usdt = (units: string | bigint, decimals: number) => Number(formatUnits(BigInt(units), decimals)).toFixed(2);

export function when(unix: number): string {
  if (!unix) return "-";
  return new Date(unix * 1000).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function countdown(target: number, now: number): string {
  const s = target - now;
  if (s <= 0) return "passed";
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min ${s % 60}s` : `${s}s`;
}

export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

/** Buyer-facing names for order states. No "escrow" wording. */
export const STATE_LABEL: Record<string, string> = {
  Funded: "Paid · waiting for the seller to ship",
  Shipped: "Shipped · on its way",
  Delivered: "Delivered",
  Disputed: "Under review by PoP",
  Released: "Complete · seller paid",
  Refunded: "Refunded to you",
  Split: "Settled by review",
};
