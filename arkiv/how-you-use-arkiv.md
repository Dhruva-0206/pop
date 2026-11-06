# How we use Arkiv

## The flow of one review
1. A buyer's order is Released on the checkout contract.
2. The buyer signs (order, seller, rating, hash of the text) with their wallet and proves with World ID that they are a unique person. The server checks the contract state, the signature and the proof.
3. The server claims the review in Postgres (one transaction: a unique row per person per seller, a unique row per order). This is the only place "one review per person per seller" is enforced.
4. Our attestor wallet creates a `pop_review_v1` entity on Arkiv with the readonly flag set.
5. The attestor calls `changeOwnership` so the entity belongs to the buyer's wallet.
6. The server reads the entity back and checks creator, owner and readonly. If any step fails the review row stays `pending` or `failed` and a retry resumes it without a second claim.

Code: `packages/shared/src/server/arkiv.ts` (`publishReview`, `readSellerReviews`).

## Features we use
- **Readonly entities.** Nobody, including us, can edit a review after step 4.
- **`createdBy(attestor)` filter.** Readers ask only for entities our attestor created.
- **Ownership transfer.** The buyer holds the review entity, so it belongs to them.
- **Expiry as policy.** A real review lasts 180 days and fades. A DEV review (written without a World proof during local testing) lasts 24 hours. Bans are not stored on Arkiv, so they never fade.
- **Indexed columns.** `seller` and `order_id` for lookups.
- **Two apps, two keys.** PoP's `/verify/[handle]` and the Kurta Co. store both read these entities, each with its own access key.

## The query (run on Fri 6 Nov, output in `reach.md`)
```
npx tsx scripts/arkiv-query.ts                           # with PoP's key
npx tsx scripts/arkiv-query.ts KURTA_ARKIV_ACCESS_KEY    # with the store's own key
```
The same query, as plain SDK code, is on the `/proof` page:
```ts
import { createPublicClient, http } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
const client = createPublicClient({ chain: rabdi({ accessKey: "<your key>" }), transport: http() });
const page = await client
  .select({ $key: true, $owner: true, $creator: true, $creationFlags: true, seller: true, order_id: true, rating: true })
  .from(ReviewSchema) // defined in packages/shared/src/server/arkiv.ts
  .createdBy("0xeF0CC7f7f280083e425A741957B920c7eF39A21c")
  .limit(25)
  .fetch();
// keep rows where $creator is that address AND $creationFlags.readonly is true
```
Attestor (writer) wallet: `0xeF0CC7f7f280083e425A741957B920c7eF39A21c`.

## What a reader sees in the product
`/verify/[handle]` shows the average and the list of reviews, plus how many entries were ignored and why (not readonly, or payment not on this contract). DEV entries are listed separately and never counted.
