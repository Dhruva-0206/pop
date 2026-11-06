/**
 * Plain-words messages for a failed payment. viem prints 'The contract function "pay" reverted.' for every custom error that has
 * no arguments (SoldOut, OfferExpired, SelfPurchase and so on); the name is only inside the nested error object, so we read it from
 * there. The chain is walked by error name (not instanceof) so it works whichever copy of viem threw it.
 * Buyer wording: no "escrow", "nullifier", "chain ID" or "gas".
 */
const BY_ERROR: Record<string, string> = {
  SoldOut: "This item is sold out. The seller has no units left at this price.",
  OfferExpired: "This offer has expired. Ask the seller for a fresh link.",
  OfferRevoked: "The seller has withdrawn this offer. Ask for a fresh link.",
  SellerNotActive: "This seller is not active right now, so payment is switched off. Nothing was taken.",
  SelfPurchase: "This test wallet is the seller's own wallet, and a seller cannot buy from themselves. Use a different test wallet, or clear this browser's test wallet and try again.",
  BadSignature: "The seller's signature on this offer does not check out. Do not pay; tell the seller.",
  BadOffer: "The terms of this offer are not valid. Do not pay; tell the seller.",
};

type Nested = { name?: string; cause?: unknown; shortMessage?: string; message?: string; reason?: string; data?: { errorName?: string } };

function chain(e: unknown): Nested[] {
  const out: Nested[] = [];
  let cur = e as Nested | undefined;
  for (let i = 0; cur && typeof cur === "object" && i < 12; i++) {
    out.push(cur);
    cur = cur.cause as Nested | undefined;
  }
  return out;
}

export function friendlyPayError(e: unknown): string {
  const links = chain(e);
  if (links.some((x) => x.name === "UserRejectedRequestError")) return "You cancelled the payment. Nothing was taken.";
  const rev = links.find((x) => x.name === "ContractFunctionRevertedError");
  if (rev) {
    const name = rev.data?.errorName;
    if (name && BY_ERROR[name]) return BY_ERROR[name];
    const reason = rev.reason ?? "";
    if (/exceeds balance/i.test(reason)) return "Your test wallet does not hold enough test USDT for this price. Press Pay again to add test funds, or ask the team to top up the faucet.";
    if (/exceeds allowance/i.test(reason)) return "The amount was not allowed yet. Press Pay again.";
    if (reason) return `The payment was refused: ${reason}. Nothing was taken.`;
    return name
      ? `The payment was refused (${name}). Nothing was taken.`
      : "The payment was refused and the contract gave no reason. Nothing was taken; try again, and tell the team if it repeats.";
  }
  const first = (links[0]?.shortMessage ?? links[0]?.message ?? "").split("\n")[0];
  if (/insufficient funds/i.test(links.map((x) => x.shortMessage ?? x.message ?? "").join(" "))) return "Your test wallet needs a little test WBT to send the payment. Press Pay again to add test funds.";
  return first || "Something went wrong";
}
