# Repo map (plain language, for the team)

Written Fri 6 Nov 2026 evening from the repo and from commands run that evening. Two pages on purpose. Paths are relative to the repo root.

## What each top-level folder does
| Folder | What it is |
|---|---|
| `contracts/` | The two Solidity contracts (`PoPCheckout` holds the money and the rules, `SellerRegistry` knows who is a registered or banned seller), their tests and the deploy script. Deployed once, not to be redeployed. |
| `apps/web/` | PoP itself, a Next.js app: buyer checkout, order page, vendor onboarding, dashboard, simulated courier, arbiter tools, `/proof`, `/verify`, and every API route (`src/app/api`). |
| `apps/demo-store/` | Kurta Co., a second shop with its own server, its own database schema and its own Arkiv key. It sells through PoP the way an outside merchant would. |
| `packages/shared/` | Code both apps use: contract ABIs, EIP-712 offer types, the log-range helper `chunkedLogs`, the database layer (`server/store.ts`), Arkiv helpers (`server/arkiv.ts`), encryption (`server/crypto.ts`). |
| `packages/checkout-sdk/` | "Pay with PoP": the merchant's server half (sign offers, create sessions, verify webhooks, recheck the chain) and the browser button. |
| `scripts/` | Command-line tools: deploy, fork, seed, the end-to-end tests (`e2e-fork.ts`, `e2e-merchant.ts`), `vercel-smoke.ts`, `demo-driver.ts`, and one-off probes. |
| `supabase/migrations/` | One SQL file, `0001_init.sql`. `npm run db:migrate` applies only this file, so new tables are appended to it. |
| `arkiv/`, `docs/`, `specs/` | Judge-facing Arkiv answers, our notes and evidence, and the planning documents. |
| `deployments/` | `testnet.json` with the live contract addresses and deploy block (12330545). |

