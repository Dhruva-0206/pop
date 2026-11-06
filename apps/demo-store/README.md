# Kurta Co. (demo merchant for "Pay with PoP")

A separate Next.js app that sells one product through PoP's protected checkout using `@pop/checkout-sdk`. Test mode only: test USDT has no value.

What it shows
- **Pay with PoP** button (`src/app/PayButton.tsx`, browser half of the SDK) -> `POST /api/checkout` (server half: signs the Offer with the store's own seller key, creates a single-use session with its API key) -> PoP's hosted checkout.
- **Webhook receiver** `POST /api/pop/webhook`: verifies the HMAC signature over the raw body, then rechecks the order ON-CHAIN (`confirmOnChain`: order is ours, buyer/amount match, state fits the event, funding tx carries our `merchantRef`) before it changes its order book (`/orders`).
- **Its own record**: the product page reads the seller's counters from the contracts and reviews from Arkiv with this store's OWN access key (`KURTA_ARKIV_ACCESS_KEY`), counting only entities created by PoP's attestor, readonly, and tied to a real payment.

Setup (local)
1. From `pop/`: `npm run seed:merchant` (registers @kurta.co, creates the API key + webhook secret, writes `apps/demo-store/.env.local`; values are never printed).
2. Add `KURTA_ARKIV_ACCESS_KEY=` (its own key) to `apps/demo-store/.env.local`.
3. `npm run dev -w @pop/demo-store` (port 3001) with the PoP web app on port 3000 and `npm run webhooks` running.

Env names (`.env.local` or the Vercel project): `POP_BASE_URL`, `POP_API_KEY`, `POP_WEBHOOK_SECRET`, `MERCHANT_PK`, `POP_ATTESTOR_ADDRESS`, `KURTA_ARKIV_ACCESS_KEY`, optional `KURTA_ORIGIN`, and the optional chain pin `CHAIN_ID`, `RPC_URL`, `CHECKOUT_ADDRESS`, `REGISTRY_ADDRESS`, `DEPLOY_BLOCK`.

Limits (demo): the order book is in memory (a restart forgets it; every status in it was chain-confirmed so it can be rebuilt), and only five events are sent (funded, shipped, delivered, released, refunded).
