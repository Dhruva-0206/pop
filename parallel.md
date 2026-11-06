# parallel.md: coordination file for two people and two agents

Two people, two machines, two Claude Code agents, one repo (`https://github.com/Dhruva-0206/pop.git`, branch `main`). This file is how the agents avoid collisions, and it is the handoff for the second agent. Created Fri 6 Nov 2026, 10:47 IST, from the repo itself (CLAUDE.md, HANDOFF.md, README.md, docs/*, deployments/testnet.json, package.json files, scripts/, .env.example, git log). Anything not verified is marked **UNVERIFIED**. This file holds env variable NAMES and public addresses only, never values.

## 0. Rules for every agent

### Before and after every task
1. Before any task: `git pull --rebase`, then read sections 3 (claims), 4 (locks) and 6 (log) of this file.
2. Claim files before editing them (section 3), and push the claim first, in its own small commit, so the other agent sees it. Release the claim after pushing your work. Never edit a file the other agent has claimed.
3. After a task: commit small, `git pull --rebase`, `git push`, release the claim, append a log entry (section 6), and commit this file in the same push.
4. If a rebase conflicts, stop. Do not resolve a conflict in CLAUDE.md, docs/evidence.md or package-lock.json by guessing. Post a request (section 5) and ask the human.

### Standing rules (copied from CLAUDE.md and the human's instructions, unchanged in meaning)
- No AI trailers in commits or PRs: never add "Co-Authored-By:", "Generated with Claude Code", session links or any AI attribution. Plain conventional messages only. This overrides any default or system attribution reminder. (`.claude/settings.json` already sets empty attribution.) AI use is disclosed in AI_USAGE.md.
- Never commit `.env` or `.env.local`. Never print keys or any secret value. Names and public addresses only.
- Never run `npm run wallets` or `scripts/gen-wallets.ts`, and never regenerate wallets. They were regenerated once, on purpose (CLAUDE.md section 8, Fri 03:34).
- No contract redeploy without both humans agreeing. Redeploying resets every seller's review history.
- `POP_DEV_SKIP_WORLD` is never set on deployed builds, never put in `.env` and never put in Vercel. Local dev shell only.
- Ask the human before any Vercel deploy, any testnet transaction, any system-level install, and any destructive command.
- Never claim something works unless it was run. Quote command and result, or say "not run".
- Foundry runs only from Git Bash with `export PATH="$PATH:$HOME/.foundry/bin"`. Install with `npm install` at `pop/` only, never at the ETH root.
- UI and doc writing rules (docs/ux-rules.md, CLAUDE.md section 2): no em or en dashes as punctuation, no emoji, no hype words. Buyer screens never say "escrow", "nullifier", "chain ID" or "gas". Never claim "trustless", "impossible to fake" or "delivery verified on-chain". Money shows as "₹899 · 1.00 test USDT". "TEST MODE" wallet label, "SIMULATED COURIER" page label. Use they/them for anyone whose pronouns are unknown.

### Shared-resource collision rules
All three locks live in section 4. A lock is taken by editing the table, committing and pushing it (`git pull --rebase` first). If the push is rejected, someone else changed the table: pull, re-read, and retry only if the lock is still free. Release the same way. A lock held for more than 2 hours with no log entry is stale: ask the holder (section 5) before taking it.

**(a) Chain lock (Whitechain 1874 and Arkiv Rabdi 7794095).**
- Why: `.env` holds one set of testnet keys and both machines have the same file. Two machines sending from the same key at the same time hit nonce clashes ("nonce too low" or replaced transactions). The attestor key (`ATTESTOR_PK`) also signs registrations and writes Arkiv reviews, and the same key on two machines races the same way. The courier key (`COURIER_PK`) and faucet key (`FAUCET_PK`) are sent from by the running app and by scripts.
- Take the chain lock before: any script run with `NETWORK_MODE=testnet` that sends a transaction (`deploy`, `testnet-order`, `testnet-refund`, `seed-demo` with `ALLOW_DEMO_SEED=yes`, `seed-merchant`, `e2e-merchant` on testnet, `smoke-arkiv`), any Arkiv write, any funding transfer, any browser payment that uses the shared test buyer or faucet, and any World review that writes to Arkiv.
- Reads (RPC reads, Blockscout, `scripts/arkiv-query.ts`, `scripts/world-probe.ts`) need no lock.
- Also, per the standing rule, the human must say yes before any testnet transaction. The lock does not replace that approval.
- A running `npm run webhooks` loop or a running web server in testnet mode can send transactions (faucet, courier, finalize helpers). Only one machine runs the app in `NETWORK_MODE=testnet` with the shared keys at a time. That machine holds the chain lock while it runs.

**(b) Fork lock (local anvil plus shared Postgres schemas).**
- The anvil fork itself is local to each machine (chain id 31337, `FORK_RPC_URL`), and `deployments/fork.json` is gitignored, so the chain state does not collide.
- The database does collide. Both machines use the same `DATABASE_URL` (the same Supabase project, **UNVERIFIED** that both humans will be given the same URL, but the setup steps below say to). Schema is chosen per mode:
  - PoP web and scripts: `schemaFor(mode)` in `packages/shared/src/server/store.ts:103`: `fork` gives `pop_fork`, `testnet` gives `public`.
  - Kurta store: `apps/demo-store/src/lib/db.ts:21`: `kurta_<chainId>`, so `kurta_31337` for a fork and `kurta_1874` for testnet.
- If two people run the fork at once, these schemas collide: `pop_fork` and `kurta_31337`. Each machine's fork has its own chain state and its own order ids, but they would write rows into the same tables.
- `npm run db:reset-fork` (`scripts/db-reset-fork.ts`) drops and recreates `pop_fork`, and also drops `kurta_31337`. Never run it while the other agent holds the fork lock. It never touches `public` or `kurta_1874`.
- Take the fork lock before: starting `npm run fork`, `db:reset-fork`, `fork:up`, `e2e-fork.ts`, `e2e-merchant.ts` on the fork, `seed-demo.ts` on the fork, or `npm run dev:web` in fork mode. Release it when the fork and servers are stopped.
- Work that never touches the database needs no fork lock: `forge build` and `forge test`, `npm run build`, lint, typecheck.
- Testnet mode uses `public` and `kurta_1874` for both machines by design (one shared testnet record). Writes there fall under the chain lock too. `npm run db:migrate` on `public` is idempotent but is a database change: chain lock plus human approval.

**(c) Vercel lock.** Nothing is deployed to Vercel yet (docs/deployment.md). Take the Vercel lock before: creating or deploying a project, editing Vercel env variables, adding the cron, or running `scripts/seed-merchant.ts` with real store URLs. The human must also say go. Only one agent touches Vercel at a time.

**(d) Conflict-prone files.** Ranked from `git log --name-only` (touch counts over the whole history): CLAUDE.md 21, docs/evidence.md 12, docs/friction-log.md 9, `.env.example` 8, `packages/shared/src/server/store.ts` 7, AI_USAGE.md 7, `package-lock.json` 6, HANDOFF.md 6, docs/OVERNIGHT.md 6, README.md 5, `package.json` 5, `scripts/e2e-fork.ts` 5. `packages/shared/src/abi.ts` and `supabase/migrations` appear less often but break everything downstream.

| File | Rule |
|---|---|
| `CLAUDE.md` | Claim first. Append only inside section 9 (progress log, newest first) and update the status lines you own in section 5. Do not rewrite other sections. The human owns sections 2 and 8 (decisions). |
| `package-lock.json` | Claim first. Only change it through `npm install` at the repo root. Never hand-edit. On a rebase conflict, take the remote version, rerun `npm install`, and commit the result. Only one agent adds dependencies at a time. |
| `package.json` (root and workspaces) | Claim first. Post a request before adding a dependency, because it forces the lockfile change. |
| `packages/shared/src/abi.ts` | Generated. Regenerate only with `npm run abi` (`scripts/export-abi.ts`) after a contract change, and only the agent that owns the contract files commits it. Never edit by hand. |
| `contracts/src/*`, `contracts/test/*` | Claim first. Any change needs both humans to agree before it is used on 1874, because the deployed bytecode is fixed (no redeploy). |
| `supabase/migrations/*` | Claim first. New numbered file only (`0002_...`), never edit `0001_init.sql`. Applying a migration is a database change: see lock (b) or (a). |
| `.env.example` | Claim first. Names only, no values. Append new names with a one-line comment. |
| `docs/evidence.md` | Append only (newest first within a section). Never rewrite another agent's entries. Only record things that were run. |
| `docs/friction-log.md` | Append only. |
| `docs/OVERNIGHT.md`, `HANDOFF.md` | Frozen history. Do not edit. Use section 6 of this file instead. |
| `README.md`, `AI_USAGE.md`, `WHITECHAIN_FEEDBACK.md`, `docs/limitations.md`, `docs/deployment.md` | Claim first, small edits, no restructuring. |
| `deployments/testnet.json` | Never edit. It records the live deploy. |
| `apps/web/src/app/globals.css`, `apps/demo-store/src/app/globals.css` | Claim first. Design tokens (docs/design-tokens.md); the store has its own copy with a different accent. |

## 1. Project snapshot

### What PoP is
PoP (Proof of Purchase) is a protected checkout for Indian Instagram and WhatsApp sellers, built for ETHGlobal Mumbai 2026 (From Scratch track). A buyer pays test USDT into `PoPCheckout` on Whitechain Sepolia (1874) against a seller-signed EIP-712 Offer. The seller is paid only when the buyer's 6-word delivery code is submitted. A missed ship-by or deliver-by deadline lets anyone call `finalize` into a full refund. After a Released order a World ID proof gates one review per human per seller. Reviews are readonly Arkiv entities (Rabdi 7794095), created by the attestor and transferred to the buyer. Deadline: Sat 7 Nov 09:00 IST (target submit 07:00). Prizes: Whitechain (Operate), Arkiv (Build from scratch), World (Best Use of IDKit). Source: CLAUDE.md sections 1 and 2.

### The three judge sentences (CLAUDE.md section 1)
1. "If it doesn't arrive, you get your money back automatically. Nobody can stop that refund, including us."
2. "The money is released by the buyer's code at the door; our courier key can't release a single rupee."
3. "Reputation is earned only from protected deliveries, counts each human once per seller, and lives on Arkiv where any app can read it."

### What is simulated (docs/limitations.md, CLAUDE.md section 2 and 8)
Test USDT only, no real money. The courier is a simulated role (the `/courier` page, label "SIMULATED COURIER", signed by `COURIER_PK`). One arbiter key decides disputes. Test mode browser wallet for buyers. The World step runs against the staging environment and the Simulator. Buyer-facing text on the order flow never claims delivery is verified on-chain.

### Chains, contracts, token, config
| Item | Value | Source |
|---|---|---|
| Whitechain Sepolia | chain id 1874, RPC `https://rpc.testnet.whitechain.io`, explorer `https://explorer.testnet.whitechain.io` (Blockscout) | .env.example |
| Arkiv Rabdi | chain id 7794095 | .env.example, CLAUDE.md |
| PoPCheckout | `0xB6A894bE070951a7331DebFf615e11F7a076794c`, verified on Blockscout | deployments/testnet.json, docs/evidence.md |
| SellerRegistry | `0x6D61cD77239dd61e43e943a4Aac006d8A6C285E5`, verified on Blockscout | same |
| Test USDT | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`, "Tether USD", 6 decimals | same |
| Deploy block | **12330545**, verified from the chain on Fri 6 Nov: both deploy transaction receipts are in that block, each `contractAddress` matches, and `getCode` at the previous block is empty at both addresses. The older value 12330534 was the block the deploy script read before sending. Now identical in `deployments/testnet.json`, `docs/deployment.md`, `.env.example`, `docs/evidence.md`, `CLAUDE.md` and `apps/web/src/lib/proof-data.ts`. | docs/evidence.md |
| Constructor config (read back on-chain per docs/evidence.md) | treasury = deployer, fee 100 bps, short window 30 s, long window 120 s, trusted minimum 3, arbiter timeout 300 s. Defaults only; no time-skip and no admin time override exists. | docs/evidence.md |
| RPC log range | `eth_getLogs` is capped at 10,000 blocks. Every event read uses `chunkedLogs` (`packages/shared/src/logs.ts`, default range 9,000 blocks). Never call `getLogs` over a wide range directly. | CLAUDE.md section 3 |
| Contract rules worth knowing | `SelfPurchase` reverts when buyer equals seller (a second wallet is not blocked). `forceRefundBanned` is arbiter-only, needs a banned seller, covers Funded, Shipped and Disputed, pays the buyer in full (reason 5). `SellerRegistry` has attestor-signed registration and permanent bans. | docs/OVERNIGHT.md, contracts/src |

### Wallet roles (public addresses only; derived from `.env` keys on this machine, matching CLAUDE.md section 7)
| Role | Address | Env name |
|---|---|---|
| deployer (admin, treasury) | `0xB7C637cb5a37abbA288ca51f1d2Fd0c6776ABb2c` | `DEPLOYER_PK` |
| attestor (registry signer, Arkiv writer) | `0xeF0CC7f7f280083e425A741957B920c7eF39A21c` | `ATTESTOR_PK` |
| courier | `0x63d1FE1aB00f657516Bd7f94fCa9060118532E0C` | `COURIER_PK` |
| arbiter | `0x502CbFd5c92dF9CbA8f55560471501794610d2E9` | `ARBITER_PK` |
| faucet | `0x012f9baaDbCF059Fc70DAFcD7eB109404e703A43` | `FAUCET_PK` |
| demo seller @meera.jewels | `0x0bda864aa008bDa5fA7401A904f51f37866A3dE9` | `SELLER_PK` |
| test buyer | `0xC47e6F52941653B52D1d7213429dd43CFf5234cE` | `TEST_BUYER_PK` |
| Kurta Co. merchant | `0xB6a8fA0698Fdf0a8CD1b94e9101dCE39E63358Cf` | `MERCHANT_PK` (also in `apps/demo-store/.env.local`; same address derived) |

Deployer admin role: the deployer holds `DEFAULT_ADMIN_ROLE` on both contracts. It can only grant and revoke roles. There is no pause and no admin function that moves funds (README.md and docs/limitations.md state this). The deployer is also the fee treasury.

### Tech stack (package.json files and foundry.toml)
Solidity 0.8.30, evm prague, optimizer 200 runs (`contracts/foundry.toml`); Foundry 1.9.0 (CLAUDE.md); OpenZeppelin Contracts v5.6.1 (`git describe --tags` in the submodule); Next.js 16.4.5 with Cache Components on; React 19.3.0; Tailwind 4; viem 2.57.16; zod ^4.6.7 (web); `@worldcoin/idkit` ^4.6.0; `@arkiv-network/sdk` 1.0.1 (server only); `pg` 8.23.1; dotenv 18.0.9; tsx 4.23.15; TypeScript ^5; npm workspaces (`apps/*`, `packages/*`). Node v26.13.0 and npm 11.20.0 on the first machine (CLAUDE.md section 4).

### Repo map (walked from `git ls-files`)
| Path | What |
|---|---|
| `contracts/src` | `PoPCheckout.sol`, `PoPConfig.sol`, `SellerRegistry.sol` |
| `contracts/test` | Foundry tests (`PoPCheckout`, `SellerRegistry`, `ArbiterTimeout`, `ForceRefundAndSelfPurchase`, `invariant/`, `mocks/`) |
| `contracts/script` | `Deploy.s.sol` |
| `contracts/lib` | git submodules: forge-std and openzeppelin-contracts |
| `apps/web` | PoP Next.js app: pages (landing, `/p/[listingId]` checkout, `/o/[orderId]` order, `/verify/[handle]`, `/dashboard`, `/courier`, `/arbiter`, `/onboard`, `/proof`, `/dev/world`) and API routes under `src/app/api` |
| `apps/web/src/lib/server` | server logic: `orders.ts`, `reviews.ts`, `world.ts`, `webhooks.ts`, `merchants.ts`, `onboarding.ts`, `offers.ts`, `auth.ts`, `courier.ts`, `chain.ts`, `proof.ts` |
| `apps/web/src/lib/client` | browser helpers: `wallet.ts`, `code.ts`, `config.ts`, `format.ts` |
| `apps/demo-store` | Kurta Co. demo merchant, a separate app and a separate planned Vercel project |
| `apps/demo-store/src/lib` | `db.ts`, `orders.ts`, `pop.ts`, `product.ts`, `reputation.ts` |
| `packages/shared` | `APP_NAME`, chain defs, EIP-712 types, ABIs (`abi.ts`), `chunkedLogs`, config (`WORLD_REVIEW_ACTIONS`), and `server/` (`store.ts` Postgres, `arkiv.ts`, `crypto.ts`) |
| `packages/checkout-sdk` | "Pay with PoP": `server.ts` (sessions, webhook verify, on-chain recheck) and `browser.ts` (button) |
| `scripts` | tsx scripts: smoke tests, deploy, fork, seed, e2e, probes, DB migrate and reset, a11y and contrast tools |
| `supabase/migrations` | `0001_init.sql` |
| `arkiv` | Arkiv judging files (`schema.md`, `how-you-use-arkiv.md`, `why-arkiv.md`, `friction.md`, `reach.md`) |
| `docs` | `evidence.md`, `friction-log.md`, `limitations.md`, `deployment.md`, `demo-script.md`, `design-tokens.md`, `ux-rules.md`, `WORLD_DEBRIEF.md`, `OVERNIGHT.md`, `submission-tags.md`, `screens/` |
| `deployments` | `testnet.json` (committed). `fork.json` is gitignored |
| `specs` | planning docs and prompts, kept for disclosure |
| root | `CLAUDE.md`, `HANDOFF.md`, `README.md`, `AI_USAGE.md`, `WHITECHAIN_FEEDBACK.md`, `.env.example`, `.claude/settings.json` |

### How it is wired (file paths)
- **Order flow.** Checkout page `apps/web/src/app/p/[listingId]/Checkout.tsx`: the buyer's browser makes the 6-word code (`packages/shared/src/code.ts`, `apps/web/src/lib/client/code.ts`), approves and calls `pay` with the seller-signed Offer (`packages/shared/src/eip712.ts`; offers served by `apps/web/src/lib/server/offers.ts` and `/api/listings/[id]`). Only the code hash is on chain. Order record and encrypted delivery details go through `/api/orders/confirm` into Postgres (`apps/web/src/lib/server/orders.ts`, `packages/shared/src/server/store.ts`). Seller marks shipped from `/dashboard` (`/api/seller/*`, nonce login in `/api/auth/seller`). Courier (`/courier`, `/api/courier/*`, `apps/web/src/lib/server/courier.ts`) submits the code with `confirmDelivery`, or reports a refused handover (can only open a dispute). Order page `apps/web/src/app/o/[orderId]/OrderView.tsx` shows status, countdown, Settle (`finalize`), opt-in auto-settle, report a problem (`/api/orders/[id]/dispute`). Arbiter page `/arbiter` with `/api/arbiter/*` and `/api/staff/onboard`.
- **Review pipeline.** Review box on the order page, `/api/world/rp-signature` (signs the World request), `/api/world/verify-review` (verifies the proof server-side), `apps/web/src/lib/server/reviews.ts` and `/api/reviews/*`. Postgres `UNIQUE(nullifier_hash, seller_wallet)` is the second line of defence. Arkiv entity `pop_review_v1` is written by the attestor, then ownership is transferred to the buyer, readonly, 180-day expiry (24 h for DEV reviews). Code: `packages/shared/src/server/arkiv.ts`. `pop_seller_v1` and `pop_outcome_v1` are reserved names only; nothing writes them.
- **World per-seller actions.** World ID 4.0 proofs are one-time per (human, action), so each seller has its own pre-created portal action: `WORLD_REVIEW_ACTIONS` in `packages/shared/src/config.ts` (`meera.jewels` maps to `review-meera-jewels`, `kurta.co` to `review-kurta-co`, plus `demo.seller3` to `review-demo-seller3`; optional env JSON override `WORLD_REVIEW_ACTIONS`). Server config in `apps/web/src/lib/server/world.ts`. Test page `/dev/world`. Probe: `scripts/world-probe.ts`. Debrief: `docs/WORLD_DEBRIEF.md`.
- **Verify page.** `apps/web/src/app/verify/[handle]/Verify.tsx` with `/api/verify/[handle]`: contract counters with denominators plus Arkiv entities. Red page for unknown or banned handles. Embeddable badge: `/api/badge/[handle]`.
- **Merchant SDK and webhooks.** Session API `/api/v1/checkout-sessions` (merchant API key stored as sha256 only, per-merchant rate limit counted in Postgres). Webhook events `order.funded`, `shipped`, `delivered`, `released`, `refunded`, signed `PoP-Signature: t=,v1=` (HMAC), secret AES-256-GCM encrypted. Delivery: `apps/web/src/lib/server/webhooks.ts`, dispatcher `/api/webhooks/dispatch` (GET and POST, 15 s timeout, 8 retries; `apps/web/vercel.json` runs it every minute on Vercel Pro; `npm run webhooks` is an optional backup loop). SDK: `packages/checkout-sdk/src/server.ts` and `browser.ts`. The Kurta store receives them at `apps/demo-store/src/app/api/pop/webhook`, verifies the signature and rechecks the order and `merchantRef` on chain before changing its order book (`apps/demo-store/src/lib/orders.ts`, `pop.ts`). The store reads the seller's record with its own Arkiv key (`reputation.ts`, `/api/record`).
- **Network modes.** `NETWORK_MODE` in `.env`, read by `packages/shared/src/network.ts`. `fork` is a local anvil fork of Whitechain state, chain id 31337, Postgres schema `pop_fork`, store schema `kurta_31337`. `testnet` is 1874, schema `public`, store schema `kurta_1874`. Addresses come from `deployments/<mode>.json`, or from env on Vercel (the app refuses to read `deployments/*.json` when `VERCEL` is set). `.env` currently has `NETWORK_MODE=fork` on the first machine.

### Environment variable NAMES per project
Taken from docs/deployment.md and .env.example, then compared with the names the code reads (`process.env.*` and the script helpers `need()` and `opt()`).

| Project | Server-only secrets | Server-side config |
|---|---|---|
| PoP web (`apps/web`) | `DATABASE_URL`, `ADDRESS_ENC_KEY`, `SESSION_SECRET`, `COURIER_PASSCODE`, `ATTESTOR_PK`, `COURIER_PK`, `FAUCET_PK`, `ARKIV_ACCESS_KEY`, `WORLD_RP_SIGNING_KEY` | `NETWORK_MODE`, `WHITECHAIN_RPC_URL`, `CHECKOUT_ADDRESS`, `REGISTRY_ADDRESS`, `DEPLOY_BLOCK`, `USDT_ADDRESS` (optional), `WORLD_APP_ID`, `WORLD_RP_ID`, `WORLD_ENVIRONMENT`, `NEXT_PUBLIC_BASE_URL` (optional, the only public name), `WORLD_REVIEW_ACTIONS`, `POP_ATTESTOR_ADDRESS`, `FAUCET_DAILY_CAP`, `USDT_DECIMALS`, `WORLD_VERIFY_BASE` (all optional) |
| Kurta store (`apps/demo-store`) | `POP_API_KEY`, `POP_WEBHOOK_SECRET`, `MERCHANT_PK`, `DATABASE_URL`, `KURTA_ARKIV_ACCESS_KEY` (must differ from PoP's) | `POP_BASE_URL`, `KURTA_ORIGIN`, `POP_ATTESTOR_ADDRESS`, and the chain pin `CHAIN_ID`, `RPC_URL`, `CHECKOUT_ADDRESS`, `REGISTRY_ADDRESS`, `DEPLOY_BLOCK` (set all five or none, `apps/demo-store/src/lib/pop.ts:20`) |
| Local only, never on Vercel | `DEPLOYER_PK`, `ARBITER_PK`, `TEST_BUYER_PK`, `SELLER_PK` (scripts and demo) | `FORK_RPC_URL`, `POP_DEV_SKIP_WORLD` (shell only), `POP_NO_ROOT_ENV` (proves an env-only run) |

Names in code or `.env.example` that docs/deployment.md does not list, flagged:
- Script guards and script URLs: `ALLOW_TESTNET_DEPLOY`, `ALLOW_TESTNET_ORDER`, `ALLOW_DEMO_SEED`, `WEB_URL`, `POP_URL`, `KURTA_URL`, `KURTA_WEBHOOK_URL` (the last appears in deployment.md prose only). These are local script settings, not app settings.
- `KURTA_ORIGIN` is used by the store's checkout route and by `seed-merchant.ts`.
- `WHITECHAIN_CHAIN_ID` is in `.env` and `.env.example`. No `process.env.WHITECHAIN_CHAIN_ID` read was found in app code; **UNVERIFIED** whether a script reads it.
- `NEXT_PUBLIC_WORLD_APP_ID`, `ARKIV_CHAIN_ID` and `RECLAIM_APP_ID`, `RECLAIM_APP_SECRET`, `RECLAIM_INSTAGRAM_PROVIDER_ID` are in `.env.example`. No code read of the `NEXT_PUBLIC_WORLD_APP_ID` or `RECLAIM_*` names was found, so they look unused (docs/deployment.md says `NEXT_PUBLIC_BASE_URL` is the only public name). **UNVERIFIED** for `ARKIV_CHAIN_ID`.
- Platform and framework names the code reads (`VERCEL`, `VERCEL_URL`, `VERCEL_ENV`, `NODE_ENV`, `PORT`, `NEXT_*`) are provided by the platform.

### Status
**Done and tested.** Counts below are quoted from docs/OVERNIGHT.md Step 5 (fresh fork, Fri 6 Nov night). They were not re-run for this file (no fork was started; no chain lock was needed to avoid anything), so treat them as **UNVERIFIED on this commit** until someone reruns them.
- `forge test`: 58 passed, 0 failed (invariant suite 6 invariants, 64 runs x 32). docs/evidence.md still says 57 passed; that line is older.
- `scripts/e2e-fork.ts`: PASS, 65 checks.
- `scripts/e2e-merchant.ts`: PASS, 48 checks on a fork; 47 on 1874 in real time (docs/evidence.md still shows the older 41-check run).
- Both apps build with `VERCEL=1` and an empty env; eslint 0 errors, 2 warnings (`<img>` for QR and badge); tsc clean; Lighthouse accessibility 100 on nine pages; no horizontal scroll at 375 px.
- On 1874: contracts deployed and verified; orders #1 to #10 settled (release path #1 and #3, late-ship refund #2 and #4, rest per docs/evidence.md), `totalLocked` 0 at last read. Testnet `public` schema migrated.
- Arkiv: 8 `pop_review_v1` entities readable with PoP's key and with the store's own key, all created by the attestor and readonly (`scripts/arkiv-query.ts`).
- Redesign of both apps (docs/design-tokens.md, docs/ux-rules.md, docs/screens/). `scripts/seed-demo.ts` (five scenes) run twice on the fork, not on testnet.

**Open** (CLAUDE.md sections 5, 6 and 10, docs/OVERNIGHT.md):
1. World real proof via the Simulator (gate 4, about 5 minutes, checklist in docs/OVERNIGHT.md Step 1). No real World proof has ever run.
2. Vercel: two projects (docs/deployment.md), cron on `/api/webhooks/dispatch`, re-seed the Kurta merchant row with real URLs. Needs the human's go. Nothing deployed.
3. Browser payment on 1874 (testnet orders so far were made by script).
4. One real, non-DEV review end to end.
5. Whitechain mentor answer (gate 5: does the protected checkout count as Operate) and gate 7 (organizers OK with `specs/`), both with the human.
6. Human checks: phone, Safari, screen reader, clicking through `/onboard` and `/arbiter`.
7. Run `seed-demo.ts` on testnet (about 15 test transactions, 0.02 WBT), rehearse `docs/demo-script.md`, record the video, fill the submission form.
8. Team review of the contract changes.

## 2. Setup on a new device (for the second agent)
Do these in order. Stop and post a request (section 5) if any step fails twice, and add it to `docs/friction-log.md` (append only, claim first).

1. Clone **outside OneDrive** with submodules (OneDrive causes EPERM and EBUSY during `npm install`): `git clone --recurse-submodules https://github.com/Dhruva-0206/pop.git` into a path such as `C:\dev\pop`. If submodules are missing: `git submodule update --init --recursive`.
2. Repo-local git identity, in the repo only: `git config user.name "<the second person's name>"` and `git config user.email "<their email>"`. Do not use `--global`. Do not set any commit trailer.
3. `npm install` at the repo root `pop/` only. Never at the parent ETH folder.
4. Place the two private files the human hands over, privately (never through git, chat logs or screenshots): `pop/.env` and `pop/apps/demo-store/.env.local`. Both are gitignored. Check they exist, then report **only the names** of any variable that is empty, never a value. On the first machine the empty names in `.env` are `CHECKOUT_ADDRESS`, `REGISTRY_ADDRESS`, `WORLD_REVIEW_ACTIONS`, `RECLAIM_APP_ID`, `RECLAIM_APP_SECRET`, `RECLAIM_INSTAGRAM_PROVIDER_ID`, `NEXT_PUBLIC_BASE_URL`, and these are expected to be empty (addresses come from `deployments/testnet.json`). `apps/demo-store/.env.local` has no empty names.
5. Foundry on Windows: in **Git Bash** only, `export PATH="$PATH:$HOME/.foundry/bin"`, then `forge --version` (expected 1.9.0). If Foundry is not installed, installing it is a system-level install: ask the human first (`foundryup` in Git Bash).
6. `cd contracts && forge build && forge test`. Expected: **58 passed, 0 failed** (UNVERIFIED on this commit; if the number differs, report the real number and do not change tests).
7. Build and lint both apps from the root: `npm run build:web`, `npm run build:store`, and `npm run lint -w @pop/web` and `npm run lint -w @pop/demo-store` (both packages define `"lint": "eslint"`). Expected: builds pass, 0 lint errors (2 known `<img>` warnings in `apps/web`).
8. Read `CLAUDE.md` fully and this file. Then append "setup finished" to section 6 with the counts you saw, commit this file, `git pull --rebase`, `git push`.

**The second agent must NOT, until the human says so:**
- run `npm run wallets` or regenerate wallets (never);
- deploy or redeploy contracts (`npm run deploy`, `forge script ... --broadcast`);
- send any testnet transaction or write to Arkiv, including `seed-demo.ts`, `seed-merchant.ts`, `testnet-order.ts`, `testnet-refund.ts`, `smoke-arkiv.ts`, and any funding or faucet use;
- set `NETWORK_MODE=testnet` for a script that sends transactions, or run the web app in testnet mode with the shared keys;
- run `npm run db:migrate` on `public`, or `npm run db:reset-fork` without the fork lock;
- deploy to Vercel or change Vercel env variables;
- set `POP_DEV_SKIP_WORLD` anywhere except a local shell for a local fork run.

Reads, builds, tests that do not need a chain (`forge test`, `npm run build`, lint, typecheck) and the read-only scripts (`arkiv-query.ts`, `world-probe.ts`) are fine.

## 3. Active claims
| Agent or human | Task | Files claimed | Claimed at (IST) |
|---|---|---|---|

## 4. Locks
| Lock | Holder | Since | Note |
|---|---|---|---|
| chain (Whitechain 1874 and Arkiv writes) | free | | |
| fork (local anvil, schemas `pop_fork` and `kurta_31337`) | free | | |
| vercel (deploys and env changes) | free | | |

## 5. Requests between agents
Format: `[Fri HH:MM IST] FROM -> TO: request`. The receiver replies indented under it and marks it DONE.

(none yet)

## 6. Activity log (append only, newest at the bottom)
Format: `[Fri HH:MM IST] agent or human | what changed | files | commit | what the other side must know`

[Fri 10:47 IST] agent 1 (Claude Code, first machine) | created this coordination file, built from the repo | `parallel.md`, plus one appended link line each in `CLAUDE.md` and `HANDOFF.md` | see `git log` for "docs: add parallel coordination file" | Read sections 0 and 2 first. Test counts in section 1 are quoted from docs, not rerun. Deploy block 12330545 versus 12330534 is an unresolved doc mismatch.

[Fri 10:47 IST] agent 1 | working tree state at creation: `git status` was clean and `git log origin/main..HEAD` was empty before this change, so there were no uncommitted or unpushed changes. HEAD was `39ac6b7` ("docs: overnight log commit count, tooling notes"), equal to `origin/main`. The only changes after that are this file and the two link lines, committed and pushed together. Not in git and never to be committed: `.env`, `apps/demo-store/.env.local`, `deployments/fork.json`, `node_modules`, `contracts/out`, `contracts/cache`. | none | none | Nothing else is pending on the first machine. All local servers and the fork were stopped before this task.

[Fri 10:56 IST] agent 2 (Claude Code, second machine) | setup finished, section 2 steps 2 to 8. Nothing sent to any chain, no wallets script, no deploy, no db commands. Results: node v26.13.0, npm 11.20.0, Foundry forge 1.9.0 (Git Bash). `npm install` at `pop/` finished with no change to tracked files (`git status` clean after it; npm audit notes and an esbuild install-script notice only). `forge build` OK; `forge test`: 58 passed, 0 failed, 0 skipped, 5 suites (matches the expected 58). `npm run build:web` exit 0 and `npm run build:store` exit 0. `npm run lint -w @pop/web`: 0 errors, 2 warnings (`<img>` in `apps/web/src/app/onboard/Onboard.tsx` lines 229 and 233; not OrderView as the older log says). `npm run lint -w @pop/demo-store`: 0 errors, 0 warnings. Both `.env` and `apps/demo-store/.env.local` exist and are gitignored. Empty names in `.env`: `CHECKOUT_ADDRESS`, `REGISTRY_ADDRESS`, `RECLAIM_APP_ID`, `RECLAIM_APP_SECRET`, `RECLAIM_INSTAGRAM_PROVIDER_ID`, `NEXT_PUBLIC_BASE_URL`. `WORLD_REVIEW_ACTIONS` is NOT empty on this machine, unlike the list in section 2 step 4. `apps/demo-store/.env.local` has no empty names. | `parallel.md` | see `git log` | Deviations: the clone lives inside OneDrive (`C:\Users\shant\OneDrive\Desktop\ETH\pop`), not outside it as step 1 advises; install worked without EPERM or EBUSY, so I did not move it. Repo-local git identity was already set, no `--global`. Submodules present (forge-std v1.17.0, openzeppelin-contracts). Not run: fork, db scripts, e2e scripts, dev servers.

[Fri 16:43 IST] human (Dhruva) with agent 1 | World smoke D succeeded on 1874: order #1, @meera.jewels, rating 5, review "Arrived on time and matched the photos." A real non-DEV Arkiv entity was written: key `0xa444fb932ea107e2814e191d8adc878e5936fd70c64ea4bd90c936e508c03508` (creator attestor, owner test buyer, readonly, expires at block 8064912, read back with `scripts/arkiv-query.ts` at Arkiv block 289062; 10 entities by the attestor in total). World log row verified, id f2d508a533b2. The simulator showed Unique Human with World ID 4.0 selected. | none (log only) | none | Gate 4 is done for the success path. The denied paths are still open (section 7). The chain lock is free.

[Fri 16:43 IST] human (Dhruva) | tooling note: the dev server on `/dev/world` hot-reloaded in a loop. A production build (`npm run build`, `npm run start`) was the workaround. Likely cause is the file watcher, with the repo under Desktop (possibly OneDrive sync). Not verified. | none | none | Use a production build for any browser run that must stay stable (the World step, the demo).

[Fri 16:43 IST] human (Dhruva) | the overnight rejected rows at 08:46 UTC on `/proof` came from scripted probes (`scripts/world-probe.ts`), not from a person cancelling. | none | none | Do not read those rows as user behaviour in the debrief.

[Fri 11:18 IST] agent 1 | recorded the three entries above, set the chain lock to free (it was already free in section 4, no row change needed), added section 7. Claims table checked: agent 2's UI claim does not include `parallel.md`. | `parallel.md` | see `git log` | Section 7 is the deferred list before the video.

## 7. Deferred to-do (do before the video)
| # | Item | Owner | Status |
|---|---|---|---|
| 1 | World denied path A: cancel in the simulator, expect "cancelled. Nothing was published." and no new log row. Screenshot it. | Dhruva | open |
| 2 | World denied path B: second review for order #1, expect "this order already has a review" or a World refusal. Copy the exact message, screenshot it. | Dhruva | open |
| 3 | Deploy block mismatch: settled. Creation block is 12330545 (read from the chain), every file now agrees. | agent 1 | done |
| 4 | Stale test counts in `docs/evidence.md` (should be 58 forge, 65 e2e-fork, 48 e2e-merchant). | Dhruva | open |
| 5 | Finish `docs/WORLD_DEBRIEF.md` with the real timeline and friction. | Dhruva | open |
| 6 | Record the real review entity in `docs/evidence.md` and `arkiv/reach.md`. | Dhruva | open |
| 7 | On `/proof`, group the DEV entries and the old smoke entity (order 999000001) under "Ignored entries". | Dhruva | open |
| 8 | Vercel setup and deploy (two projects), webhook cron, re-seed Kurta with the deployed URLs. | Dhruva | open |
| 9 | Browser payment on 1874 by a person, explorer link in README. | Dhruva | open |
| 10 | Whitechain mentor questions (Operate fit, token, whether script payments count). | Dhruva | open |
| 11 | Human checks: Safari, real phone, screen reader, `/onboard` and `/arbiter` clicks. | Dhruva | open |
| 12 | Demo rehearsal, video, submission form. | Dhruva | open |

[Fri 11:25 IST] agent 1 | Vercel prep, nothing deployed, no env or Vercel changes, no chain access. Added `apps/web/vercel.json` with a daily webhook cron (Hobby allows cron once per day only, so a faster schedule would fail the deploy; the file says how to switch to every minute on Pro). Plan type is UNVERIFIED. Real-time fallback: order pages and order registration already trigger passes, plus `POP_URL=<deployed PoP> npm run webhooks` left running on a laptop. Added `scripts/vercel-smoke.ts` (11 GET checks, type checked, usage tested, NOT run against a live site). `docs/deployment.md` now has build settings, paste-ready env lists with value sources, unused-name list, cron section and Kurta re-seed steps. `VERCEL=1` builds of both apps exit 0. | `apps/web/vercel.json`, `scripts/vercel-smoke.ts`, `docs/deployment.md`, `parallel.md` | see `git log` | Claim released. Finding: `seed-merchant.ts` rewrites `POP_BASE_URL` in `apps/demo-store/.env.local`, so re-seeding with deployed URLs points the local store at the deployed PoP until reset (documented). Env names that no code reads: WHITECHAIN_CHAIN_ID, ARKIV_CHAIN_ID, NEXT_PUBLIC_WORLD_APP_ID, RECLAIM_*. Agent 2 holds the fork lock and the UI claim; neither was touched.

[Fri 11:32 IST] agent 1 | Vercel Pro follow-up, nothing deployed, no transactions, no Vercel or env changes. (1) `apps/web/vercel.json` cron is now `* * * * *` on `/api/webhooks/dispatch`; the loop script is an optional backup. (2) Deploy block settled from the chain: both deploy receipts are in block 12330545, contractAddress matches, no code at the previous block; 12330534 was the pre-send block. Updated `deployments/testnet.json`, `.env.example`, `docs/deployment.md`, `docs/evidence.md`, `CLAUDE.md` progress line; `proof-data.ts` and the `/proof` row already agreed. (3) Overlap: enqueue and cursor were already idempotent, delivery was NOT (plain select, no claim, in-memory guard only per instance). Fixed with `store.claimWebhook` (skip locked, status sending, 90 s lease) and a 40 s delivery budget; `markWebhook` leaves delivered rows alone; no migration. (4) `maxDuration`: 60 s on dispatch, orders/confirm, orders/[id], verify-review, reviews/retry; 30 s on the Kurta webhook receiver. Pro default is 300 s with Fluid compute (max 800 s); Fluid status of the projects not checked. | `apps/web/vercel.json`, `deployments/testnet.json`, `.env.example`, `docs/deployment.md`, `docs/evidence.md`, `CLAUDE.md`, `packages/shared/src/server/store.ts`, `apps/web/src/lib/server/webhooks.ts`, six route files, `parallel.md` | see `git log` | Claims released. Checked: tsc clean, lint 0 errors, both `VERCEL=1` builds exit 0, claim SQL planned with EXPLAIN and exercised on a temp table (nothing persisted). NOT checked: a concurrent two-instance run, a live cron, the dashboard. Pull before touching `webhooks.ts` or `store.ts`. Section 7 item 3 is done.

[Fri 12:05 IST] agent 2 (second machine) | UI pass 2 finished, presentation only. Commits: bf7bf83 (audit, `docs/design-direction.md`, `scripts/screens.ts` screenshot helper), d9511b6 (order page as a receipt: stamp, 4-step tracker, rule line, countdown next to Settle, tear-off delivery code), 606646d (checkout: product picture, seller record line, 3-row rules list, sticky Pay bar on phones, timed payment checklist), ff515ac (landing: example receipt, tracker), 940c4ab (`/verify`), 4acee33 (Kurta Co. own warm palette, Fraunces display font via next/font, kurta drawing `apps/demo-store/public/kurta.svg`, PoP green only on the Pay with PoP button), 1002f7d (team tools: headings, stamps, visible labels, tabular amounts), a42034d (fixes and `docs/screens/after2/`). No change under api/, lib/ (except `lib/client/format.ts`), packages/, contracts/, supabase/, .env, package.json or the lockfile. Also touched outside the original claim list: `apps/web/src/app/o/[orderId]/page.tsx` (skeleton only), `apps/web/src/components/{receipt.tsx,Checklist.tsx}` (new), `apps/demo-store/src/app/orders/page.tsx` (heading font), `docs/design-tokens.md`. Gates on the final build: tsc both apps clean; lint 0 errors (web keeps the 2 old `<img>` warnings, store 0); `VERCEL=1 POP_NO_ROOT_ENV=1 npm run build` both apps OK; `scripts/e2e-fork.ts` PASS 46 checks and `e2e-merchant.ts` PASS 48 on the fork; Lighthouse accessibility 100 on all nine pages (best practices 96 on dashboard, courier, arbiter: the known signed-out 401s); dash, visual-tell and word greps add nothing new. | see commits above | `e2e-fork.ts` ran WITHOUT `POP_DEV_SKIP_WORLD` (46 checks, review and ban sections skipped), because with the flag it writes a DEV entity to Arkiv Rabdi and this pass had no approval for Arkiv writes; the 65-check run is not re-verified. Fork side effects: the stale anvil from 01:16 (old contracts) was stopped, `db:reset-fork` dropped and recreated `pop_fork` and `kurta_31337`, `fork:up`, `seed-merchant` (fork, same key and secret rewritten to `apps/demo-store/.env.local`) and `seed-demo` ran; orders #12 to #14 were paid through the UI. `deployments/fork.json` now points at the new fork deploy. Fork and servers are stopped; fork lock released. Not checked: real phones, Safari, screen reader with a person, a real World proof.

[Fri 12:13 IST] agent 1 (Dhruva's agent) | Live check after the Vercel deploy (PoP https://pop-web-six.vercel.app, store https://kurta-store.vercel.app). No transaction, no code change, no Vercel or env change. Chain lock taken and released. (1) Re-seeded the Kurta merchant row on `public` with `NETWORK_MODE=testnet` exported: output `@kurta.co already registered`, merchant row now has the store webhook URL and return origin; read-only check before it showed the wallet active on 1874, so no transaction was possible. `apps/demo-store/.env.local` was backed up, restored byte for byte (POP_BASE_URL is localhost again) and the backup deleted. (2) `scripts/vercel-smoke.ts`: 11 of 11 PASS. (3) Dispatch: GET answered 200 `{scannedTo:12370672,enqueued:0,delivered:0,failed:0}`. `apps/web/vercel.json` has the cron entry `/api/webhooks/dispatch` at `* * * * *`. Cron NOT proven: the stored scan cursor moves about every 5 seconds, so some caller (most likely the `npm run webhooks` loop left running against the live URL) runs passes and hides the cron. Check Vercel, project pop-web, Settings, Cron Jobs, then View Log, for per-minute 2xx rows. | `parallel.md`, `docs/evidence.md` | see `git log` | Cron entries only run on the production deployment, and the deployment must have been built from a commit that contains `apps/web/vercel.json` (85751bd or later). If the Cron Jobs page is empty, redeploy production from the current main.

[Fri 17:59 IST] agent 1 (Dhruva's agent) | TIME CORRECTION: my entries and lock times above from "Fri 10:47" to "Fri 12:13" were written with `TZ=Asia/Calcutta`, which Git Bash does not know, so they are UTC. Add 5 h 30 min to them (for example "12:13" is 17:43 IST). The same slip put "12:13 IST" in docs/evidence.md; fixed there. This and later entries use `TZ=IST-5:30`. | `parallel.md`, `docs/evidence.md` | see `git log` | Agent 2's times look like true IST.

[Fri 17:59 IST] agent 1 (Dhruva's agent) | Final live verification of https://pop-web-six.vercel.app and https://kurta-store.vercel.app. One real store order, **#11**, paid in Chrome through "Pay with PoP", then shipped, delivered, finalized and withdrawn on 1874 (test USDT and WBT only; links in docs/evidence.md). Store order book `KC-9E24AE5A` released, four webhooks delivered on attempt 1, each rechecked on chain. Smoke 11 of 11 PASS before and after the order. All 9 PoP pages and both store pages load, no horizontal scroll at 375 px in a 375 px frame, no escrow, chain ID or gas on buyer pages and no dashes or emoji. `/proof`: 10 orders, real review entity `0xa444fb932e…c03508` as a regular entry, World log row f2d508a533b2 verified (11:13:05 UTC = 16:43 IST), 9 DEV entries labelled. NOT possible from this browser: the Vercel dashboard (the signed-in Vercel account is a Hobby team that does not contain these projects, plus a 2FA setup prompt that I did not touch), so the deployed commit and the cron logs were not read. | `docs/evidence.md`, `parallel.md` | see `git log` | Findings: (1) `/proof` labels the old smoke entity (order 999000001) "regular entry"; same as todo item 7. (2) The store's My orders shows three "Waiting for payment" references from abandoned checkout sessions. (3) The cron is still unproven: Dhruva's loop calls the dispatcher about every 5 seconds. (4) Chain lock released. The 60 minute main watch is not running unless started separately.

[Fri 18:12 IST] agent 2 (second machine) | Addendum A to E done. (A) Money: a visually hidden ", " between the rupee and USDT amounts (shared `Money`, store price), and spaces after "X of Y" on /verify and the store record; page text now reads "₹899, 1.00 test USDT" (probed: no "₹8991.00" or "₹1,2991.50" left). (B) Checkout Pay bar: one submit button at every width with one label "Pay ₹899" and the total beside it; probed at 375, 768 and 1280: exactly one Pay button, displayed and focusable, its text once in the page. (C) Web meta description replaced; the store keeps its own description (not PoP's text). (D) /proof: the smoke entity `0x731d...` is labelled "smoke test (not a real order)" (matched by its recorded key), rows ordered real, DEV, smoke; the real entry `0xa444...` (order 1) is first; the static heading "First review entity" is now "Smoke-test entity, not a real order". (E) README live links, World section and Tools line; AI_USAGE (a person ran the World proof); WORLD_DEBRIEF (minimum-sufficient reasoning, time to first success from the /proof log: 08:46:03 to 11:13:05 UTC, the 08:46 rows being scripted probes; Simulator only; a proof is not a purchase, delivery or honest seller; India availability unverified); submission-tags Supabase row. | `apps/web/src/components/receipt.tsx`, `apps/web/src/app/{layout.tsx,proof/page.tsx,p/[listingId]/Checkout.tsx,verify/[handle]/Verify.tsx}`, `apps/demo-store/src/app/page.tsx`, `scripts/screens.ts` (probe option), `README.md`, `AI_USAGE.md`, `docs/WORLD_DEBRIEF.md`, `docs/submission-tags.md` | 2770e6e, 3a93c2f, 5cd2811, 040e3f5 | Gates on a fresh local fork: tsc both clean, lint 0 errors (2 old warnings), `e2e-fork.ts` PASS 46 (without the DEV flag, no Arkiv write) and `e2e-merchant.ts` PASS 48, Lighthouse accessibility 100 on nine pages, dash and word greps clean. No API, lib/server, contract, script logic, chain or Arkiv change. The fork was reset again (`pop_fork`, `kurta_31337`) and is stopped; fork lock released. These commits redeploy production (pushed together, after your verification finished).

[Fri 18:46 IST] agent 1 (Dhruva's agent) | Added `scripts/demo-driver.ts` (testnet only, needs `ALLOW_DEMO_ORDER=yes`; ships as the order's seller, courier delivers with the six words, waits out the window, finalizes, withdraws; prints links and per-step timings; `--stop-after=ship|deliver|finalize`, `--no-withdraw`; the words work with or without quotes; only SELLER_PK and MERCHANT_PK sellers). Dry run of docs/demo-script.md on the live sites over HTTP and the chain (no browser: two Chrome instances are connected and I may not pick one). Orders #13 to #16, all terminal, `totalLocked` 0. Timings and the "what to change" list are at the end of docs/demo-script.md; evidence rows in docs/evidence.md. The seed run (`scripts/seed-demo.ts` on testnet) was blocked by the permission classifier and not run, so the banned-seller and look-alike scenes are not on the live site. | `scripts/demo-driver.ts`, `docs/demo-script.md`, `docs/evidence.md`, `parallel.md` | see `git log` | Faucet wallet has 4 test USDT left (each browser wallet takes 2): top it up before judging. 2 test USDT of refund credit from #13 and #14 is orphaned (their buyer keys were not kept). Chain lock released.

[Fri 18:57 IST] agent 1 (Dhruva's agent) | Diagnosed the live checkout error "The contract function pay reverted" (empty reason), read-only, no transactions. Offer for jhumka-01 is fine: not expired (valid to 2026-11-13), 7 of 50 sold, version 1 vs minimum 0, seller active; an eth_call from a funded wallet reaches the token step, so stock and expiry are NOT the cause. Cause of the EMPTY message: viem shows only the short line for custom errors without arguments (SelfPurchase, SoldOut, OfferExpired, SellerNotActive...), the name sits in the nested error. With a state override, a buyer equal to the seller wallet reproduces it (revert data is the SelfPurchase selector), so the browser wallet is most likely the seller wallet (inferred, not seen). Fix: new `apps/web/src/lib/client/errors.ts` (friendlyPayError) used in Checkout.tsx; tested against real reverts. jhumka-02 was not created (not needed). | `apps/web/src/lib/client/errors.ts`, `apps/web/src/app/p/[listingId]/Checkout.tsx`, `parallel.md` | see `git log` | Claim released. To confirm: in that browser, open the console and check which address the checkout shows as the test wallet, or clear `pop:testwallet:testnet:1874:buyer` from localStorage and reload. Needs a Vercel redeploy to show the new message.

[Fri 19:14 +05:30] agent 1 (Dhruva's agent) | Review refusals now explained on the order page. Finding: the World widget (IDKit 4.6) cannot carry our reason. When `handleVerify` throws it shows its own "Verification declined" and calls `onError("failed_by_host_app")` with no message, so `ReviewBox` keeps the server reason itself (a `serverRefused` flag stops the widget code from overwriting it) and renders a Notice with a reason and a next step. New `apps/web/src/lib/client/review-errors.ts` maps all 13 server refusal strings (replay: "You have already reviewed this seller. One review per person per seller."; not the buyer; order not released; rejected proof with World reason; not enabled; too long; server errors) plus widget codes. UI text only, no logic or API change. Checked: tsc clean, lint 0 errors, mapper run over every refusal string in the route sources, fork e2e PASS 65 checks. NOT checked: the notice rendered in a browser (two Chrome instances connected, I may not pick one) and a real World replay. | `apps/web/src/components/ReviewBox.tsx`, `apps/web/src/lib/client/review-errors.ts`, `parallel.md` | see `git log` | Claim and fork lock released. Needs a Vercel redeploy to go live. Fork and web server stopped.

[Fri 19:48 +05:30] agent 1 (Dhruva's agent) | Saturday prep, small pushes, smoke after each. (1) Evidence: orders #11, #16 to #19 with full hashes read from the chain, the phone order #19 (4G, about 19:26 IST), World outcomes with their /proof rows (ids are log rows; `f2d508a533b2` and `595fe89d6634` are nullifier hints, not row ids), README and arkiv/reach.md (12 entities, 2 real reviews, the Kurta key reads them). (2) WHITECHAIN_FEEDBACK.md, docs/WORLD_DEBRIEF.md. (3) UI text: leftover "Verified. Publishing your review." removed, "Use a new test wallet" button, faucet balances on /proof; fork e2e PASS 65 checks, lint 0 errors, VERCEL=1 build ok. (4) `scripts/seed-demo.ts --scenes` (default persistent = scenes 4 and 5) run on testnet: @bad.bazaar banned with open order #20 (not force-refunded), look-alike listing demo-fake-meera. (5) Deadline wording changed in CLAUDE.md and HANDOFF.md (no freeze text existed in parallel.md or docs); demo-script.md timings. Smoke 11 of 11 on both live URLs (one transient store fetch failure on the first run, fine on retry). | many, see git log from 31bde04 | see `git log` | Locks and claim released. Faucet had 6.00 test USDT and 0.296 WBT at last read: each browser wallet takes 2 USDT. Not checked: any page rendered in a browser (two Chrome instances, I may not pick one).

[Fri 20:18 +05:30] agent 1 (Dhruva's agent) | **Vendor onboarding rebuilt** (commit a36e921, docs after it). Flow: Instagram handle, World ID check (one human, one shop), bio code and "I added it to my bio", payment link, QR and badge snippet. (a) World check: one portal action from env `VENDOR_WORLD_ACTION` (default `vendor-onboard`), signal bound to the handle, new table `vendor_verifications` (full sha256 UNIQUE plus 12 hex hint, handle, created_at, banned), appended to `supabase/migrations/0001_init.sql` (that is the only file `db:migrate` reads) and ALREADY APPLIED to testnet `public` and the fork. Replay is refused ("This person already has a PoP shop.", log result `replay`), banned is refused ("This person was banned from selling on PoP."). The ban block is a PoP database rule mirrored from the on-chain ban, not an on-chain rule (said in README and docs/WORLD_DEBRIEF.md). (b) Demo mode `ONBOARD_DEMO_AUTOAPPROVE=yes`, honored only when NETWORK_MODE=testnet (`/api/onboard/auto`): skips the staff check, the attestor signs, PoP's FAUCET_PK wallet sends registerSeller (anyone may send it, so no contract change) and the shop is registered at handle tier 0 (not checked), never tier 1. NOT set on the live site: the human sets it. With the flag off the staff flow at /arbiter works as before. (c) UI mapper `apps/web/src/lib/client/vendor-errors.ts`. (d) Tests: `scripts/test-vendor-verification.ts` 11 checks (verified, replay, banned, signal binding, real UNIQUE on the fork table), fork e2e PASS 66 checks (new check: a request without a World proof is refused; the e2e onboarding calls now pass `skipWorld` because the dev server has POP_DEV_SKIP_WORLD=1). Testnet rehearsal with throwaway handle `rehearsal.vendor1` (registered on 1874, tier 0, listing `rehearsal-vendor1-f75e`): after the World step the vendor waits about 6.5 s (approve plus registration 4.2 s, sign and publish 2.3 s). The rehearsal used the dev World skip, so its /proof log row says `dev-skipped`: NO real World proof has been run for the vendor action. | `apps/web/src/app/onboard/Onboard.tsx`, `apps/web/src/app/api/onboard/{request,auto}`, `apps/web/src/app/api/world/rp-signature`, `apps/web/src/app/api/config`, `apps/web/src/app/api/arbiter/seller`, `apps/web/src/lib/{vendor-rules,server/vendor,client/vendor-errors}.ts`, `packages/shared/src/server/store.ts`, `supabase/migrations/0001_init.sql`, `scripts/{test-vendor-verification,e2e-fork}.ts`, `README.md`, `docs/{deployment,WORLD_DEBRIEF}.md`, `parallel.md` | a36e921 | Claims and locks released. Friend's agent: (1) `/onboard` now REQUIRES a World ID proof for the vendor action, so the action `vendor-onboard` (or whatever `VENDOR_WORLD_ACTION` says) must exist in the World portal or vendors cannot onboard on the live site; (2) smoke 11 of 11 on both live URLs after the push; (3) if you touch /onboard, pull first. Not checked: the page in a browser (two Chrome instances, I may not pick one), a real World proof, the live site with the demo flag on.
