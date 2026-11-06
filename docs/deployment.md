# Deployment (Vercel, two projects)

Nothing has been deployed to Vercel yet. This is the list a person needs when the team says go. Names were taken from the code (`process.env` reads) on Fri 6 Nov, and a local run with only these variables, `VERCEL=1`, no `.env` and no `deployments/` folder served every page and API route of both apps (see CLAUDE.md section 9, Fri 6 Nov, and `docs/OVERNIGHT.md`).

## Both projects
- Framework: Next.js 16 (Cache Components on). Install command `npm install` at the repository root (npm workspaces). Enable "Include source files outside of the Root Directory" because both apps import `packages/shared` and the store imports `packages/checkout-sdk`.
- Root directory: `apps/web` for PoP, `apps/demo-store` for Kurta Co.
- Do not upload `.env`. Names are set in the Vercel project settings. A variable is "server-only" when it has no `NEXT_PUBLIC_` prefix, which is how every secret here is set.
- There are no local-disk dependencies on Vercel: addresses come from env (`CHECKOUT_ADDRESS`, `REGISTRY_ADDRESS`, `DEPLOY_BLOCK`), data comes from Postgres, and the app refuses to read `deployments/*.json` when `VERCEL` is set.

## Project 1: PoP (`apps/web`)
### Server-only secrets
| Name | What it is |
|---|---|
| `DATABASE_URL` | Supabase Postgres pooler URL. Required. Run `NETWORK_MODE=testnet npm run db:migrate` once from a laptop first. |
| `ADDRESS_ENC_KEY` | 32 bytes, base64. Encrypts delivery details and webhook secrets. Losing it makes stored details unreadable. |
| `SESSION_SECRET` | Signs the seller, courier and staff cookies. |
| `COURIER_PASSCODE` | Team passcode for the courier and staff pages. |
| `ATTESTOR_PK` | Signs seller registrations and writes Arkiv reviews. Needs Arkiv test tokens. |
| `COURIER_PK` | Submits the buyer's code at the door and reports a refused handover. Needs a little WBT. |
| `FAUCET_PK` | The test-mode faucet wallet (WBT and test USDT for new test buyers). |
| `ARKIV_ACCESS_KEY` | PoP's Arkiv access key. |
| `WORLD_RP_SIGNING_KEY` | Signs World ID requests. Shown once in the World portal. |

### Server-side configuration (not secret, still not public)
| Name | Value |
|---|---|
| `NETWORK_MODE` | `testnet` |
| `WHITECHAIN_RPC_URL` | `https://rpc.testnet.whitechain.io` |
| `CHECKOUT_ADDRESS`, `REGISTRY_ADDRESS` | the deployed addresses (see `docs/evidence.md`) |
| `DEPLOY_BLOCK` | `12330534` (the block before the deploy; event scans start here) |
| `USDT_ADDRESS` | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` (optional, this is the default) |
| `WORLD_APP_ID`, `WORLD_RP_ID`, `WORLD_ENVIRONMENT` | from the World portal. `staging` while using the Simulator. |
| `NEXT_PUBLIC_BASE_URL` | the public URL of the PoP project. Optional. The only variable with a public prefix, and it holds no secret. |
| `WORLD_REVIEW_ACTIONS` | optional JSON override of the seller-to-action map |
| `POP_ATTESTOR_ADDRESS`, `FAUCET_DAILY_CAP`, `USDT_DECIMALS`, `WORLD_VERIFY_BASE` | optional |

### Must never be set on Vercel
- **`POP_DEV_SKIP_WORLD`**. It skips the World proof. The code refuses it on any deployed build: the review route returns HTTP 500 and logs an error, so setting it by mistake takes reviews offline instead of opening a hole. Verified on a production build.
- `NETWORK_MODE=fork` and `FORK_RPC_URL` (local fork only).
- Any private key that is not listed above (deployer and arbiter keys stay off the server; the arbiter signs from the browser of the person holding the key).

### Other setup
- Webhooks: there is no queue. Something has to call `GET /api/webhooks/dispatch` (or `POST`). Order pages and order registration trigger a pass, and `apps/web/vercel.json` declares a cron on it. See "Webhook dispatch on Vercel" below for what the cron can and cannot do on each plan.
- The Kurta Co. merchant row stores the store's webhook URL and allowed return origin. After the store has a public URL, run `KURTA_ORIGIN=https://<store> KURTA_WEBHOOK_URL=https://<store>/api/pop/webhook npm run seed:merchant` from a laptop (it also checks the merchant wallet has gas).

