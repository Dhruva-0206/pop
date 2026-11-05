# Prompt 01: Phase 0 + Phase 1 (given to Claude Code, Thu 5 Nov 2026 ~23:45 IST)

Verbatim prompt from the team to the coding agent.

---

You are the lead engineer for our ETHGlobal Mumbai 2026 hackathon project. Read this whole prompt before doing anything.

# 0. Situation (read carefully)
- Event: ETHGlobal Mumbai 2026, "Building from Scratch" track. Hacking began Thu 5 Nov 2026, 9:00 PM IST. HARD deadline Sat 7 Nov 2026, 9:00 AM IST. Our target is to submit by 7:00 AM Sat. It is now ~11:45 PM Thu. Time matters more than polish.
- Machine: Windows, PowerShell, VS Code. Working directory: C:\Users\shant\OneDrive\Desktop\ETH
  - ./context/  = all planning documents (read-only source of truth, described below)
  - ./pop/      = our git repo, already cloned from https://github.com/Dhruva-0206/pop (remote "origin", branch main). ALL project work happens inside ./pop.
  - ./package.json and ./node_modules at the ETH root are leftovers. Do NOT modify, delete or install anything at the ETH root.
  - This folder is inside OneDrive. If you hit EPERM/EBUSY/file-lock errors during npm installs, tell me so I can pause OneDrive sync. Don't work around it by moving folders.
- Product name: PoP: Proof of Purchase. Put the name in ONE place (packages/shared config constant plus the EIP-712 domain name) so it can be changed with a single edit before the first testnet deploy. Use "PoP" consistently everywhere.

# 1. Read the context first
Read EVERY file in ./context before writing code. Expected files (there may be more; read them all):
- ETHGlobal_Mumbai_2026_Context.md: event rules, schedule, every sponsor prize and its requirements
- ETHGlobal_Mumbai_2026_Rules_Guidelines_Bharaso.md: official rules vs recommendations
- Bharosa_Build_Spec_v3.md: product decisions, contract design, Q&A answers (written before the rename; "Bharosa" = PoP)
- PoP_Technical_Architecture.md: routes, contracts, data placement, env vars, sequence flows
- Bharaso_ETHGlobal_Mumbai_Winning_Plan.md: OLDER plan, superseded; read for context only
- Bharosa_Build_Plan_v4 (if present): final schedule, scope cuts, submission tags

When documents disagree, follow this order:
1. ETHGlobal rules and sponsor prize text
2. The Build Plan v4 decisions repeated in this prompt
3. PoP_Technical_Architecture.md
4. Bharosa_Build_Spec_v3.md
5. Winning Plan (ignore where it conflicts)

# 2. What we are building (summary; details are in the context files)
A protected checkout for Indian Instagram/WhatsApp sellers and small websites.
- A seller gets a payment link/QR (social) or a "Pay with PoP" button (website, ~20-line integration).
- The buyer pays the SPECIFIED Whitechain test USDT (0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7) into our contract on Whitechain Sepolia (chain ID 1874).
- Funds are released only when the buyer's own 6-word BIP-39 delivery code is submitted at the doorstep. The contract checks keccak256(abi.encodePacked(block.chainid, address(this), code)) == codeHash.
- Missed ship-by or deliver-by deadline => anyone can call finalize => full automatic refund.
- The courier role can ONLY move Shipped -> Disputed ("handover refused"). It can never move money.
- An arbiter role resolves disputes (refund / release / split) and can ban sellers. Lost disputes and bans are permanent counters in the contract.
- After a Released order, World IDKit gates publishing a review: one review per unique human PER SELLER. The server verifies the proof, checks the order on-chain, and enforces uniqueness with a Postgres UNIQUE(nullifier_hash, seller) constraint.
- Reviews are written to Arkiv (Rabdi testnet, chain ID 7794095) as readonly entities created by our attestor wallet, then ownership is transferred to the buyer. Only keccak(nullifier, seller) is public, never the raw nullifier.
- A separate demo store app ("Kurta Co.") reads seller reputation directly from Arkiv with its OWN access key, and uses the checkout integration.
- Private data (buyer address encrypted with AES-256-GCM, nullifiers, listings, sessions) lives in Supabase Postgres. NEVER put buyer personal data on any chain or on Arkiv.

