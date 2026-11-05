# CLAUDE.md: PoP project memory (read this first, every session)

## 1. Project summary
PoP: Proof of Purchase. A protected checkout for Indian Instagram/WhatsApp sellers and small websites (ETHGlobal Mumbai 2026, From Scratch).
Buyer pays the specified Whitechain test USDT into `PoPCheckout` on Whitechain Sepolia (1874), using a seller-signed EIP-712 Offer.
Funds are released only by the buyer's 6-word delivery code at the door; a missed ship-by or deliver-by deadline lets anyone `finalize` into a full refund.
Courier role can only do Shipped → Disputed; the arbiter resolves disputes and bans. After a Released order, a World ID proof gates one review per human per seller.
Reviews are readonly Arkiv entities (Rabdi 7794095), created by our attestor and transferred to the buyer; a separate "Kurta Co." store reads them with its own key.

**Judge sentences (every design choice must protect these):**
1. "If it doesn't arrive, you get your money back automatically. Nobody can stop that refund, including us."
2. "The money is released by the buyer's code at the door; our courier key can't release a single rupee."
3. "Reputation is earned only from protected deliveries, counts each human once per seller, and lives on Arkiv where any app can read it."

Deadline: **Sat 7 Nov 09:00 IST** (target submit 07:00). Partner prizes: Whitechain (Operate), Arkiv (Build from scratch), World (Best Use of IDKit). No others.

