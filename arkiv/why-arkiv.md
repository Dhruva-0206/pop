# Why Arkiv

## What a Postgres-only version would lose
- **Reviews we cannot edit.** In Postgres we are the database owner, so a buyer has no reason to believe we did not change or delete a review. On Arkiv the entity is readonly and was created by a known wallet, so anyone can check that.
- **Reviews that belong to the buyer.** The entity is owned by the buyer's wallet after the transfer. We cannot take it back.
- **A record other apps can read without us.** The Kurta Co. store reads the same entities with its own access key and does not call PoP's `/verify` API. If PoP's website were down, a second app configured with the contract addresses (the `CHAIN_ID`, `RPC_URL`, `CHECKOUT_ADDRESS`, `REGISTRY_ADDRESS` and `DEPLOY_BLOCK` pin) could still show the seller's record and reviews.
- **Public checkability.** The `/proof` page lists the entity keys and a query anyone can run.

## What we keep off Arkiv on purpose
- **Money.** Payments, refunds and balances live in the checkout contract, where code enforces them.
- **Permanent penalties.** Bans and lost disputes live in the registry and checkout contracts. Arkiv entities expire, and a penalty must not.
- **Personal data.** Names, phones and addresses are encrypted in Postgres and never leave it.
- **The one-review-per-person rule.** It is enforced by a unique constraint in Postgres, because Arkiv has no uniqueness constraint. Arkiv only receives `keccak(nullifier, seller)`.

## What Arkiv does not do for us (honest limits)
- It cannot stop us from refusing to write a review. A buyer's signed review can sit as `pending` if our writer is down; the retry endpoint exists for that. The buyer's signature proves what they wrote.
- Readers must trust our attestor wallet as the creator. The trust is in a published wallet address, not in a decentralised group of writers.
- Entities expire (180 days for real reviews). Good reviews fade by design.