## Project 2: Kurta Co. (`apps/demo-store`)
### Server-only secrets
| Name | What it is |
|---|---|
| `POP_API_KEY` | Merchant API key for creating checkout sessions. |
| `POP_WEBHOOK_SECRET` | Verifies PoP's webhook signatures. |
| `MERCHANT_PK` | The store's seller wallet key. It signs the store's own offers. |
| `DATABASE_URL` | Postgres for the store's order book (its own schema `kurta_<chain id>`, created on first use). |
| `KURTA_ARKIV_ACCESS_KEY` | The store's own Arkiv key. Must differ from PoP's. |

### Server-side configuration
| Name | Value |
|---|---|
| `POP_BASE_URL` | the public URL of the PoP project |
| `KURTA_ORIGIN` | the store's own public URL (used for the return link) |
| `POP_ATTESTOR_ADDRESS` | `0xeF0CC7f7f280083e425A741957B920c7eF39A21c` |
| `CHAIN_ID`, `RPC_URL`, `CHECKOUT_ADDRESS`, `REGISTRY_ADDRESS`, `DEPLOY_BLOCK` | the chain pin. Set all five so the store does not depend on PoP to tell it which contract is real. |

### Must never be set
`POP_DEV_SKIP_WORLD` (the store does not use it), and nothing with a `NEXT_PUBLIC_` prefix is needed.

## Before the first deploy
1. Team says go. 2. `npm run db:migrate` against `public` (already applied on Fri 6 Nov). 3. Create both projects, paste the names above. 4. Redeploy PoP once the store's URL is known. 5. Re-seed the merchant row with the real URLs. 6. Open `/proof` on the PoP deployment and check the addresses match `docs/evidence.md`. 7. Never redeploy the contracts: it resets every seller's review history.

## Build settings (both projects)
Checked Fri 6 Nov: `VERCEL=1 npm run build:web` and `VERCEL=1 npm run build:store` both exit 0 from the repo root with no `.env` loaded (the shell had none of the app variables set). Not checked: the Vercel dashboard itself, since nothing was deployed.

| Setting | PoP | Kurta Co. |
|---|---|---|
| Root directory | `apps/web` | `apps/demo-store` |
| Include source files outside of the Root Directory | **On** (needs `packages/shared`) | **On** (needs `packages/shared` and `packages/checkout-sdk`) |
| Framework preset | Next.js | Next.js |
| Install command | `npm install` (runs at the repo root through the workspaces; leave the default if Vercel detects npm from `package-lock.json`) | same |
| Build command | `npm run build` (this is `next build` inside the app) | same |
| Output directory | default (`.next`) | default |
| Node.js version | UNVERIFIED: local development uses Node 26.13. Pick the newest version Vercel offers that satisfies Next 16.4.5 and check the first build log. | same |
| `vercel.json` | `apps/web/vercel.json` (cron only) | none |

## Webhook dispatch on Vercel
There is no queue. A pass is one call to `/api/webhooks/dispatch` (GET or POST, no auth; it only reports facts already on chain). Passes also run, best effort, after `POST /api/orders/confirm` and on every `GET /api/orders/[id]`, which the order page polls. So a merchant hears about `order.funded` at once, but later events (`shipped`, `delivered`, `released`, `refunded`) are sent only when someone has the order page open, when a cron fires, or when a loop is running.

