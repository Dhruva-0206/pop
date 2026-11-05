# Arkiv schema (PoP)

Network: Arkiv Rabdi testnet (chain 7794095). SDK: `@arkiv-network/sdk` 1.0.1, server-side only.

| Schema | Indexed columns | Other columns | Expiry | Flags | Creator → Owner |
|---|---|---|---|---|---|
| `pop_seller_v1` | seller (addr), handle (str), handle_tier (u64), status (str) | display (bytes JSON, no PII) | ~182 days, renewed | not readonly | attestor → attestor |
| `pop_review_v1` | seller (addr), order_id (u256), rating (u64), created_at (u64), reviewer_key (str = keccak(nullifier, seller)), buyer_history (u64) | pay_tx (str), text (bytes), buyer_sig (bytes) | max (7,884,000 blocks) | readonly | attestor → **buyer** |
| `pop_outcome_v1` | seller (addr), order_id (u256), outcome (str), settled_at (u64) | tx (str) | max | readonly | attestor → attestor |

Column types confirmed by smoke C and the review pipeline (Fri 6 Nov): `addr`, `u256`, `u64`, `str` come back as `{ type, value }`; `bytes` values are hex. Defined once in `packages/shared/src/server/arkiv.ts` (`ReviewSchema`). Notes: real reviews expire after ~180 days; reviews written with the dev-only skip-World flag use a `dev-` `reviewer_key` and expire after 24 hours; `buyer_history` is the bucket lower bound of how many protected orders that buyer wallet has in PoP's orders table: `1` (one order), `2` (2 to 5) or `6` (6 or more); it counts all registered orders by that wallet, not only completed ones. Entity identity is (attestor, `order_id`, `seller`, `pay_tx`): order ids restart on every checkout deployment, so readers must also check that `pay_tx` is a real payment on the contract they trust. Readers (`readSellerReviews`) keep only rows created by the attestor AND readonly.
