# AI usage disclosure

ETHGlobal allows AI-assisted development if it is disclosed. This file lists every AI tool, what it did, which files it touched, and what humans reviewed.

## Planning (before code; written after hacking began at 9 PM Thu)
The planning documents in `specs/` were written with AI assistance and are included unchanged, as the spec-driven rule requires:
- `specs/Bharosa_Build_Spec_v3.md`, `specs/PoP_Technical_Architecture.md`, `specs/Bharaso_ETHGlobal_Mumbai_Winning_Plan.md`, `specs/ETHGlobal_Mumbai_2026_Context.md`, `specs/ETHGlobal_Mumbai_2026_Rules_Guidelines_Bharaso.md`
- Organizer confirmation that these may be included: _pending (gate 7)_.

## Build log
| When (IST) | Tool | Purpose | Files | Human review |
|---|---|---|---|---|
| Thu 5 Nov 23:45 → | Claude Code (Claude Opus 5.5) | Lead-engineer agent following the team's written prompt: repo setup, Foundry install, docs lookup, scaffolding | `.gitignore`, `README.md`, `CLAUDE.md`, `AI_USAGE.md`, `.env.example` | Team chose the tool options (Foundry via Git Bash, kept LICENSE); reviews each commit |
| Thu 23:50 | Claude Code (web-fetch sub-agents) | Read current docs for Whitechain, Arkiv SDK 1.0.x (official skills repo), World IDKit 4.x; findings logged in CLAUDE.md and docs/friction-log.md | (research only) | Team reviews the logged decisions |
| Fri 00:00 | Claude Code | Scaffold: npm workspaces, Foundry + OZ, two Next apps (create-next-app), shared package, Supabase migration, doc stubs | `package.json`, `packages/shared/*`, `apps/*` (generated boilerplate), `supabase/migrations/0001_init.sql`, `docs/*`, `arkiv/*` | Team to review the SQL schema and shared EIP-712 types |
| Fri 00:05 | Claude Code | Wallet generator (keys written only to .env, never shown) and Whitechain read smoke test | `scripts/gen-wallets.ts`, `scripts/env.ts`, `scripts/smoke-whitechain.ts` | Team funds the printed addresses |
| Fri 00:08 | Claude Code | Contracts drafted from the team's spec (Spec v3 §6, Architecture §5.3) and 34 Foundry tests | `contracts/src/*`, `contracts/test/*`, `contracts/script/Deploy.s.sol` | **Must be reviewed by the team before any testnet deploy** (state machine, courier limit, withdrawFor) |
| Fri 01:00 | Claude Code | Arbiter-timeout refund + stateful invariant suite (team decision: 300 s demo / 14 days prod) | `contracts/src/PoPCheckout.sol`, `contracts/test/ArbiterTimeout.t.sol`, `contracts/test/invariant/*` | Team specified the rule; review before testnet deploy |
| Fri 01:05 | Claude Code | World ID 4.0 docs check → one review action per seller | `packages/shared/src/config.ts`, `apps/web/src/lib/server/world.ts`, `docs/WORLD_DEBRIEF.md` | Team creates the portal actions |
| Fri 01:20 | Claude Code | Network mode (local fork vs testnet), fork funding, deploy + seed scripts | `packages/shared/src/network.ts`, `scripts/fork*.ts`, `scripts/deploy.ts`, `scripts/seed-seller.ts` | Team approved fork-first; testnet deploy waits for GO |
| Fri 01:45 | Claude Code | Phase 2 pages + API: checkout, order, dashboard, simulated courier, settle button; fork e2e script | `apps/web/src/app/**`, `apps/web/src/lib/**`, `packages/shared/src/server/*`, `scripts/e2e-fork.ts` | Team to click through on a laptop + phone |
| Fri 00:20 | Claude Code | Arkiv, Supabase and World smoke-test code | `scripts/smoke-arkiv.ts`, `scripts/smoke-db.ts`, `apps/web/src/lib/server/world.ts`, `apps/web/src/app/api/world/*`, `apps/web/src/app/dev/world/*` | Pending live runs with team-provided keys |
| Fri 6 Nov (2nd machine) | Claude Code | App security fixes (buyer-signed order registration, login nonce, faucet guards, World review gating), doc drift, Foundry install, contract fixes (`forceRefundBanned`, self-purchase check) with 16 tests, fork e2e | `apps/web/src/app/api/**`, `apps/web/src/lib/**`, `packages/shared/src/server/store.ts`, `contracts/src/PoPCheckout.sol`, `contracts/test/*`, `scripts/e2e-fork.ts`, docs | **Team must review the two contract changes before any testnet deploy** |
| Fri 6 Nov (2nd machine) | Claude Code | `forceRefundBanned` narrowed per team decision; review pipeline (rating/text, buyer-signed, Arkiv readonly entity + transfer, retry), DEV skip-World flag, `/verify/[handle]`, extended fork e2e | `contracts/src/PoPCheckout.sol`, `contracts/test/*`, `packages/shared/src/server/{arkiv,store}.ts`, `apps/web/src/app/{api/world,api/reviews,api/verify,verify}/**`, `apps/web/src/components/ReviewBox.tsx`, `scripts/e2e-fork.ts` | Team to review the DEV flag guard and the attestor key now living in the web server env |
| Fri 6 Nov (2nd machine) | Claude Code | Replaced the JSON file store with Supabase Postgres (async store, schema per network mode, atomic review claim), aligned/upgraded `0001_init.sql`, db scripts, buyer-history bucket, `@arkiv-network/sdk` dependency, fixed the Arkiv order-id collision found by the e2e | `packages/shared/src/server/{store,arkiv}.ts`, `supabase/migrations/0001_init.sql`, `scripts/db*.ts`, `apps/web/src/app/api/**`, `apps/web/package.json`, `package-lock.json` | Team to review the SQL and the SSL setting (`rejectUnauthorized: false`) |
| Fri 6 Nov (testnet) | Claude Code (Sonnet 5.5) | Testnet deploy after the team's GO (dry run first, one broadcast), Blockscout verification check, role and config read-back, one real test-USDT order walked end to end (#1) and one late-ship refund (#2) | `scripts/testnet-order.ts`, `scripts/testnet-refund.ts`, `docs/evidence.md`, `CLAUDE.md`, `HANDOFF.md` | Team approved the addresses and settings in the dry run and said go; the agent did not retry or redeploy |
| Fri 6 Nov | Claude Code | Contract hardening tests: invariant that `forceRefundBanned` never hits a healthy seller, exact accounting delta test; mutation checks (remove a check, see a test fail) | `contracts/test/**` | Team reviewed the mutation results |
| Fri 6 Nov | Claude Code | "Pay with PoP": `packages/checkout-sdk`, merchant API keys and sessions, HMAC webhooks with on-chain recheck, per-merchant rate limit, Kurta Co. store with its own Arkiv key and Postgres order book, seller CSV export, chunked event reads | `packages/checkout-sdk/**`, `apps/demo-store/**`, `apps/web/src/app/api/v1/**`, `apps/web/src/lib/server/{merchants,webhooks,offers}.ts`, `scripts/e2e-merchant.ts`, `scripts/seed-merchant.ts` | Team read the design decisions in `CLAUDE.md` section 8; the e2e scripts are the test |
| Fri 6 Nov | Claude Code | `/onboard`, `/proof`, arbiter page, buyer "report a problem", seller badge, World verification log, buyer dispute reason hash check | `apps/web/src/app/{onboard,proof,arbiter}/**`, `apps/web/src/components/DisputeBox.tsx`, `apps/web/src/app/api/{onboard,staff,arbiter,badge}/**` | Not yet reviewed line by line by a human |
| Sat 7 Nov (overnight, unattended) | Claude Code | World smoke D preparation (probe script, checklist), UI/UX redesign of both apps on one token set, UX and AI-tells checklist, accessibility audit, paperwork drafts (Arkiv files, Whitechain feedback, limitations, deployment, README), demo seeding script and demo script | `apps/*/src/**` (visual layer), `docs/*`, `arkiv/*`, `README.md`, `WHITECHAIN_FEEDBACK.md`, `scripts/{world-probe,arkiv-query,a11y-audit,contrast,seed-demo}.*` | Pending: the team reads `docs/OVERNIGHT.md` after waking. Facts in the drafts come from logs and runs in this repository; anything unverified is marked |

