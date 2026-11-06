# Reach

## Who reads these entities
- **PoP** (`/verify/[handle]`, the checkout page's seller record, the `/proof` page), with PoP's Arkiv access key.
- **Kurta Co.**, a separate demo store (`apps/demo-store`), with its own Arkiv access key that PoP's server never sees. The store reads the seller's reviews itself and counts them under the same rules (creator is our attestor, readonly, payment is a real order on this contract). It does not call PoP's `/verify` API for reviews.
- **Anyone with a free Arkiv access key** (hub.arkiv.network), using the query in `how-you-use-arkiv.md`.

## How a judge can test it
1. Run `npx tsx scripts/arkiv-query.ts` (PoP's key) and `npx tsx scripts/arkiv-query.ts KURTA_ARKIV_ACCESS_KEY` (the store's key). Both print the same entities. Keys are never printed.
2. Open `/proof` and compare the Arkiv table with the output.
3. Open the Kurta Co. store: its "Our record" card is read by the store itself from the contracts and Arkiv.
4. Leave a review on an order that is Released (needs the World Simulator on a laptop; a phone asks for the real World App), then run the query again and look for the new entity: creator is the attestor, owner is the buyer's wallet, readonly is true.

## Query output (read on Sat 7 Nov 2026, Arkiv Rabdi, attestor `0xeF0CC7f7f280083e425A741957B920c7eF39A21c`)
The `/proof` entity table lists **17** entities created by our attestor. Earlier, on 6 Nov, we ran the query with both keys (PoP's and the Kurta store's own) and both returned the same 12 entities, none skipped. All have creator = the attestor and readonly = true. Owners are each entity's buyer wallet.

**Two are real, World-verified reviews** (regular entries):

| Entity key | Seller | Order | Rating | Owner (buyer) | Expires at block |
|---|---|---|---|---|---|
| `0xa444fb932ea107e2814e191d8adc878e5936fd70c64ea4bd90c936e508c03508` | @meera.jewels (`0x0bda…3dE9`) | 1 | 5 | `0xC47e…34cE` | 8064912 |
| `0x5f509ea8843c62d9c4b8c10de5a219710de819d62cdf0a43eea3301d6065f42b` | @kurta.co (`0xB6a8…58Cf`) | 18 | 5 | `0xefef…B91A` | 8069376 |

The other fifteen are not counted as reviews:
- 14 DEV entities, written by our local end-to-end tests with the development flag that skips the World proof. Their `pay_tx` values are fork transactions, so `/verify` ignores them on the real network, `/proof` labels them DEV, and they carry a 24 hour expiry. The count grows each time we run the full fork test, which is why it rose from 9 to 14 between the two readings.
- 1 smoke entity, `0x731d721cf6b3b621983f30bc21ee2a1ee1f6e40917e3113203a5e9b6cee6f620` (a clearly fake order 999000001, `pay_tx` is a placeholder, expires at block 309018). Its create transaction is `0xcb2da0660b9328b2705ba0fae2736fdd787899e446f4c825eeb6223fb31d0e63` (block 265818) and its ownership transfer is `0x0d7ec9768699fe503c72fa762b3f80b1b89bb7b6fa979b9e6f81e72b4ad6ce5e` (block 265821).

The second app's own key reads the two real reviews: `apps/demo-store` shows them in its "Our record" card, counted under the same rules (creator is our attestor, readonly, payment is a real order on this contract), without calling PoP's `/verify` API.

## Limits of the reach claim
The second app is our own demo store, not an independent third party. It shows that the data is readable without our API, not that anyone else has adopted it.
