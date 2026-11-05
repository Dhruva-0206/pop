# PoP: Handoff for a new machine

**Written Fri 6 Nov 2026, 03:10 AM IST.** For the teammate continuing on another PC, and for the Claude Code session there.

**Claude: read this file, then `CLAUDE.md` in the repo root. `CLAUDE.md` is the live project memory and wins if the two disagree. This file explains the background and what to do next.**

---

## 0. Critical facts

| Item | Value |
|---|---|
| Event | ETHGlobal Mumbai 2026, **Building from Scratch** track |
| Hard deadline | **Sat 7 Nov 2026, 9:00 AM IST**, no late entries. **Target submit: 7:00 AM.** |
| Feature freeze | **Fri 6 Nov, 8:00 PM IST** |
| Repo | https://github.com/Dhruva-0206/pop (branch `main`) |
| Product | **PoP: Proof of Purchase** |
| Partner prizes (max 3) | **Whitechain** (Operate: Stablecoin Payments for Business), **Arkiv** (Build on Arkiv, from scratch), **World** (Best Use of IDKit). No others. |
| Commit rule | **NEVER add `Co-Authored-By`, "Generated with Claude Code", session links or any AI trailer to commits or PRs.** AI use is disclosed in `AI_USAGE.md` instead. `.claude/settings.json` turns attribution off. |

---

## 1. What we are building

### The problem
Most Indian orders from small Instagram/WhatsApp sellers are **Cash on Delivery (COD)**. Buyers don't trust small sellers enough to pay first, and sellers lose money when COD buyers refuse parcels at the door.

### The product
A protected checkout that makes **paying upfront as safe as COD**:

- The seller gets a **payment link/QR** to share in Instagram/WhatsApp, or a **"Pay with PoP" button** for a small website (about 20 lines of code).
- The buyer pays **test USDT** into our smart contract on **Whitechain Sepolia**. The money is held by the contract, not by the seller or by us.
- The buyer's browser creates a secret **6-word delivery code**. Only its **hash** goes on-chain.
- At the door, the buyer gives the code to the courier. The contract checks it, the order becomes **Delivered**, and after a short dispute window anyone can **finalize**, which pays the seller.
- **Missed deadlines** (ship-by or deliver-by) let **anyone** trigger a **full automatic refund**. Nobody can block it, including us.
- The **courier role can only move Shipped → Disputed** ("buyer refused handover"), and only before deliver-by. It **can never move money**.
- An **arbiter** (team member) resolves quality disputes: refund, release or split. If the arbiter doesn't decide in time, the buyer is refunded automatically.
- After a completed order, the buyer can leave **one review per unique human per seller**, gated by **World ID**.
- Reviews are stored on **Arkiv** as **locked (readonly)** records created by our attestor and then **owned by the buyer**, so we can't edit or delete them. Any app can read them.
- A separate demo shop, **Kurta Co.**, reads the reputation directly from Arkiv with **its own key** (proving portability) and uses the "Pay with PoP" button.

### Three sentences every design decision must protect
1. "If it doesn't arrive, you get your money back automatically. Nobody can stop that refund, including us."
2. "The money is released by the buyer's code at the door; our courier key can't release a single rupee."
3. "Reputation is earned only from protected deliveries, counts each human once per seller, and lives on Arkiv where any app can read it."

### Simulated parts (say so openly)
- The courier is a team member on a page labelled **SIMULATED COURIER**.
- The arbiter is the team.
- All money is testnet tokens. Real rupee payments would need a licensed on-ramp (roadmap).

---

## 2. Tech stack

### Chains and sponsors
| Tech | Role |
|---|---|
| **Whitechain Sepolia**, chain ID **1874** (an OP Stack L2 built with Optimism) | Money, deadlines, refunds, bans, lost-dispute counters. Source of truth for funds. |
| **Test USDT** `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` | Payment token (Tether USD, **6 decimals**, confirmed on-chain). The sponsor requires ≥1 real payment in it; a self-minted token does not count. Whitechain docs list a different USDT (`0xaa79…8f46`), so we follow the prize text and are confirming with the mentor. |
| **WBT** | Whitechain gas coin. Faucet: faucet.testnet.whitechain.io (0.5 WBT/day per GitHub account, no USDT). |
| **Arkiv** Rabdi testnet, chain ID **7794095** | Public reputation database: seller profiles and reviews, as entities with owner, indexed fields and expiry. SDK `@arkiv-network/sdk` 1.0.x, **server-side only**. |
| **World ID 4.0 / IDKit 4.x** | Proof of unique human, used **only** at the review step. Verified on our server. |