The three sentences every design choice must protect:
1. "If it doesn't arrive, you get your money back automatically. Nobody can stop that refund, including us."
2. "The money is released by the buyer's code at the door; our courier key can't release a single rupee."
3. "Reputation is earned only from protected deliveries, counts each human once per seller, and lives on Arkiv where any app can read it."

Partner prizes we are entering (max 3): Whitechain (Operate: Stablecoin Payments for Business), Arkiv (Build on Arkiv, from scratch), World (Best Use of IDKit). Do not add other sponsors.

# 3. Tech stack (LOCKED; matches what we will tick on the submission form)
Submission-form tags we will select, so the code must genuinely use them:
- Blockchain networks: EVM, Optimism (Whitechain Sepolia is an OP Stack L2 presented with Optimism). Do NOT deploy to or claim Worldchain, Ethereum mainnet, Arc or Base.
- Ethereum developer tools: Foundry; OpenZeppelin SDK (we use OpenZeppelin Contracts). Hardhat ONLY if Foundry fails, in which case tell me so the tag changes. Do NOT use Scaffold-ETH, ethers.js, web3.js, Privy, Self, Anon Aadhaar, Semaphore or The Graph.
- Web frameworks: Next.js, React.js
- Databases: PostgreSQL, Supabase

Also used, but not in any dropdown (describe them in the README):
- viem + wagmi
- @arkiv-network/sdk 1.0.x, server-side only
- World IDKit + server verification
- Tailwind
- qrcode, html5-qrcode, @scure/bip39
- zod
- Vitest
- Vercel (two projects)

Keep docs/submission-tags.md up to date with exactly what is actually used, and a one-line justification per tag.

Verify current package names, versions and APIs from official docs before using them. Do not rely on memory for anything released in 2026: World IDKit (check docs.world.org/world-id/idkit; it may be a newer major version), the Arkiv SDK (use github.com/Arkiv-Network/skills and docs.arkiv.network), the Whitechain RPC URL and explorer verifier (docs.whitechain.io), and forge CLI flags (e.g. check `forge install --help`). If a doc can't be reached, say so and mark the item UNVERIFIED in CLAUDE.md. Never invent URLs, addresses or API names.

# 4. Hard rules
- ETHGlobal From Scratch rule: all project code is written now. Make small, real, frequent commits with meaningful messages (scaffold, contracts skeleton, tests, ...). Never squash into one giant commit and never fake history. Push to origin main after each milestone.
- Secrets: create .gitignore (with .env, .env.local, .env*.local, node_modules, out/, cache/, broadcast/ for local chains, .next/) BEFORE the first commit that contains anything else. Commit only .env.example with empty values. Never print a private key in chat or logs. Never commit keys.
- Wallets: generate throwaway testnet wallets (deployer, attestor, courier, faucet, arbiter, demo merchant) with `cast wallet new` or viem. Write the private keys only to pop/.env (gitignored). Show me only the ADDRESSES, so I can fund them.
- Ask me before any system-level install (WSL, Foundry outside the repo, global npm packages), anything destructive, any deploy to a public testnet, or anything that costs money.
- If something blocks for more than 20 minutes, stop, log it in CLAUDE.md, and tell me the fallback. Do not silently switch tools or sponsors.
- AI use must be disclosed: keep AI_USAGE.md updated (tool, purpose, files, what humans reviewed).

