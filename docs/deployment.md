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
- Webhooks: there is no queue. Something has to call `GET /api/webhooks/dispatch` (or `POST`). Order pages and order registration trigger a pass, and a Vercel Cron job should call it every minute. No `vercel.json` exists yet.
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
