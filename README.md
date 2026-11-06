# PoP: Proof of Purchase

**If it doesn't arrive, you get your money back automatically.**

PoP is a protected checkout for sellers on Instagram and WhatsApp, and for small websites. The buyer pays test USDT into a contract on Whitechain Sepolia. The seller is paid only when the buyer gives a 6-word delivery code at the door. If the seller misses a deadline, anyone can trigger a full refund. Reviews come only from paid orders, one per person per seller, and live on Arkiv.

Built from scratch at ETHGlobal Mumbai 2026 (5 to 7 Nov). It runs on a test network: test USDT has no value and no real money moves.

## The problem
Many small sellers in India take orders in Instagram DMs and WhatsApp. A buyer who pays first has no protection, so many insist on cash on delivery, which sellers dislike because refused parcels cost them. A new seller has no record a buyer can check, and a review on a chat app can be faked or deleted. This is our reading of the problem from the team's own experience, not a measured statistic. PoP gives the buyer a refund rule they can verify and gives the seller a record that only real, completed orders can build.

## The three promises
1. If it doesn't arrive, you get your money back automatically. Nobody can stop that refund, including us.
2. The money is released by the buyer's code at the door. Our courier key cannot release a single rupee.
3. Reputation is earned only from protected deliveries, counts each human once per seller, and lives on Arkiv where any app can read it.

How each promise is enforced:
- Promise 1: `finalize(orderId)` in `PoPCheckout` can be called by anyone. When a ship-by or deliver-by deadline has been missed it refunds the buyer in full. The contract has no pause and no function that lets an admin move funds. (The deployer wallet holds the admin role, which can only grant or revoke the courier and arbiter roles.)
- Promise 2: the contract stores only a hash of the code. The courier role can do one thing, move a shipped order to "disputed" before the delivery deadline. It cannot release or refund.
- Promise 3: a review is written to Arkiv by our attestor as a read-only entity and handed to the buyer. World ID proves the buyer is a unique person. A unique constraint in Postgres allows one review per person per seller.

## Architecture
```
 Buyer's browser (test wallet, keeps the 6-word code)
        |  pay (EIP-712 offer signed by the seller)         
        v                                                    
 PoPCheckout + SellerRegistry   <---- courier / arbiter / anyone (finalize)
 (Whitechain Sepolia 1874)
        | events                                  
        v                                         
 PoP web app (Next.js) ---- Supabase Postgres (encrypted delivery details, review claims, sessions)
        |                          
        +---- World ID verify ---- review proof (one per person per seller)
        +---- Arkiv Rabdi ------- readonly review entities (attestor creates, buyer owns)
        |
        +---- signed webhooks ---> Kurta Co. demo store (own Arkiv key, rechecks the chain itself)
```
- `contracts/`: `PoPCheckout` (orders, deadlines, disputes, pull payments) and `SellerRegistry` (attestor-signed registration, permanent bans). Solidity 0.8.30, Foundry, OpenZeppelin.
- `apps/web/`: the PoP site and its API (checkout, order page, seller record, onboarding, dashboard, courier, arbiter, proof, merchant API, webhooks).
- `apps/demo-store/`: Kurta Co., a separate app that sells through the "Pay with PoP" SDK.
- `packages/shared/`: chain config, EIP-712 types, ABIs, the Postgres store, the Arkiv helpers.
- `packages/checkout-sdk/`: server and browser halves of "Pay with PoP".

## Live links
- PoP: https://pop-web-six.vercel.app
- Kurta Co. demo store: https://kurta-store.vercel.app
- Proof page (every address, transaction, Arkiv entity and the World verification log): https://pop-web-six.vercel.app/proof
- Deployment checks and when they ran: `docs/evidence.md`.