# 5. CLAUDE.md (create it first and maintain it the whole time)
Create pop/CLAUDE.md as the single source of project memory. Every future session reads it first. Sections:
1. Project summary (5 lines) and the three judge sentences
2. Locked decisions: name, stack, review rule (one per human per seller), handle proof = staff-checked bio code (tier 1) first and Reclaim only later, no Scaffold-ETH, Supabase
3. Repo map (what lives where)
4. Environment and commands (how to install, run, test, deploy on Windows PowerShell)
5. Status checklist: MUST / SHOULD / STRETCH items from Spec v3 §14, each with ☐ / ◐ / ☑
6. Go/no-go gates (below), with status and timestamp
7. Deployed addresses, tx hashes, Arkiv entity keys, wallet ADDRESSES (never keys)
8. Blockers and decisions log
9. Progress log: timestamped (IST) entries, newest first, one line per meaningful step
10. "Next 3 actions"
11. User action items (things only I can do), kept current

Update CLAUDE.md after every milestone, and commit it together with the work it describes. Also create and maintain:
- docs/friction-log.md: every rough edge with Whitechain, Arkiv or World docs and SDKs (expected vs actual, repro steps). This later becomes WHITECHAIN_FEEDBACK.md, arkiv/friction.md and docs/WORLD_DEBRIEF.md, so log it as it happens.
- docs/evidence.md: tx links, contract addresses, entity keys, runnable queries
- AI_USAGE.md

# 6. Gates (track in CLAUDE.md)
| Gate | Deadline (IST) | If it fails |
|---|---|---|
| 1. Specified test USDT readable on 1874 (symbol, decimals) and a funded wallet holds some | Fri 01:00 | |
| 2. Foundry working | Thu 00:45 | Hardhat 3, same test list |
| 3. Arkiv create + query + changeOwnership work | Fri 03:00 | |
| 4. World review action verified server-side with the simulator | Fri 03:00 | |
| 5. Whitechain mentor confirms a protected merchant checkout counts as Operate | Fri 10:00 | I do this |
| 6. Explorer contract verification method known | Fri 10:00 | |
| 7. Organizers OK with planning docs in specs/ | Fri 12:00 | I do this |

# 7. YOUR TASK NOW: Phase 0 (setup) and Phase 1 (smoke tests). Do NOT start the main feature build.

