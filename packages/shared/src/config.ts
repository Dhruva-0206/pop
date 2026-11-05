/**
 * The product name lives here and only here (plus the EIP-712 domain, which reads it).
 * Change it ONLY before the first testnet deploy: the contract's EIP-712 domain name must match.
 */
export const APP_NAME = "PoP" as const;
export const APP_TAGLINE = "Proof of Purchase" as const;

/** EIP-712 domain version. Must match PoPCheckout's constructor. */
export const EIP712_VERSION = "1" as const;

/** Specified Whitechain test USDT (prize text). Read decimals() at runtime; never assume 6. */
export const USDT_ADDRESS = "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7" as const;

/** Arkiv schema names (versioned). */
export const ARKIV_SCHEMAS = {
  seller: "pop_seller_v1",
  review: "pop_review_v1",
  outcome: "pop_outcome_v1",
} as const;
