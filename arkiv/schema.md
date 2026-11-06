# Arkiv schema (PoP)

Network: Arkiv Rabdi testnet, chain 7794095. SDK: `@arkiv-network/sdk` 1.0.1, used on the server only. The schema is defined once, in `packages/shared/src/server/arkiv.ts` (`ReviewSchema`), and is the same one `scripts/smoke-arkiv.ts` uses.

## What is implemented
Only one schema is written today.

| Schema | Indexed columns | Other columns | Expiry | Flags | Creator, then owner |
|---|---|---|---|---|---|
| `pop_review_v1` | `seller` (addr), `order_id` (u256), `rating` (u64), `created_at` (u64), `reviewer_key` (str), `buyer_history` (u64) | `pay_tx` (str), `text` (bytes, up to 500 characters), `buyer_sig` (bytes) | 180 days for a real review, 24 hours for a DEV entry | readonly | our attestor, then the buyer's wallet |

Planned and NOT implemented (no code writes them): `pop_seller_v1` (a public seller record) and `pop_outcome_v1` (one entity per settled order). They are listed so a reader knows the names are reserved. The seller record is read from the contracts instead, and `/verify/[handle]` counts outcomes from the checkout's own events.

## Column meaning
- `seller`: the seller's wallet.
- `order_id`: the on-chain order number. Order numbers restart on every checkout deployment, so an entity is identified by (attestor, `order_id`, `seller`, `pay_tx`), and readers count it only if `pay_tx` is an `OrderFunded` transaction on the current checkout contract.
- `rating`: 1 to 5.
- `reviewer_key`: the hex of `keccak(nullifier, seller)`. It lets anyone see that two reviews of one seller came from different people, and it cannot be linked across sellers because each seller has its own World ID action. The raw nullifier is never published. DEV entries start with `dev-`.
- `buyer_history`: how many protected orders that buyer wallet has made, stored as the lower bound of a bucket: 1, 2 (for 2 to 5) or 6 (for 6 or more).
- `pay_tx`: the payment transaction hash, the proof that the order exists.
- `text`, `buyer_sig`: the review text and the buyer's wallet signature over (order, seller, rating, hash of text). The signature means our writer cannot change what the buyer said.

## Trust rules for readers
A reader keeps an entity only if: `$creator` is our attestor, it is readonly, and its `pay_tx` is a real order for that seller on this contract. Everything else is counted as "ignored" and shown as such. Ownership is the buyer's wallet after the transfer, but ownership does not change what a reader trusts: the creator and the readonly flag do.

## Facts confirmed by running code (Fri 6 Nov)
- Types: `addr`, `u256`, `u64`, `str` come back as `{ type, value }`; `bytes` values are hex.
- The query has no `ne` or `not` in SDK 1.0.1, although the docs site lists them.
- `$expiresAt` is a block number, not a time. Block 309018 for the smoke entity, which was created at about block 265818, so about 43,200 blocks, matching 24 hours at about two seconds per block (our reading, not a stated figure).

## What stays off Arkiv on purpose
Money (it lives in the checkout contract), delivery details and phone numbers (encrypted in Postgres), the delivery code (only a hash is on the checkout contract), the raw World nullifier (only a SHA-256 hash is in Postgres and only a `keccak(nullifier, seller)` key is on Arkiv), seller bans (permanent, kept in the registry contract, never allowed to expire).