## Phase 0: setup (target: done by ~00:45)
1. Check tools and report versions: git, node (Next.js needs a current LTS; if node is 26 and something breaks, tell me and suggest Node 22 LTS), npm, forge/cast/anvil. If Foundry is missing, tell me the options in order: (a) native Windows install if the current docs support it, (b) WSL2 if it's already installed (check `wsl -l -v`), (c) Hardhat 3 fallback. Wait for my choice before installing.
2. In ./pop: create .gitignore first and commit. Then add LICENSE (MIT, "PoP contributors"), README.md skeleton, CLAUDE.md, AI_USAGE.md and .env.example (all variables from PoP_Technical_Architecture.md §12, empty). Commit.
3. Copy every file from ../context into pop/specs/ unchanged, for AI and spec disclosure. Commit with the message "docs: add pre-build planning specs (disclosed per ETHGlobal AI rules)".
4. Create the structure:
   pop/
     contracts/          Foundry project: src/, test/, script/; OpenZeppelin contracts installed
     apps/web/           Next.js (App Router, TypeScript, Tailwind, ESLint, src/ dir); frontend + API routes
     apps/demo-store/    Next.js app "Kurta Co." (minimal scaffold only)
     packages/shared/    config constant (APP_NAME), chain definitions (viem defineChain for Whitechain Sepolia 1874 and Arkiv Rabdi 7794095), EIP-712 Offer types, ABIs later
     scripts/            node/ts scripts (smoke tests, seed, wallet setup)
     arkiv/              placeholders: schema.md, friction.md, reach.md, why-arkiv.md, how-you-use-arkiv.md
     docs/               evidence.md, friction-log.md, submission-tags.md, WORLD_DEBRIEF.md (stub), limitations.md (stub)
     supabase/           migrations/0001_init.sql (tables from PoP_Technical_Architecture.md §9)
     specs/
   Use npm workspaces (apps/*, packages/*). If workspaces cost more than 20 minutes, flatten instead (shared code in apps/web/src/lib, copied into the demo store) and log the decision.
5. Generate the testnet wallets (§4 rules). Print a table of role -> address for me to fund.
6. Get the Whitechain RPC URL and explorer verification method from docs.whitechain.io. Put the RPC URL in .env.example as a comment.
7. Run `npm run build` (or equivalent) for both Next apps and `forge build` for contracts. Everything must compile. Commit and push.

## Phase 1: sponsor smoke tests (the riskiest integrations, done before any UI work)
Write each as a small script in scripts/ (TypeScript, run with tsx). Log the result in CLAUDE.md and docs/evidence.md.
A. Whitechain read: connect to chain 1874 and read the specified USDT's name, symbol and decimals, plus the balances of our wallets. Record the decimals; NEVER assume 6.
B. Contract skeleton (local only, on anvil): PoPCheckout with Offer (EIP-712), pay, markShipped, confirmDelivery, confirmReceived, finalize (both refund paths and release), withdraw, reportHandoverRefused, openDispute, resolveDispute; plus SellerRegistry (register with attestor signature, ban). Follow Spec v3 §6 and Architecture §5.3 exactly: events, state machine, pull payments, SafeERC20, ReentrancyGuard, AccessControl, and a token address that is immutable in the constructor. Use a mock ERC20 ONLY in local tests. Write Foundry unit tests for the happy path plus: wrong code, late ship refund, late delivery refund, courier cannot release, non-arbiter cannot resolve, tampered offer price, double withdraw. Report the test count. DO NOT deploy to Whitechain yet; ask me first.
C. Arkiv: using @arkiv-network/sdk on Rabdi with the attestor wallet, create one readonly test entity under schema "pop_review_v1" (fields per Architecture §6.2), query it filtered by creator, then changeOwnership to a second wallet and read it back showing $creator vs $owner. Needs a funded attestor and an access key (user actions).
D. World: a Next.js API route in apps/web that verifies an IDKit proof server-side for action "review" with signal = keccak(orderId, buyerAddress), plus a bare test page with the IDKit widget. Test it with simulator.worldcoin.org. Needs the World app ID (user action).
E. Supabase: apply migrations/0001_init.sql and prove one insert and one unique-constraint violation on review_nullifiers. Needs the DATABASE_URL (user action).

If A–E are blocked by a user action, prepare everything up to that point, list exactly what you need from me, and continue with the next item. Never wait idle.

## When Phase 0 + 1 are done (or blocked), STOP and report:
- What's done, with commit hashes
- Gate status table
- Wallet addresses to fund and which faucet each one needs: Whitechain faucet (WBT + test USDT) for deployer/faucet/courier/arbiter; Arkiv hub faucet for the attestor
- The exact list of user actions:
  - Whitechain faucet
  - Arkiv access key + faucet
  - World Developer Portal app + "review" action (max verifications: unlimited if allowed)
  - Supabase project + DATABASE_URL
  - Vercel later
- Anything UNVERIFIED
- The proposed plan for Phase 2 (end-to-end ugly path), in this order: deploy + verify on 1874 → one real USDT pay → /p checkout with burner wallet → courier delivery code → finalize/withdraw → World review → Arkiv write+transfer → /verify page → demo store

Do not start Phase 2 until I say go.

# 8. Product rules to respect from the start
- Buyer-facing screens never use the words escrow, nullifier, chain ID or gas. Show rupees next to USDT ("₹899 · 1.00 test USDT"). Label the test wallet "TEST MODE" and the courier page "SIMULATED COURIER".
- Never claim "trustless", "impossible to fake" or "delivery verified on-chain". Limitations are listed honestly (see Spec v3 §18).
- The API never moves money on its own. It reads tx receipts and on-chain state before writing anything to Arkiv or the DB, and every chain-derived write is idempotent.
- Arkiv and World secrets stay server-side (never NEXT_PUBLIC_).

Start now with Phase 0, step 1. Keep your chat updates short: what you did, what's next, and what you need from me.
