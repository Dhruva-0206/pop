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

/** Signed by the BUYER wallet to prove they are the buyer when publishing a review. Moves no money. */
export const reviewAuthMessage = (orderId: string, sellerHandle: string) =>
  `${APP_NAME} review\nOrder: ${orderId}\nSeller: ${sellerHandle.trim().toLowerCase()}\nThis signature only proves you are the buyer of this order. It moves no money.`;
