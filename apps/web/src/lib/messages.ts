import { keccak256, toBytes } from "viem";
import { APP_NAME, canonicalJson } from "@pop/shared";

/** Message a seller signs to open the dashboard. `nonce` is server-issued, single use, valid 5 minutes. Moves no money. */
export const sellerLoginMessage = (address: string, nonce: string) =>
  `${APP_NAME} seller dashboard sign-in\nAddress: ${address}\nNonce: ${nonce}\nThis signature only proves you control the wallet. It moves no money.`;

export type DeliveryDetails = { name: string; phone: string; address: string };

/** Fingerprint of the delivery details, so the signature below also covers them. */
export const deliveryFingerprint = (d: DeliveryDetails | undefined) =>
  d ? keccak256(toBytes(canonicalJson(d))) : "none";

/** Signed by the BUYER wallet to register an order (tx) and its ship-to details with the server. Moves no money. */
export const orderRegisterMessage = (txHash: string, delivery: DeliveryDetails | undefined) =>
  `${APP_NAME} order registration\nPayment tx: ${txHash.toLowerCase()}\nDelivery details: ${deliveryFingerprint(delivery)}\nThis signature only proves you made this payment. It moves no money.`;

export const REVIEW_TEXT_MAX = 500;

/** Trim, and drop control characters except tab/newline. Client and server must both use this before hashing. */
export const normaliseReviewText = (t: string) =>
  Array.from(t)
    .filter((ch) => {
      const c = ch.codePointAt(0)!;
      return c === 9 || c === 10 || (c >= 32 && c !== 127);
    })
    .join("")
    .trim();

/**
 * Signed by the BUYER wallet when publishing a review: proves they are the buyer AND fixes the rating and text,
 * so the attestor that writes the Arkiv entity cannot alter what the buyer said. Moves no money.
 */
export const reviewAuthMessage = (orderId: string, sellerHandle: string, rating: number, text: string) =>
  `${APP_NAME} review\nOrder: ${orderId}\nSeller: ${sellerHandle.trim().toLowerCase()}\nRating: ${rating}\nText: ${keccak256(toBytes(normaliseReviewText(text)))}\nThis signature only proves you are the buyer of this order and fixes what you wrote. It moves no money.`;

/** Signed by the BUYER wallet to retry publishing an already-accepted review to Arkiv. Moves no money. */
export const reviewRetryMessage = (orderId: string, sellerHandle: string) =>
  `${APP_NAME} review retry\nOrder: ${orderId}\nSeller: ${sellerHandle.trim().toLowerCase()}\nThis signature only asks PoP to retry publishing your review. It moves no money.`;

/** Signed by the seller's wallet to ask for onboarding: proves the requester controls the wallet that will be registered. */
export const onboardRequestMessage = (handle: string, wallet: string) =>
  `PoP seller onboarding\nHandle: @${handle.toLowerCase()}\nWallet: ${wallet.toLowerCase()}\nI control this Instagram account and this wallet.`;

/** Signed by the buyer's wallet when saving the reason text of a dispute (the on-chain evidenceHash is keccak(text)). */
export const disputeReasonMessage = (orderId: string, text: string) => `PoP dispute reason\nOrder: ${orderId}\nReason: ${text}`;
export const DISPUTE_TEXT_MAX = 500;