## How one order moves through the code
1. **Offer.** The vendor signs an EIP-712 Offer in their browser wallet (`onboard/Onboard.tsx`). The server checks it and stores it as a listing (`api/onboard/listing`, `lib/server/offers.ts`).
2. **Pay.** The buyer opens `/p/<slug>` (`p/[listingId]/Checkout.tsx`). The page asks the faucet for test funds, approves the exact amount and calls `PoPCheckout.pay`. The six-word delivery code is made in the browser; only its hash goes on chain.
3. **Save.** `api/orders/confirm` reads the payment receipt itself and stores the delivery details encrypted (AES-256-GCM, key `ADDRESS_ENC_KEY`).
4. **Ship.** The vendor presses Mark shipped on `/dashboard`; the browser wallet sends `markShipped`.
5. **Deliver.** At `/courier` a team member types the buyer's six words. `api/courier/deliver` sends `confirmDelivery` from the server's courier key. The contract checks the code, not the courier.
6. **Settle.** After the problem window anyone calls `finalize` (the order page's Settle button, optional auto-settle, or `/proof`). A missed ship or deliver deadline makes `finalize` refund the buyer in full.
7. **Withdraw.** The seller (or buyer, for a refund) calls `withdraw`; the contract pays out test USDT. The 1% fee goes to the treasury.
8. **Webhooks.** `api/webhooks/dispatch` (Vercel cron every minute, plus order pages) scans chain events and tells Kurta; Kurta rechecks each event on chain before changing its order book.

## Where World ID, Arkiv and the database are used
- **World ID:** `lib/server/world.ts` (signing, server verify), `lib/server/vendor.ts` and `lib/vendor-rules.ts` (vendor check, one human one shop), `api/world/*`, `api/onboard/request`, `components/ReviewBox.tsx`, `onboard/Onboard.tsx`.
- **Arkiv:** `packages/shared/src/server/arkiv.ts` and `lib/server/reviews.ts` write a read-only review entity and hand it to the buyer; `api/verify/[handle]`, `/proof` and `apps/demo-store/src/lib/reputation.ts` read it.
- **Database (Supabase Postgres):** `packages/shared/src/server/store.ts`. Schema `public` is the real testnet data, `pop_fork` is the local fork, the store uses `kurta_<chain id>`. The database holds private data (encrypted delivery details), workflow state and the one-review and one-shop claims. The chain, not the database, is the authority for money.

## Environment variables that matter, and what each needs
| Variable | Service it needs | If it is wrong |
|---|---|---|
| `DATABASE_URL`, `ADDRESS_ENC_KEY`, `SESSION_SECRET` | Supabase; none | Every page that touches data fails; losing the encryption key makes saved addresses unreadable |
| `WHITECHAIN_RPC_URL`, `CHECKOUT_ADDRESS`, `REGISTRY_ADDRESS`, `DEPLOY_BLOCK` | Whitechain public RPC | Chain reads fail |
| `FAUCET_PK` | Test WBT and test USDT on the faucet wallet | New buyers get no funds; in demo mode it also pays vendor registrations |
| `COURIER_PK`, `COURIER_PASSCODE` | Test WBT; the team passcode | Delivery confirmation stops |
| `ATTESTOR_PK`, `ARKIV_ACCESS_KEY` | Test WBT, Arkiv test tokens, an Arkiv key | Registrations and review publishing stop |
| `WORLD_APP_ID`, `WORLD_RP_ID`, `WORLD_RP_SIGNING_KEY`, `WORLD_ENVIRONMENT`, `VENDOR_WORLD_ACTION` | World Developer Portal (staging) | Reviews and vendor onboarding stop |
| `ONBOARD_DEMO_AUTOAPPROVE` | none | Only works on testnet; leave unset unless demoing |
| Store: `POP_API_KEY`, `POP_WEBHOOK_SECRET`, `MERCHANT_PK`, `KURTA_ARKIV_ACCESS_KEY` | PoP, Whitechain, Arkiv | The store cannot create sessions or read reviews |

The full per-project list is in `docs/deployment.md`. Never set `POP_DEV_SKIP_WORLD` on a deployed project.

## The five riskiest places during judging
1. **The public Whitechain RPC.** Whitechain's docs cap it at 50 requests per second per IP, and we saw HTTP 403 when one IP polled hard. Each `/proof` load, order page and webhook pass scans events from the deploy block, so work grows with the chain. First move: stop any polling loops, wait a minute, reload.
2. **The faucet wallet.** It held 6.00 test USDT and 0.296 WBT at last read on `/proof`; each new browser wallet takes 2 USDT and 0.05 WBT, and demo-mode vendor registrations spend its WBT. When it runs dry new buyers cannot pay. First move: top it up before judging (this one needs a human).
3. **World ID dependency.** Vendor onboarding now requires a World proof, so the portal action named in `VENDOR_WORLD_ACTION` (default `vendor-onboard`) must exist in staging, and the Simulator must be reachable. A phone cannot complete a staging proof. First move: have the Simulator open on a laptop; fall back to the already published reviews on `/proof`.
4. **The one shared database.** Live, local fork and the store use the same Supabase project (different schemas). A mistaken `db:reset-fork` would only drop fork schemas, but a dropped connection pool or a full free-tier limit takes every page down. First move: check `/api/config` and `/proof`; they fail first.
5. **Serverless writes to Arkiv and the cron.** Review publishing is serialized in one process only, so two reviews at the same moment on different server instances can clash on a nonce, and we have not seen the Vercel cron fire in its own log (the 5-second loop on a laptop hides it). First move: watch the cron log in Vercel; a failed review shows "Try again to publish" and does not ask for a new World proof.

Also worth knowing: every push to `main` redeploys both live sites, and the time windows (3 min to ship, 120 s or 30 s to report a problem) are real seconds.

## Claims in the README or docs that the code does not back, or that only a script has tested
Checked against the code on Fri 6 Nov evening.

**Not true, fixed or removed in the new README**
- The old README said successful World verification was still pending and that the Arkiv sample was smoke and DEV entries only. Both were out of date (two real reviews exist).
- It said "deployed browser walkthrough needs separate verification" without saying one phone payment (order #19) and one browser payment (order #11) exist.

**Tested only by a script or by reading code, never clicked in a browser by a person**
- `/onboard` as a whole (handle, World, bio code, demo mode, QR) and `/arbiter` buttons (ban, force refund, resolve, approve).
- `/dashboard` auto sign-in and the one-time fee top-up before Mark shipped (shipping was proven by calling the same API and contract functions).
- The new refusal messages on `/o/<id>` and `/onboard`, the "Use a new test wallet" button, and the `/proof` faucet row (checked in source and on the fork).
- The `/courier` page itself (its API was exercised many times).
- Disputes, the arbiter timeout refund and the banned-seller refund on the live testnet: run on the local fork and, for a split, by script (order #16). The banned-seller refund (order #20) has not been pressed.

**Not done at all**
- A real World proof for the vendor action; a cancelled World request recorded; the Vercel cron firing confirmed in Vercel's own log; a phone or Safari check beyond order #19; Outcome entities on Arkiv (`pop_outcome_v1` is a reserved name only).
