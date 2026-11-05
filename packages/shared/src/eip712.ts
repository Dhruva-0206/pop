import type { Address, Hex } from "viem";
import { APP_NAME, EIP712_VERSION } from "./config";

/** Must match `Offer` in contracts/src/PoPCheckout.sol field-for-field (Architecture §5.3). */
export const offerTypes = {
  Offer: [
    { name: "seller", type: "address" },
    { name: "listingId", type: "bytes32" },
    { name: "termsHash", type: "bytes32" },
    { name: "externalRef", type: "bytes32" },
    { name: "price", type: "uint256" },
    { name: "shipWithin", type: "uint32" },
    { name: "deliverWithin", type: "uint32" },
    { name: "maxUnits", type: "uint32" },
    { name: "validUntil", type: "uint64" },
    { name: "version", type: "uint256" },
  ],
} as const;

export type Offer = {
  seller: Address;
  listingId: Hex;
  termsHash: Hex;
  externalRef: Hex;
  price: bigint;
  shipWithin: number;
  deliverWithin: number;
  maxUnits: number;
  validUntil: bigint;
  version: bigint;
};

export const offerDomain = (chainId: number, verifyingContract: Address) =>
  ({ name: APP_NAME, version: EIP712_VERSION, chainId, verifyingContract }) as const;

/** Order states, same order as the Solidity enum. */
export const ORDER_STATES = [
  "None",
  "Funded",
  "Shipped",
  "Delivered",
  "Disputed",
  "Released",
  "Refunded",
  "Split",
] as const;
export type OrderState = (typeof ORDER_STATES)[number];
