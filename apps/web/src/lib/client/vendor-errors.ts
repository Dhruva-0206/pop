/**
 * Plain-words reasons for the vendor World ID step of /onboard. Same idea as review-errors.ts: when our server refuses a proof,
 * `handleVerify` throws, the widget shows its own vague "Verification declined" and calls onError("failed_by_host_app") with no
 * message, so the page keeps the server's reason and shows it itself.
 * Honesty: the "banned" rule is a PoP database rule, not an on-chain rule, and the text must not say otherwise.
 */
import type { Refusal } from "./review-errors";

export const ONE_PERSON_NOTE = "This proves you are one unique person. It does not prove who you are.";
export const DEMO_NOTE = "Demo mode: the staff check of your bio is skipped on testnet.";

const REPLAY: Refusal = {
  tone: "warn",
  title: "This person already has a PoP shop.",
  body: "One person can open one shop. Nothing new was registered.",
  next: "Use the shop you already have. If you think this is a mistake, tell the team.",
};

export function vendorRefusal(status: number, error?: string): Refusal {
  const e = (error ?? "").toLowerCase();
  if (e.includes("already has a pop shop")) return REPLAY;
  if (e.includes("banned from selling")) {
    return {
      tone: "danger",
      title: "This person was banned from selling on PoP.",
      body: "PoP keeps this rule in its own database, linked to the ban the arbiter recorded. It is not a rule inside the contracts.",
      next: "If you think this is a mistake, tell the team.",
    };
  }
  if (e.includes("handle or wallet is banned")) {
    return { tone: "danger", title: "This handle or wallet is banned.", body: "It cannot be registered.", next: "Pick another handle, or tell the team if this is a mistake." };
  }
  if (e.includes("already registered")) {
    return { tone: "warn", title: "This handle is already a PoP shop.", body: "A handle can only be registered once.", next: "Check the spelling, or look up the shop on its record page." };
  }
  if (e.includes("already has an onboarding request")) {
    return { tone: "warn", title: "This handle or wallet already has a request in progress.", body: "Only one request can be open at a time.", next: "Reload this page to continue it, or try another handle." };
  }
  if (e.includes("too many pending")) {
    return { tone: "info", title: "Too many requests are waiting right now.", body: "Nothing was registered.", next: "Try again in a few minutes." };
  }
  if (e.includes("handle must be")) {
    return { tone: "warn", title: "That handle does not look right.", body: "Use 1 to 30 letters, numbers, dots or underscores, without the @.", next: "Fix the handle and try again." };
  }
  if (e.includes("development server")) {
    return { tone: "danger", title: "Skipping World ID is not allowed here.", body: "That button only works on a local development server.", next: "Use the normal World ID check." };
  }
  if (e.includes("proof required") || e.includes("no responses")) {
    return { tone: "danger", title: "No World ID proof reached us.", body: "Nothing was registered.", next: "Press \"Verify with World ID\" and finish the check in World App." };
  }
  if (status >= 500 || e.includes("not configured")) {
    return { tone: "danger", title: "Something is wrong on our side.", body: "Nothing was registered.", next: "Try again in a minute. If it repeats, tell the team." };
  }
  if (status === 400 && error) {
    return { tone: "danger", title: "World ID did not accept this proof.", body: `Reason given: ${error}. Nothing was registered.`, next: "Try once more. If it fails again, tell the team." };
  }
  return { tone: "danger", title: "The check did not go through.", body: error ? `Reason given: ${error}.` : "We could not reach the server.", next: "Check your connection and try again." };
}

/** What the widget itself reported, used only when our server gave no reason. */
export function vendorWidgetRefusal(code: string): Refusal {
  switch (code) {
    case "user_rejected":
      return { tone: "info", title: "You cancelled in World App.", body: "Nothing was registered.", next: "Press \"Verify with World ID\" when you are ready." };
    case "nullifier_replayed":
    case "max_verifications_reached":
      return REPLAY;
    case "connection_failed":
      return { tone: "warn", title: "World App could not be reached.", body: "Nothing was registered.", next: "Check your connection and try again." };
    case "verification_rejected":
      return { tone: "danger", title: "World ID could not verify you.", body: "World said no, so nothing was registered.", next: "Try again. If it keeps failing, tell the team." };
    case "failed_by_host_app":
      return { tone: "danger", title: "The check was not accepted.", body: "Our server said no but the widget did not pass on the reason.", next: "Try again. If it repeats, tell the team." };
    default:
      return { tone: "danger", title: "World ID stopped before finishing.", body: `Code from World: ${code}. Nothing was registered.`, next: "You can try again." };
  }
}