## What the AI did not do
- It did not choose the product, the prize targets or the contract rules. Those are in the team's specs and in the decisions logged in `CLAUDE.md` section 8, each with who decided.
- It did not hold or print private keys. Keys live in `.env`; scripts read them by name and print addresses only.
- It did not deploy to Vercel, redeploy the contracts, or regenerate wallets. It deployed to the testnet once, after an explicit go.
- It did not run a real World ID proof. That needs a person with the Simulator (checklist in `docs/OVERNIGHT.md`).

## How the work was tested
- `forge test`: 58 tests (unit, fuzz, and an invariant suite with 6 invariants, 64 runs of 32 calls). Mutation checks: removing the self-purchase check or the banned-seller check makes tests fail.
- `scripts/e2e-fork.ts` (65 checks) and `scripts/e2e-merchant.ts` (48 checks on a local fork, 47 on the real testnet with real time) drive the apps through their HTTP API and the contracts, including the refusal cases (bad signatures, replayed or altered webhooks, wrong amounts).
- Accessibility: Lighthouse (axe-core rules) 100 on nine pages; a rendered-DOM check at 375 px for overflow, input names and touch targets (`docs/screens/README.md`).
- Every claim in `docs/evidence.md` has a transaction or a query behind it. Where we could not run something (a real World proof, a screen reader), the docs say so.

The prompt given to the agent is saved in `specs/prompts/`.

## Rules we follow
- Humans make the product and sponsor decisions; the agent proposes and implements.
- Every contract change gets tests; the team reviews the contract before any testnet deploy.
- No secrets are shown to or logged by the AI tool; private keys live only in the local `.env`.