## Contracts and transactions (Whitechain Sepolia, chain 1874, both verified on Blockscout)
| Contract | Address |
|---|---|
| PoPCheckout | [`0xB6A894bE070951a7331DebFf615e11F7a076794c`](https://explorer.testnet.whitechain.io/address/0xB6A894bE070951a7331DebFf615e11F7a076794c?tab=contract) |
| SellerRegistry | [`0x6D61cD77239dd61e43e943a4Aac006d8A6C285E5`](https://explorer.testnet.whitechain.io/address/0x6D61cD77239dd61e43e943a4Aac006d8A6C285E5?tab=contract) |
| Specified test USDT | [`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`](https://explorer.testnet.whitechain.io/address/0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7) |

Order #1, a full protected order with the specified USDT: pay [`0xa59f9067…aa5da3`](https://explorer.testnet.whitechain.io/tx/0xa59f9067bf1d58c716809efe520a0666e4aacbca2dfea4a52b0ad8a79caa5da3), deliver [`0x2df7522a…a8c3de`](https://explorer.testnet.whitechain.io/tx/0x2df7522a98d718c38bf7771f48447eb13d2e6fe3e5ba8fb076afbf8968a8c3de), finalize [`0x38708e79…c51290`](https://explorer.testnet.whitechain.io/tx/0x38708e796235108faede33d124e92e9777478041de13bec3a1322393e8c51290), seller withdraw [`0xee21a184…b5306a`](https://explorer.testnet.whitechain.io/tx/0xee21a18433c0a018c24d749faddc6f19f7c58322b55a3c987fe52bddc9b5306a). Order #2 was never shipped and was refunded by a third party. Every link is in `docs/evidence.md`.

## Arkiv
Reviews are `pop_review_v1` entities on Arkiv Rabdi (chain 7794095), created by our attestor wallet and handed to the buyer.
- Attestor (writer) wallet: `0xeF0CC7f7f280083e425A741957B920c7eF39A21c`
- Run the query yourself (read-only, needs a free access key from hub.arkiv.network):
```ts
import { createPublicClient, http } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
const client = createPublicClient({ chain: rabdi({ accessKey: "<your key>" }), transport: http() });
const page = await client
  .select({ $key: true, $owner: true, $creator: true, $creationFlags: true, seller: true, order_id: true, rating: true })
  .from(ReviewSchema) // packages/shared/src/server/arkiv.ts
  .createdBy("0xeF0CC7f7f280083e425A741957B920c7eF39A21c")
  .limit(25)
  .fetch();
// keep rows where $creator is the attestor AND $creationFlags.readonly is true
```
Or run `npx tsx scripts/arkiv-query.ts`. Output from a real run, schema, expiry and what stays off Arkiv: `arkiv/`.

## World ID
A real World ID proof was verified on the server on Fri 6 Nov 2026 at 16:43 IST, with the World Simulator in the staging environment ("Unique Human", World ID 4.0, the `proofOfHuman` preset). It was for order #1 of @meera.jewels. The review was published as Arkiv entity `0xa444fb932ea107e2814e191d8adc878e5936fd70c64ea4bd90c936e508c03508` (created by the attestor, owned by the test buyer, read-only). The World log on `/proof` shows the verified row (id `f2d508a533b2`). Details and limits: `docs/WORLD_DEBRIEF.md`.

## Pay with PoP (for merchants)
The store keeps its own seller key and signs its own offers; PoP never holds it. Server side:
```ts
const pop = new PoP({ baseUrl, apiKey, webhookSecret, merchantPk });
const { url } = await pop.createSession({ title: "Hand-block cotton kurta", priceInr: 1299, priceUsdt: "1.50", merchantRef: cartId, returnUrl });
// webhook route: signature first, then the chain
const ev = pop.verifyWebhook(await req.text(), req.headers.get("pop-signature"));
await pop.confirmOnChain(ev); // the order is ours, buyer and amount match, the state fits, the funding tx carries our merchantRef
```
Browser side: `startPayWithPoP("/api/checkout")` sends the buyer to the hosted checkout. Webhooks are `order.funded`, `order.shipped`, `order.delivered`, `order.released` and `order.refunded`, signed with `PoP-Signature: t=<unix>,v1=<hmac-sha256 of "t.body">`.

## Setup
Windows, Git Bash for Foundry (it does not run in PowerShell). Node 22 or newer.
```
git clone https://github.com/Dhruva-0206/pop.git && cd pop
git submodule update --init --recursive
npm install                       # at the repository root, never one level up
cp .env.example .env              # fill in the names; keys stay in .env, never in git
cd contracts && forge build && forge test   # 58 tests
```
Local loop on a fork of the test network (no real transactions): `npm run fork` in one terminal, then `npm run db:reset-fork`, `npm run fork:up`, `npm run seed:merchant`, `npm run dev:web`, and in `apps/demo-store` `npm run dev`. Then `npx tsx scripts/e2e-fork.ts` and `npx tsx scripts/e2e-merchant.ts`. To cover the review path locally start the web server with `POP_DEV_SKIP_WORLD=1` in the shell (never in `.env`, never on a deployed build). `DATABASE_URL` (Supabase Postgres) is required; there is no file fallback. The full list of environment variables for a deployment is in `docs/deployment.md`.

Do not run `npm run wallets` again: it would replace the team's wallets.

## Limitations
The main ones: the courier is simulated, one team key decides disputes, a seller can still buy from a second wallet, chain data is public, the database connection does not verify the certificate, demo timings are minutes, and everything is test USDT. Full list: `docs/limitations.md`.

## Prior art
- **Cash on delivery** is how most Indian social sellers protect buyers today. It protects the buyer and costs the seller refused parcels. PoP aims for the same buyer safety with prepayment.
- **Marketplace buyer protection and escrow services** hold money until delivery. They are run by a company that can change the rules and hold the funds. PoP puts the refund rule in a contract anyone can read and call.
- **Review systems** on marketplaces and social apps are held by the platform. PoP keeps reviews as entities the buyer owns and any app can read.
We did not survey these products in depth; this section states the idea, not a market study.

## Tools used
Foundry, OpenZeppelin Contracts, Solidity, Next.js, React, viem, `@arkiv-network/sdk`, World IDKit, Supabase Postgres (`pg`), Tailwind CSS, zod, qrcode, html5-qrcode, @scure/bip39, the Figtree and IBM Plex Mono fonts (and Fraunces for the Kurta Co. store), Vercel (two projects, links above).

## AI usage
See `AI_USAGE.md`. Design and writing rules we followed: `docs/ux-rules.md` and `docs/design-tokens.md`.

## License
MIT, see `LICENSE`.