### Contracts
- **Solidity** 0.8.30, `evm_version = prague` (required for Whitechain explorer verification)
- **Foundry** 1.9.0 (forge, cast, anvil). **Runs only from Git Bash on Windows, not PowerShell.**
- **OpenZeppelin Contracts** v5.6.1 + forge-std v1.17.0 (git submodules in `contracts/lib`)
- Explorer: **Blockscout**. Verify with `--verifier blockscout --verifier-url https://explorer.testnet.whitechain.io/api/`

### Web
- **Next.js 16** (App Router, TypeScript, Tailwind), **React**. Cache Components is ON: every API route calls `await connection()`, and live pages poll the APIs.
- **viem** (chain access, wallet), **TEST MODE burner wallet** in browser localStorage
- `@scure/bip39` (6-word code), `qrcode` + `html5-qrcode`, **zod** (input checks)
- **Vercel** for hosting (two projects: `apps/web` and `apps/demo-store`)

### Data
- **PostgreSQL on Supabase**: private data only. Schema: `supabase/migrations/0001_init.sql`.
- Buyer address encrypted with **AES-256-GCM**. **No personal data ever goes on any chain or on Arkiv.**
- **Currently a local JSON file (`.data/<mode>.json`) stands in** because `DATABASE_URL` isn't set. **This must be replaced with Supabase before deploying to Vercel** (Vercel has no persistent disk).

