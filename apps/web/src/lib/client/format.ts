import { formatUnits } from "viem";

const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** "₹1,299" with Indian digit grouping (₹1,00,000 for a lakh). */
export const inr = (n: number) => `₹${INR.format(n)}`;

/** "₹899 · 1.00 test USDT" */
export function priceLabel(priceInr: number, units: string | bigint, decimals: number): string {
  return `${inr(priceInr)} · ${usdt(units, decimals)} test USDT`;
}

export const usdt = (units: string | bigint, decimals: number) => Number(formatUnits(BigInt(units), decimals)).toFixed(2);

const TIME = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
const DAY = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });

/** Time of day in IST, "3:12 pm". */
export function clockTime(unix: number): string {
  if (!unix) return "";
  return TIME.format(new Date(unix * 1000)).replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toLowerCase()}`);
}

/** "3:12 pm, 6 Nov" in IST. */
export function when(unix: number): string {
  if (!unix) return "not yet";
  return `${clockTime(unix)}, ${DAY.format(new Date(unix * 1000))}`;
}

export function countdown(target: number, now: number): string {
  const s = target - now;
  if (s <= 0) return "passed";
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min ${s % 60} s` : `${s} s`;
}

export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

/** Buyer-facing names for order states. No "escrow" wording. */
export const STATE_LABEL: Record<string, string> = {
  Funded: "Paid. Waiting for the seller to ship.",
  Shipped: "Shipped. On its way to you.",
  Delivered: "Delivered. The problem window is open.",
  Disputed: "Under review by PoP.",
  Released: "Complete. The seller was paid.",
  Refunded: "Refunded to you.",
  Split: "Settled by review.",
};

/** One word for the status stamp on the receipt. */
export const STAMP: Record<string, string> = {
  Funded: "Paid",
  Shipped: "Shipped",
  Delivered: "Delivered",
  Disputed: "In dispute",
  Released: "Seller paid",
  Refunded: "Refunded",
  Split: "Split",
};