## 2. Locked decisions
- Name "PoP" lives in ONE place: `packages/shared` `APP_NAME` + the EIP-712 domain name. Change both together, only before the first testnet deploy.
- Stack (submission tags): EVM, Optimism (Whitechain is an OP Stack L2); Foundry; OpenZeppelin Contracts; Next.js; React; PostgreSQL; Supabase.
- Also used: viem + wagmi, @arkiv-network/sdk 1.0.x (server only), World IDKit 4.x + server verify, Tailwind, qrcode, html5-qrcode, @scure/bip39, zod, Vitest, Vercel (two projects).
- Not used: Scaffold-ETH, ethers.js, web3.js, Privy, Self, Anon Aadhaar, Semaphore, The Graph. Hardhat only if Foundry fails (it didn't).
- Review rule: **one review per unique human PER SELLER**. Enforced by Postgres `UNIQUE(nullifier_hash, seller_wallet)`; Arkiv gets only `keccak(nullifier, seller)`.
- Handle proof: staff-checked bio code (tier 1) first; Reclaim (tier 2) only later if time allows.
- DB: Supabase Postgres. Buyer PII is AES-256-GCM encrypted; never on any chain or on Arkiv.
- API never moves money on its own; it reads receipts/state before writing to Arkiv/DB; chain-derived writes are idempotent.
- Arkiv and World secrets are server-only (never `NEXT_PUBLIC_`).
- Buyer screens: no "escrow", "nullifier", "chain ID", "gas". Show "₹899 · 1.00 test USDT". "TEST MODE" wallet label, "SIMULATED COURIER" page label.
- Never claim "trustless", "impossible to fake", "delivery verified on-chain".
- Solidity: solc 0.8.30, evm_version prague (Whitechain docs; verification fails if the compiler differs).

## 3. Repo map
| Path | What |
|---|---|
| `contracts/` | Foundry: `src/PoPCheckout.sol`, `src/SellerRegistry.sol`, `test/`, `script/Deploy.s.sol`, OZ in `lib/` |
| `apps/web/` | PoP Next.js (App Router, TS, Tailwind, src/): pages + API routes |
| `apps/demo-store/` | Kurta Co. demo merchant (separate Vercel project) |
| `packages/shared/` | `APP_NAME`, chain defs (1874, 7794095), EIP-712 Offer types, ABIs |
| `scripts/` | tsx scripts: smoke tests, wallet setup, seed, keeper |
| `supabase/migrations/` | `0001_init.sql` (Architecture §9) |
| `arkiv/` | Arkiv judging files |
| `docs/` | evidence.md, friction-log.md, submission-tags.md, WORLD_DEBRIEF.md, limitations.md |
| `specs/` | Pre-build planning docs + prompts (disclosure) |

## 4. Environment and commands (Windows)
- Foundry is installed in `~/.foundry/bin` (forge 1.9.0). **It only runs from Git Bash, not PowerShell.** In Git Bash: `export PATH="$PATH:$HOME/.foundry/bin"`.
- Node v26.13.0, npm 11.20.0. If a tool breaks on Node 26, switch to Node 22 LTS (nvm-windows).
- Install: `npm install` at `pop/` (npm workspaces). **Never** install at the ETH root.
- Contracts (Git Bash): `cd contracts && forge build && forge test -vv`
- Web: `npm run dev -w apps/web` · build: `npm run build -w apps/web`
- Demo store: `npm run dev -w apps/demo-store`
- Scripts: `npx tsx scripts/<name>.ts` (loads `pop/.env`)
- Deploy (ASK FIRST): `forge script script/Deploy.s.sol --rpc-url $WHITECHAIN_RPC_URL --broadcast --verify --verifier blockscout --verifier-url https://explorer.testnet.whitechain.io/api/`
- OneDrive: EPERM/EBUSY during npm install means pause OneDrive sync (tell the user; don't move folders).

## 5. Status checklist (Spec v3 §14)  ☐ todo · ◐ partial · ☑ done
**MUST**
- ☐ EIP-712 offer + `pay` with the specified test USDT, verified on the explorer
- ☐ `confirmDelivery` + `confirmReceived` + `finalize` (both refunds + release) + `withdraw`
- ☐ `reportHandoverRefused` → Disputed + `resolveDispute` (ugly arbiter page OK)
- ☐ Seller registry with handle tier + ban
- ☐ Onboarding (bio-code handle proof, one product, link/QR/badge)
- ☐ Product checkout with terms card + test-mode wallet + capped faucet
- ☐ Order page with code QR + 6 words; courier simulator
- ☐ World-gated review → Arkiv readonly entity → transfer to buyer; duplicate + cancelled paths
- ☐ Verify page reading Arkiv + contract; red for unknown/banned
- ☐ Separate demo store with Pay with PoP + its own Arkiv read
- ☐ Proof page; Foundry tests (invariants + failure paths)

**SHOULD**
- ☐ Reputation-tiered dispute window
- ☐ Outcome entities on Arkiv + buyer-history bucket
- ☐ Seller CSV export with tx hashes; platform fee (`feeBps`)
- ☐ "Agreed vs current listing" panel on disputes

**STRETCH**
- ☐ Chrome extension trust card
- ☐ Dispute evidence on Swarm (Arkiv bonus)

## 6. Go/no-go gates
| # | Gate | Deadline (IST) | Status | When / note |
|---|---|---|---|---|
| 1 | Specified test USDT readable on 1874 (symbol, decimals) + a funded wallet holds some | Fri 01:00 | ☐ | Docs list a DIFFERENT USDT (0xaa79…8f46, 6 dp). Need on-chain read of 0xcedf… |
| 2 | Foundry working | Thu 00:45 | ☑ | Thu 23:48: forge/cast/anvil 1.9.0 via foundryup in Git Bash |
| 3 | Arkiv create + query + changeOwnership | Fri 03:00 | ☐ | needs access key + tGLM |
| 4 | World review action verified server-side with simulator | Fri 03:00 | ☐ | IDKit 4.x needs rp_id + RP signing key |
| 5 | Whitechain mentor: protected checkout counts as Operate | Fri 10:00 | ☐ | user |
| 6 | Explorer verification method known | Fri 10:00 | ☑ | Thu 23:55: Blockscout, `--verifier blockscout --verifier-url https://explorer.testnet.whitechain.io/api/` (docs.whitechain.io/build/deploy/deploy-with-foundry) |
| 7 | Organizers OK with planning docs in specs/ | Fri 12:00 | ☐ | user |

## 7. Addresses, tx hashes, entity keys (NEVER private keys)
Wallets: _pending generation_
Contracts: _not deployed_

## 8. Blockers and decisions log
- Thu 23:48: Foundry via Git Bash foundryup (user chose option a). WSL not installed. Foundry cannot run in PowerShell.
- Thu 23:48: Kept the teammate's LICENSE (MIT, existing copyright line) per user.
- Thu 23:50: Repo-local git identity set (Shantanu Somwanshi, user's email). autocrlf=true.
- Thu 23:55: **USDT discrepancy**: prize text says `0xcedfB561…55a7`; docs.whitechain.io token list says USDT = `0xaa7962d0…8f46` (6 dp, "USDT.e" bridged from Tron Nile). Following the prize text (rule order #1) until a mentor says otherwise. Faucet gives only WBT (0.5/day, GitHub OAuth ≥30 days). Ask the mentor how to get test USDT at 0xcedf….
- Thu 23:55: **World ID 4.0 / IDKit 4.x** changes the flow: backend signs `rp_context` with `WORLD_RP_SIGNING_KEY`; widget `IDKitRequestWidget` (controlled); verify via `POST https://developer.world.org/api/v4/verify/{rp_id}`; result has `responses[].nullifier`. Docs: "4.0 uniqueness proofs are one-time per action for each user". Risk: one `review` action may allow only one review per human in total. Fallback: one action per seller, created in the portal (demo has 2–3 sellers). Verify in smoke test D.
- Thu 23:55: Docs say solc 0.8.30, evm prague for Whitechain.

## 9. Progress log (IST, newest first)
- Thu 23:55: Docs checked: Whitechain (RPC, Blockscout verify), Arkiv SDK 1.0.x API, World IDKit 4.x.
- Thu 23:50: Committed .gitignore first (715cbf0).
- Thu 23:48: Foundry 1.9.0 installed (gate 2 ☑).
- Thu 23:45: Tools: git 2.56.0, node 26.13.0, npm 11.20.0; Foundry missing; WSL not installed.

## 10. Next 3 actions
1. Copy specs, scaffold workspaces, Foundry project + OZ.
2. Generate wallets → `.env`; smoke test A (Whitechain read of 0xcedf…).
3. Contracts + Foundry tests (smoke B).

## 11. User action items
- [ ] Whitechain faucet (WBT) for deployer / faucet / courier / arbiter: https://faucet.testnet.whitechain.io (GitHub login)
- [ ] Ask the Whitechain mentor: how to get test USDT at `0xcedf…55a7` (docs list `0xaa79…8f46`) + gate 5
- [ ] Arkiv: access key (hub.arkiv.network/access-keys, network Rabdi) + tGLM for the attestor (hub.arkiv.network/faucet)
- [ ] World Developer Portal (developer.world.org): app in `external` mode, World ID 4.0 enabled → `app_id`, `rp_id`, signing key; staging action `review`
- [ ] Supabase project → `DATABASE_URL`
- [ ] Ask organizers about specs/ (gate 7)
- [ ] Vercel (later)