### Submission-form tags (select exactly these)
| Dropdown | Select |
|---|---|
| Blockchain networks | **EVM, Optimism** (do NOT tick Worldchain, Ethereum, Arc, Base) |
| Ethereum developer tools | **Foundry, OpenZeppelin SDK** (not scaffold-eth, Hardhat, ethers.js, web3.js, Privy, Self, Anon Aadhaar…) |
| Web frameworks | **Next.js, React.js** |
| Databases | **PostgreSQL, Supabase** |
| Judging route | **Finalist + Partner Prizes** (switch to partner-only if the end-to-end flow isn't working by Fri 8 PM) |

Arkiv, World, viem aren't in any dropdown, so describe them in "How it's made".

---

## 3. Repo map

```
pop/
├── CLAUDE.md               live project memory (READ FIRST)
├── AI_USAGE.md             AI disclosure (ETHGlobal requirement)
├── .claude/settings.json   attribution OFF
├── .env.example            all env vars (empty). Real .env is NOT in git.
├── contracts/              Foundry
│   ├── src/PoPCheckout.sol     money + order state machine (~405 lines)
│   ├── src/SellerRegistry.sol  attestor-signed seller registration, permanent bans
│   ├── src/PoPConfig.sol       EIP-712 domain name "PoP" (must match APP_NAME)
│   ├── test/                   39 unit/fuzz tests + invariant suite
│   └── script/Deploy.s.sol
├── apps/web/               PoP Next.js app (pages + API routes)
├── apps/demo-store/        Kurta Co. (placeholder only so far)
├── packages/shared/        APP_NAME, chain defs, network mode, EIP-712 types, ABIs,
│                           delivery-code hashing, terms hashing, AES/HMAC helpers, file store
├── scripts/                gen-wallets, fork, fork-fund, deploy, seed-seller, e2e-fork,
│                           smoke-whitechain (A), smoke-arkiv (C), smoke-db (E)
├── supabase/migrations/    0001_init.sql
├── arkiv/                  judging files (stubs): schema, friction, reach, why-arkiv, how-you-use-arkiv
├── docs/                   evidence.md, friction-log.md, submission-tags.md, WORLD_DEBRIEF.md, limitations.md
└── specs/                  pre-build planning docs + prompts (disclosure)
```

---

## 4. How the contracts work

### SellerRegistry
- `registerSeller(seller, handleHash, handleTier, nonce, deadline, attestorSig)`: anyone submits; the **attestor's EIP-712 signature** is the authority. One handle per wallet; signatures are single-use and expire.
- Tiers: 0 unverified, 1 staff-checked bio code (**what we use**), 2 Reclaim (only if time allows).
- `ban(seller)`: arbiter only; **permanently bans the wallet AND the handle**.
- `isActive(seller)`: checked by the checkout before every payment.

### PoPCheckout
**Offer (EIP-712, signed by the seller):** seller, listingId, termsHash, externalRef, price, shipWithin, deliverWithin, maxUnits, validUntil, version. The buyer can't change the price or deadlines.

**States:** None → Funded → Shipped → Delivered → Released, plus Disputed, Refunded, Split.

| Function | Caller | Effect |
|---|---|---|
| `pay(offer, sellerSig, codeHash)` | buyer | Checks signature, expiry, revocation, stock, seller active; pulls USDT; Funded |
| `markShipped(id, trackingHash)` | seller, before shipBy | Shipped; sets deliverBy |
| `confirmDelivery(id, code)` | **anyone** | Checks `keccak256(abi.encodePacked(block.chainid, address(this), code)) == codeHash` → Delivered |
| `confirmReceived(id)` | buyer | Same result, without the code |
| `reportHandoverRefused(id)` | courier role, **before deliverBy** | Shipped → Disputed. Never moves money. |
| `openDispute(id, evidenceHash)` | buyer, inside window | Delivered → Disputed |
| `resolveDispute(id, buyerBps, decisionHash)` | arbiter, **before arbiterTimeout** | Refund / release / split; buyer wins >50% → `lostDisputes[seller]++` (permanent) |
| `finalize(id)` | **anyone** | Late ship → refund (reason 1); late delivery → refund (2); window over → release; arbiter timeout → refund (4) |
| `withdraw()` / `withdrawFor(account)` | anyone | Pull payments; `withdrawFor` only pays the owner |
| `revokeOffersBelow(v)` | seller | Cancels old offers |

- **Pull payments:** settlement credits balances; withdrawal is a separate step (defends against reentrancy).
- **Accounting:** `token balance == totalLocked + totalCredit`, checked by the invariants.
- **Fee:** `feeBps` (1% in the demo, max 10%), taken only on release.
- **Reputation-tiered dispute window:** `completed >= trustedMinCompleted && lostDisputes == 0` gives `shortWindow`, otherwise `longWindow`.
- **Arbiter timeout:** constructor param (demo 300 s, production 14 days).

**Tests:** 39 unit/fuzz tests plus a stateful invariant suite (4 invariants: solvency, courier never increases any credit, exactly one terminal state, no order locked forever).

### The delivery code
- 6 BIP-39 words (~66 bits) created **in the buyer's browser**. The words ARE the secret.
- Normalised (lowercase, single spaces) by `packages/shared/src/code.ts`, which mirrors the contract hash exactly.
- Binding to chainId + contract means codes can't be replayed across chains or deployments.

---

## 5. Network mode (important)

`.env` → `NETWORK_MODE=fork|testnet`
- **fork:** a LOCAL anvil fork of Whitechain state, with the real USDT bytecode, running with **chain ID 31337** (not 1874), so nothing signed on the fork can be replayed on the real chain with our real testnet keys. Balances are written into token storage by `scripts/fork-fund.ts` (the USDT is a proxy; the script finds the balance slot). UI shows **"LOCAL FORK · not a real payment"**.
- **testnet:** the real Whitechain Sepolia 1874.

Fork loop (three Git Bash terminals inside `pop/`):
```bash
npm run fork        # keep running
npm run fork:up     # fund wallets + deploy + seed @meera.jewels + listing jhumka-01
npm run dev:web     # http://localhost:3000/p/jhumka-01
npx tsx scripts/e2e-fork.ts   # full journey through API + contracts (currently PASSES)
```
If the fork restarts, rerun `npm run fork:up` and delete `.data/fork.json`.

---

## 6. The website

### Pages (built, rough)
| Route | User | Does |
|---|---|---|
| `/p/[listingId]` | buyer | Terms card (rechecks termsHash), TEST MODE wallet, capped faucet, address form, approve + pay, creates the 6-word code |
| `/o/[orderId]` | buyer | Live timeline, code as words + QR, "I received it", settle-now, refund withdraw |
| `/dashboard` | seller | Signed-message sign-in, decrypted ship-to, mark shipped, withdraw. For the demo, paste `SELLER_PK` from .env (browser only). |
| `/courier` | team | SIMULATED COURIER, passcode (`COURIER_PASSCODE` in .env), type/scan code, handover refused |
| `/dev/world` | dev | World ID smoke test page |

### API routes (built)
`orders/confirm` (reads the tx receipt, decodes `OrderFunded`, stores the order with the address encrypted, idempotent), `faucet` (once per wallet, 5/IP/day, 200/day), `auth/seller`, `courier/{login,deliver,refused,status,orders}` (simulates before sending), `seller/{orders,tracking}`, `listings/[id]`, `orders/[id]`, `config`, `world/{rp-signature,verify-review}`.

### Rules for every screen
- Buyer screens never say escrow, nullifier, chain ID or gas.
- Show "₹899 · 1.00 test USDT".
- Label the TEST MODE wallet and the SIMULATED COURIER.
- Never claim "trustless", "impossible to fake" or "delivery verified on-chain".
- The API never moves money by itself; it reads the chain before writing to Arkiv or the DB, and writes are idempotent.
- Arkiv and World secrets are never `NEXT_PUBLIC_`.

---

## 7. Sponsor integration status

| Sponsor | Status | Notes |
|---|---|---|
| **Whitechain** | ◐ | USDT `0xcedf…` read on-chain OK. Deploy dry-run on fork OK. **Not deployed to 1874; no real USDT payment yet.** Need WBT + USDT. |
| **World** | ◐ code ready, never run | **World ID 4.0 proofs are one-time per (human, action)**, so there is **one portal action per seller**: `review-meera-jewels`, `review-kurta-co`, `review-demo-seller3` (map `WORLD_REVIEW_ACTIONS` in packages/shared). Signal = `keccak(orderId, buyer)`. Postgres `UNIQUE(nullifier_hash, seller_wallet)` is a second layer. Arkiv only ever gets `keccak(nullifier, seller)`. Verify endpoint: `POST https://developer.world.org/api/v4/verify/{rp_id}` (staging host UNVERIFIED). |
| **Arkiv** | ◐ script ready, never run | `scripts/smoke-arkiv.ts`: create readonly `pop_review_v1` → query by creator → `changeOwnership` to buyer. Needs access key + tGLM. |
| **Supabase** | ◐ | Migration written; `scripts/smoke-db.ts` ready. Not connected. |

### Arkiv design (from the architecture doc)
| Schema | Indexed fields | Flags | Owner | Expiry |
|---|---|---|---|---|
| `pop_seller_v1` | seller, handle, handle_tier, status | editable | attestor | ~182 days, renewed |
| `pop_review_v1` | seller, order_id, rating, created_at, reviewer_key, buyer_history | **readonly** | created by attestor, **transferred to buyer** | max (~182 days) |
| `pop_outcome_v1` (SHOULD) | seller, order_id, outcome, settled_at | readonly | attestor | max |

Readers trust only rows whose `$creator` is our attestor and, for reviews, only readonly rows. Good reviews fade (Arkiv expiry); bans and lost disputes never fade (contract counters).

---

## 8. Wallets (addresses only; keys are in `.env`, never in git)

| Role | Address | Needs |
|---|---|---|
| deployer (admin, treasury) | 0xB7C637cb5a37abbA288ca51f1d2Fd0c6776ABb2c | WBT |
| attestor (Arkiv writer, registry signer) | 0xeF0CC7f7f280083e425A741957B920c7eF39A21c | tGLM (Arkiv faucet), a little WBT |
| courier | 0x63d1FE1aB00f657516Bd7f94fCa9060118532E0C | WBT |
| faucet | 0x012f9baaDbCF059Fc70DAFcD7eB109404e703A43 | WBT + test USDT |
| arbiter | 0x502CbFd5c92dF9CbA8f55560471501794610d2E9 | WBT |
| demo merchant (Kurta Co.) | 0xB6a8fA0698Fdf0a8CD1b94e9101dCE39E63358Cf | WBT later |
| test buyer | 0xC47e6F52941653B52D1d7213429dd43CFf5234cE | WBT + test USDT |
| demo seller @meera.jewels (`SELLER_PK`) | 0x0bda864aa008bDa5fA7401A904f51f37866A3dE9 | WBT (local fork funds it) |
**The `.env` file is not in git.** Wallets were regenerated Fri 03:34 on purpose; the addresses above match the current `.env`. **Never run `npm run wallets` again and never regenerate wallets.**

---

## 9. What is DONE (~40% of the must-haves)

- ✅ Contracts: SellerRegistry + PoPCheckout, all functions, arbiter timeout
- ✅ 39 tests + 4 invariants passing
- ✅ Repo setup, 7 wallets, commit rule, attribution off, AI disclosure files, specs/
- ✅ Local fork mode with real USDT bytecode, deploy + seed scripts
- ✅ Rough pages: checkout, order, seller dashboard, courier, settle button
- ✅ `scripts/e2e-fork.ts` passes (pay → confirm → ship → wrong code rejected → right code → finalize → seller withdraws 0.99; unshipped order refunded 1.00; handover refused → Disputed)
- ◐ World, Arkiv and Supabase code written, never run (no keys)

## 10. What is LEFT

### Blocked on keys (only a human can get these)
1. **Arkiv**: access key (hub.arkiv.network/access-keys, network Rabdi) + tGLM to the attestor (hub.arkiv.network/faucet)
2. **World**: developer.world.org app (external mode, World ID 4.0) → `WORLD_APP_ID`, `WORLD_RP_ID`, `WORLD_RP_SIGNING_KEY` (**shown once**) + three staging actions listed in §7
3. **Supabase**: `DATABASE_URL`
4. **Whitechain mentor**: how to get test USDT at `0xcedf…`, and confirm a protected merchant checkout counts as **Operate** (their rules say plain escrow won't place; this is the biggest prize risk)
5. WBT for deployer, courier, arbiter and faucet (each teammate can claim 0.5/day with their GitHub)

### Contract fixes to make BEFORE the first testnet deploy (with tests)
1. Let the arbiter **force-refund open orders of a banned seller** (otherwise a banned scammer still gets paid on existing orders)
2. In `pay`, **reject `msg.sender == seller`** (blocks the cheapest self-purchase farming of the trusted tier)
3. In `orders/confirm`, take `listingId` from the on-chain `OrderFunded` event, not from the request body

### Building (in this order)
1. Run smoke C, D, E as soon as the keys land; log the results
2. **Replace the JSON store with Supabase** (required for Vercel)
3. Deploy + verify on 1874 (**ask the team first**) → one real USDT `pay` → save explorer links in `docs/evidence.md`
4. Review flow: World proof → order Released on-chain + buyer matches → `UNIQUE(nullifier, seller)` → Arkiv readonly review → `changeOwnership` to buyer
5. `/verify/[handle]`: Arkiv + contract counters; red for unknown or banned
6. **Kurta Co. demo store**: own Arkiv key, own merchant key, "Pay with PoP" in ~20 lines, `order.funded` webhook (HMAC) re-checked on-chain
7. `/onboard` (bio-code tier 1, one product, link/QR)
8. `/proof` page (every tx hash, contract address, Arkiv entity key, runnable query, test count)
9. Arbiter page (can be plain)
10. Test everything on a real phone; deploy both apps to Vercel

### Paperwork (after 8 PM freeze)
- README: problem, why on-chain stablecoin settlement, architecture, live links, contract + tx links, Arkiv writer wallet + runnable query, setup, limitations, prior art
- `/arkiv/` five files (their whole score comes from these four criteria)
- `WHITECHAIN_FEEDBACK.md`, `docs/WORLD_DEBRIEF.md`, complete `AI_USAGE.md`
- Demo video 2–4 min, ≥720p, **recorded on a laptop (not a phone)**, real voice, not sped up, no AI voiceover
- Submission form

**Cut order if time slips:** extension → CSV → tiered window → outcome entities → arbiter polish. **Never cut:** deadline refund, delivery code, review gate, verify page, demo store reading Arkiv.

---

## 11. Schedule (IST)

| When | Goal |
|---|---|
| Fri 03:00–08:30 | Keys in → smoke tests → Supabase swap → contract fixes (no testnet deploy yet). Humans sleep in shifts. |
| Fri 08:30–10:00 | Whitechain booth (USDT + Operate question) → deploy + verify → one real USDT payment |
| Fri 10:00–14:00 | Review flow → /verify → full loop on a phone |
| Fri 14:00–17:00 | Kurta Co. store + failure paths |
| Fri 17:00–20:00 | /onboard, /proof, arbiter page, Vercel, hardening |
| **Fri 20:00** | **FEATURE FREEZE** |
| Fri 20:00–00:00 | README + sponsor files |
| Sat 00:00–03:00 | Seed demo orders, rehearse 5×, record video + backup run |
| **Sat by 07:00** | **SUBMIT** (hard deadline 09:00) |

---

## 12. Setting up the new PC

Clone **outside OneDrive** to avoid file-lock errors.

**PowerShell:**
```powershell
mkdir C:\dev -Force; cd C:\dev
git clone --recurse-submodules https://github.com/Dhruva-0206/pop.git
cd pop
git config user.name "Your Name"
git config user.email "your-github-email"
npm install
# put the real .env here (copied from the original laptop)
code .
```

**Git Bash (Foundry):**
```bash
curl -L https://foundry.paradigm.xyz | bash
export PATH="$PATH:$HOME/.foundry/bin"
foundryup
cd contracts && forge build && forge test
```

**Before every work session:**
```bash
git pull --rebase && git submodule update --init --recursive && npm install
```

If two machines are active at once: pull before each task, make small commits, push often, and only **append** to CLAUDE.md §9 (progress log) rather than rewriting other sections.

---

## 13. First prompt for Claude Code on the new PC

```
Read HANDOFF.md (in docs/ or the repo root) and then CLAUDE.md fully. CLAUDE.md is the live source of truth.

Rules:
- PRIORITY: never add Co-Authored-By or any AI attribution to commits/PRs. Confirm .claude/settings.json has attribution off.
- Never commit .env or print private keys. Never regenerate wallets.
- Ask before any public testnet deploy, system-level install, or destructive command.
- Foundry runs only in Git Bash on Windows.
- Small commits, push after each milestone, update CLAUDE.md (progress log §9, status §5, gates §6) after each.
- Log every rough edge with Whitechain / Arkiv / World in docs/friction-log.md as it happens.

Step 1: verify this machine: npm install, forge build, forge test (expect 39 tests + invariants passing), both Next apps build. Report versions.
Step 2: check which keys in .env are filled. For each that is filled, run its smoke test now (C Arkiv: npm run smoke:arkiv; D World: /dev/world with simulator.worldcoin.org; E Supabase: npm run smoke:db) and log results.
Step 3: make the three pre-deploy fixes in HANDOFF.md §10 with tests, rerun the full suite.
Step 4: if DATABASE_URL is set, replace the JSON file store with Supabase Postgres (same shapes as 0001_init.sql).
Then stop and report: done, gate status, what you need from me. Do not deploy to testnet until I say go.
```

---

## 14. Q&A answers to rehearse

| Question | Answer |
|---|---|
| Why not Razorpay? | Razorpay can hold and reverse money; that's a company's promise. Our deadline refund can't be overridden by anyone, including us, and reputation isn't locked in our database. |
| Isn't this just escrow? | Escrow is one piece. What's new: release by the buyer's doorstep code (no delivery oracle), signed terms the seller can't change, one-human-per-seller reviews we can't edit, and a checkout that lives inside Instagram DMs and other sites. |
| How do you know it was delivered? | The buyer handed over their code at the door, like handing over cash in COD. Without it, the courier can only escalate to a dispute. |
| Fake or broken item? | Today our arbiter decides. That's the centralised part, and we say so. If the arbiter doesn't act in time, the buyer is refunded. |
| Can sellers farm reviews? | Only by paying real shipping each time, finding a different human each time, and each counts once per seller. Much more expensive, not impossible. |
| What if PoP disappears? | Funds stay in the contract; `finalize` and `withdraw` are public; reviews stay on Arkiv, owned by buyers. |
| Remove a sponsor, what breaks? | World: one person could review many times with many wallets. Arkiv: reputation becomes our private database. Whitechain: the refund becomes our promise instead of code. |
| Who holds USDT in India? | Nobody in this demo; it's testnet. Production needs a licensed rupee on-ramp; the honest first market is diaspora buyers paying Indian sellers, where COD doesn't exist. |
