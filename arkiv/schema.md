# Arkiv schema (PoP)

Network: Arkiv Rabdi testnet (chain 7794095). SDK: `@arkiv-network/sdk` 1.0.1, server-side only.

| Schema | Indexed columns | Other columns | Expiry | Flags | Creator → Owner |
|---|---|---|---|---|---|
| `pop_seller_v1` | seller (addr), handle (str), handle_tier (u64), status (str) | display (bytes JSON, no PII) | ~182 days, renewed | not readonly | attestor → attestor |
| `pop_review_v1` | seller (addr), order_id (u256), rating (u64), created_at (u64), reviewer_key (str = keccak(nullifier, seller)), buyer_history (u64) | pay_tx (str), text (bytes), buyer_sig (bytes) | max (7,884,000 blocks) | readonly | attestor → **buyer** |
| `pop_outcome_v1` | seller (addr), order_id (u256), outcome (str), settled_at (u64) | tx (str) | max | readonly | attestor → attestor |

_TODO: fill in after the smoke test confirms the column types._