**Vercel cron limits** (https://vercel.com/docs/cron-jobs/usage-and-pricing, read Fri 6 Nov): Hobby allows cron jobs that run **once per day** at most, with timing precision of an hour (a job set for 01:00 may run any time from 01:00 to 01:59). A faster expression fails the deployment on Hobby. Pro and Enterprise allow once per minute with per-minute precision. Which plan the team has is **UNVERIFIED**.

`apps/web/vercel.json` therefore ships with the only schedule that deploys on every plan: `0 0 * * *` (daily). That is a safety net, not a real-time path. Choices:
1. **Hobby (default, free).** Keep the daily cron. Real-time behaviour comes from the order pages, order registration and a loop script run by a person. Run the loop on a laptop against the deployed URL and leave it running during judging: `POP_URL=https://<pop-project>.vercel.app npm run webhooks` (it POSTs to `/api/webhooks/dispatch` every 5 seconds; `scripts/webhooks-loop.ts`, no keys needed). If the laptop sleeps, delivery pauses and resumes on the next pass. Nothing is lost, because the dispatcher rescans chain events and retries (8 attempts).
2. **Pro.** Change `schedule` in `apps/web/vercel.json` to `* * * * *` (every minute) and redeploy. The loop script is then optional.
3. **Any plan.** An external pinger (a free uptime monitor hitting the GET URL every minute) also works, but it is a third party calling your API: use it only if the team agrees.

## Paste-ready environment lists
Each name was checked against the code on Fri 6 Nov (`process.env` reads in `apps/web/src`, `packages/shared/src`, `apps/demo-store/src`). "copy from pop/.env" means the value is in the repo-root `.env` on the first machine. Never paste a value into chat or git. `POP_DEV_SKIP_WORLD` is not in either list and must never be added to either project.

### Project 1: PoP (`apps/web`)
Server-only (secret):
```
DATABASE_URL            copy from pop/.env (Supabase pooler URL; migrate testnet public first)
ADDRESS_ENC_KEY         copy from pop/.env (losing it makes stored delivery details unreadable)
SESSION_SECRET          copy from pop/.env
COURIER_PASSCODE        copy from pop/.env
ATTESTOR_PK             copy from pop/.env
COURIER_PK              copy from pop/.env
FAUCET_PK               copy from pop/.env
ARKIV_ACCESS_KEY        copy from pop/.env (PoP's own Arkiv key)
WORLD_RP_SIGNING_KEY    copy from pop/.env (shown once in the World portal)
```
Config (not secret, still server side):
```
NETWORK_MODE            testnet
WHITECHAIN_RPC_URL      https://rpc.testnet.whitechain.io
CHECKOUT_ADDRESS        0xB6A894bE070951a7331DebFf615e11F7a076794c   (deployments/testnet.json)
REGISTRY_ADDRESS        0x6D61cD77239dd61e43e943a4Aac006d8A6C285E5   (deployments/testnet.json)
DEPLOY_BLOCK            12330534   (deployments/testnet.json; see the block note below)
WORLD_APP_ID            copy from pop/.env
WORLD_RP_ID             copy from pop/.env
WORLD_ENVIRONMENT       copy from pop/.env (staging while using the Simulator)
POP_ATTESTOR_ADDRESS    0xeF0CC7f7f280083e425A741957B920c7eF39A21c   (public)
```
Optional (defaults are in code, skip unless needed): `USDT_ADDRESS` (default is the deployed test USDT), `USDT_DECIMALS` (default 6), `FAUCET_DAILY_CAP`, `WORLD_VERIFY_BASE`, `WORLD_REVIEW_ACTIONS` (default map is in `packages/shared/src/config.ts`), `NEXT_PUBLIC_BASE_URL` (public prefix, holds no secret).

Do not set on Vercel: `FORK_RPC_URL`, `DEPLOYER_PK`, `ARBITER_PK`, `TEST_BUYER_PK`, `SELLER_PK`, `MERCHANT_PK`, `POP_API_KEY`, `POP_WEBHOOK_SECRET`.

### Project 2: Kurta Co. (`apps/demo-store`)
Server-only (secret):
```
POP_API_KEY             copy from apps/demo-store/.env.local
POP_WEBHOOK_SECRET      copy from apps/demo-store/.env.local
MERCHANT_PK             copy from apps/demo-store/.env.local
DATABASE_URL            copy from apps/demo-store/.env.local (store schema kurta_1874 is created on first use)
KURTA_ARKIV_ACCESS_KEY  copy from apps/demo-store/.env.local (must differ from PoP's ARKIV_ACCESS_KEY)
```
Config:
```
POP_BASE_URL            https://<pop-project>.vercel.app   (the deployed PoP URL, no trailing slash)
KURTA_ORIGIN            https://<store-project>.vercel.app (the store's own URL)
POP_ATTESTOR_ADDRESS    0xeF0CC7f7f280083e425A741957B920c7eF39A21c   (public)
CHAIN_ID                1874
RPC_URL                 https://rpc.testnet.whitechain.io
CHECKOUT_ADDRESS        0xB6A894bE070951a7331DebFf615e11F7a076794c
REGISTRY_ADDRESS        0x6D61cD77239dd61e43e943a4Aac006d8A6C285E5
DEPLOY_BLOCK            12330534
```
The five chain pin names work together: `apps/demo-store/src/lib/pop.ts` only trusts them when all five are set, and otherwise asks PoP which contract is real. Set all five.

### Names in `.env.example` or `.env` that no app code reads (do not add to Vercel)
`WHITECHAIN_CHAIN_ID`, `ARKIV_CHAIN_ID`, `NEXT_PUBLIC_WORLD_APP_ID`, `RECLAIM_APP_ID`, `RECLAIM_APP_SECRET`, `RECLAIM_INSTAGRAM_PROVIDER_ID`. A script may read `WHITECHAIN_CHAIN_ID` or `ARKIV_CHAIN_ID` (UNVERIFIED); the others have no read in `apps/` or `packages/`.

### Names the code reads that were missing from this file before
None for the two apps: every name read in `apps/web`, `packages/shared` and `apps/demo-store` is listed above or under "Optional". These names are read only by local scripts, so they are not project settings: `ALLOW_TESTNET_DEPLOY`, `ALLOW_TESTNET_ORDER`, `ALLOW_DEMO_SEED`, `WEB_URL`, `POP_URL`, `KURTA_URL`, `KURTA_WEBHOOK_URL`, `FORK_RPC_URL`, `DEPLOYER_PK`, `ARBITER_PK`, `TEST_BUYER_PK`, `SELLER_PK`.

### Block note
`DEPLOY_BLOCK` is 12330534 in `deployments/testnet.json` and here. `docs/evidence.md` and `CLAUDE.md` say the deploy was at block 12330545. The app only uses it as the start of event scans, so the lower number is safe. The mismatch is item 3 in `parallel.md` section 7, for a human to settle from the chain.

## Post-deploy smoke check
After both projects are live, with the two URLs (no keys needed, only GET requests):
```
npx tsx scripts/vercel-smoke.ts https://<pop-project>.vercel.app https://<store-project>.vercel.app
```
It prints PASS or FAIL for each of these: PoP home; `/api/config` (testnet, chain 1874, the three deployed addresses, `devSkipWorld` false, not a local fork); `/api/verify/meera.jewels` registered; an unknown handle returns 404; `/api/listings/jhumka-01` (terms hash matches, seller active); `/proof` shows the checkout address; `/api/webhooks/dispatch` runs one pass without error; store home; store `/api/record`; store `/orders`; store `/api/orders`. It exits 1 if anything fails. **Not yet run against a live deploy**: it was type checked and its usage message was tested, and the response shapes it reads were taken from the route code.

## Re-seed Kurta for the deployed store
The merchant row in PoP's database stores the store's webhook URL and the one origin PoP may send the buyer back to. After the store has its URL:
1. Take the chain lock in `parallel.md` and get the human's yes. When `@kurta.co` is already registered (it is on 1874) the script sends no transaction, but it writes to the database.
2. From the repo root on a laptop that has `pop/.env`:
   ```
   NETWORK_MODE=testnet \
   POP_BASE_URL=https://<pop-project>.vercel.app \
   KURTA_ORIGIN=https://<store-project>.vercel.app \
   KURTA_WEBHOOK_URL=https://<store-project>.vercel.app/api/pop/webhook \
   npm run seed:merchant
   ```
   Export `NETWORK_MODE=testnet` after anything that sources `.env`, because `.env` sets fork. The script is idempotent. Expected output: `@kurta.co already registered`, then the merchant row with the new `webhook` and `returnOrigin`. It does not print the API key or the webhook secret, and it does not rotate them (they are only generated when empty).
3. Side effect to undo locally: the script rewrites `POP_BASE_URL` (and re-writes the other store names) in `apps/demo-store/.env.local`, so a later local store run would point at the deployed PoP. Set `POP_BASE_URL` in that file back to `http://localhost:3000` for local runs, or keep a copy of the file first. The Vercel project env is separate and is not touched.
4. Run the smoke check above, then one real order through the store.
