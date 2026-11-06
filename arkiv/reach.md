# Reach

## Who reads these entities
- **PoP** (`/verify/[handle]`, the checkout page's seller record, the `/proof` page), with PoP's Arkiv access key.
- **Kurta Co.**, a separate demo store (`apps/demo-store`), with its own Arkiv access key that PoP's server never sees. The store reads the seller's reviews itself and counts them under the same rules (creator is our attestor, readonly, payment is a real order on this contract). It does not call PoP's `/verify` API for reviews.
- **Anyone with a free Arkiv access key** (hub.arkiv.network), using the query in `how-you-use-arkiv.md`.

## How a judge can test it
1. Run `npx tsx scripts/arkiv-query.ts` (PoP's key) and `npx tsx scripts/arkiv-query.ts KURTA_ARKIV_ACCESS_KEY` (the store's key). Both print the same entities. Keys are never printed.
2. Open `/proof` and compare the Arkiv table with the output.
3. Open the Kurta Co. store: its "Our record" card is read by the store itself from the contracts and Arkiv.
4. Leave a review on an order that is Released (needs the World simulator; see `docs/OVERNIGHT.md`), then run the query again and look for the new entity: creator is the attestor, owner is the buyer's wallet, readonly is true.

## Query output (run Fri 6 Nov 2026, Arkiv Rabdi block 285848, attestor `0xeF0CC7f7f280083e425A741957B920c7eF39A21c`)
Both keys returned the same 8 entities, 0 skipped. All 8 have creator = the attestor and readonly = true. Owners are each entity's buyer wallet.

| Entity key | Kind | Order | Seller | Expires at block |
|---|---|---|---|---|
| `0x731d721cf6b3b621983f30bc21ee2a1ee1f6e40917e3113203a5e9b6cee6f620` | smoke test (clearly fake order 999000001, `pay_tx` is a placeholder) | 999000001 | attestor wallet | 309018 |
| `0x88992ab1260326d987ed34eadce1a7b161442a3bbb4eb4de762bb458e4659d0d` | DEV, no World proof | 1 | `0x0bda…3dE9` | 309719 |
| `0xa7db1f5c6d7e2d0a615a2e240af5966b105b4c92e64fd9d549225fc57b95f4d2` | DEV | 1 | `0x0bda…3dE9` | 310195 |
| `0xb4e8ba8614f489a7fd9394c392cc1904f01e93a8ed0f33fcb6f0ab8ea74d7a9d` | DEV | 5 | `0x0bda…3dE9` | 310245 |
| `0x945c5b6fba21a05ef1f2f336f025b12e41c1ffe7b334fbe58097209717ce6af6` | DEV | 1 | `0x0bda…3dE9` | 316048 |
| `0xf4fe370daaa1e9800d8fc22878c78f60bda83c6f0074a604d7b767989c19285e` | DEV | 1 | `0x0bda…3dE9` | 316513 |
| `0x7dbc246c36123730e732dd8ecb730683e10eb139aeff4dd6a1d66e456a265d06` | DEV | 1 | `0x0bda…3dE9` | 327884 |
| `0xae2e20407071cc143c4658aef4a8cea34b02cbf4256e289905a75b68efab588f` | DEV | 1 | `0x0bda…3dE9` | 328740 |

The seven DEV entities were written by our local fork end-to-end tests (the dev-only flag that skips the World proof). Their `pay_tx` values are fork transactions, so `/verify` ignores them on the real network ("entries ignored because their payment is not a protected order on this contract"), and they carry a 24 hour expiry. No real, World-verified review exists yet: that needs the one simulator click-through.

The smoke entity's create transaction is `0xcb2da0660b9328b2705ba0fae2736fdd787899e446f4c825eeb6223fb31d0e63` (block 265818) and its ownership transfer is `0x0d7ec9768699fe503c72fa762b3f80b1b89bb7b6fa979b9e6f81e72b4ad6ce5e` (block 265821).

## Limits of the reach claim
The second app is our own demo store, not an independent third party. It shows that the data is readable without our API, not that anyone else has adopted it.
