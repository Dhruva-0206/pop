/**
 * Plain-words explanations for every way a review can be refused, shown on the order page AFTER the World widget closes.
 * Why this exists: when our server refuses a proof, `handleVerify` throws, the widget shows its own generic "Verification declined" and
 * calls onError("failed_by_host_app") with no message. The widget cannot carry our reason, so the page keeps the server's reason
 * and shows it itself. Wording rules: honest reason plus a next step; no "nullifier", "escrow", "chain ID" or "gas".
 */
export type Refusal = { tone: "info" | "warn" | "danger"; title: string; body: string; next: string };

export const ALREADY_REVIEWED: Refusal = {
  tone: "warn",
  title: "You have already reviewed this seller.",
  body: "One review per person per seller.",
  next: "Your earlier review stays on their record and nothing new was published. You can review other sellers you have paid.",
};

/** The server's answer to POST /api/world/verify-review, /api/reviews/retry or /api/world/rp-signature when it says no. */
export function reviewRefusal(status: number, error?: string): Refusal {
  const e = (error ?? "").toLowerCase();
  if (e.includes("already reviewed this seller")) return ALREADY_REVIEWED;
  if (e.includes("already has a review")) {
    return { tone: "warn", title: "This order already has a review.", body: "Each order can be reviewed once.", next: "Scroll up to see it, or open the seller's record to see it published." };
  }
  if (e.includes("not published yet") || e.includes("use retry")) {
    return { tone: "info", title: "Your review is saved but not published yet.", body: "Publishing did not finish the first time.", next: "Press \"Try again to publish\". It does not ask for another World ID check." };
  }
  if (e.includes("only the buyer")) {
    return { tone: "danger", title: "Only the buyer can review this order.", body: "This browser is not the one that paid, so we cannot sign the review for you.", next: "Open this page on the device you paid from, then try again." };
  }
  if (e.includes("reviews open after")) {
    return { tone: "info", title: "Reviews are not open for this order yet.", body: "A review opens after the order is complete and the seller has been paid.", next: "Come back when this page says \"Seller paid\"." };
  }
  if (e.includes("order not found")) {
    return { tone: "danger", title: "We could not find this order for this seller.", body: "The link may be wrong.", next: "Go back to your order page from the link you were given." };
  }
  if (e.includes("not enabled for this seller")) {
    return { tone: "info", title: "Reviews are not switched on for this seller yet.", body: "Nothing was published.", next: "Tell the team if you expected to be able to review them." };
  }
  if (e.includes("proof required") || e.includes("no responses")) {
    return { tone: "danger", title: "No World ID proof reached us.", body: "Nothing was published.", next: "Press \"Verify with World ID and publish\" and finish the check in World App." };
  }
  if (e.includes("no accepted review")) {
    return { tone: "info", title: "There is no saved review to publish.", body: "Nothing was waiting to be published for this order.", next: "Write your review and press \"Verify with World ID and publish\"." };
  }
  if (e.includes("bad request")) {
    return { tone: "danger", title: "The review form could not be read.", body: "Nothing was published.", next: "Reload this page and try again." };
  }
  if (e.includes("limited to")) {
    return { tone: "warn", title: "Your review is too long.", body: error ?? "", next: "Shorten the text and try again." };
  }
  if (e.includes("server misconfigured") || e.includes("not configured") || status >= 500) {
    return { tone: "danger", title: "Something is wrong on our side.", body: "Nothing was published and no review was saved.", next: "Try again in a minute. If it repeats, tell the team." };
  }
  if (status === 400 && error) {
    // the World proof itself was refused (wrong action or environment, signal mismatch, or World's own reason)
    return { tone: "danger", title: "World ID did not accept this proof.", body: `Reason given: ${error}. Nothing was published and no review was saved.`, next: "Try once more with the same World ID. If it fails again, tell the team." };
  }
  return { tone: "danger", title: "The review was not submitted.", body: error ? `Reason given: ${error}.` : "We could not reach the server.", next: "Check your connection and try again." };
}

/** What the widget itself reported (IDKit error code), used only when our server did not give a reason. */
export function widgetRefusal(code: string): Refusal {
  switch (code) {
    case "user_rejected":
      return { tone: "info", title: "You cancelled in World App.", body: "Nothing was published.", next: "Press \"Verify with World ID and publish\" when you are ready." };
    case "nullifier_replayed":
    case "max_verifications_reached":
      return ALREADY_REVIEWED;
    case "connection_failed":
      return { tone: "warn", title: "World App could not be reached.", body: "Nothing was published.", next: "Check your connection and try again." };
    case "verification_rejected":
      return { tone: "danger", title: "World ID could not verify you.", body: "World said no, so nothing was published.", next: "Try again. If it keeps failing, tell the team." };
    case "failed_by_host_app":
      return { tone: "danger", title: "The review was not accepted.", body: "Our server said no but the widget did not pass on the reason.", next: "Try again. If it repeats, tell the team." };
    default:
      return { tone: "danger", title: "World ID stopped before finishing.", body: `Code from World: ${code}. Nothing was published.`, next: "You can try again." };
  }
}
