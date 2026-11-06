# Overnight log

Autonomous run while the team slept. Rules followed: small commits pushed after each step, no AI trailers, no keys printed, no wallet regeneration, no contract redeploy, no Vercel deploy, no new testnet transactions beyond the ones listed in the plan. Times are IST, Fri 6 to Sat 7 Nov 2026.

## Step 0: safe state
- Interrupted testnet e2e: nothing left mid-flight. On 1874 orders #1 to #10 are all terminal (odd ids Released, even ids Refunded), `totalLocked` is 0, next order id is 11. The merchant rate limit is 30 per minute (a crashed run had left it at 1 earlier; I restored it and the e2e now restores it in a `finally`).
- Orders key: the store's orders are unique on (checkout address, order id) since `913153a` (in place upgrade drops the old index). Fork `e2e-merchant.ts` passed 48/48 on that commit.
- Testnet `public` schema is migrated (onboarding_requests, world_verifications, rate_limit_per_min present, existing rows kept).
- Testnet `e2e-merchant.ts` PASSED 47 checks with real time on orders #9 and #10, using the store's own Arkiv key. Two earlier attempts failed for test reasons (webhook receiver slower than 5 s on the real network, and a rate-limit probe that needed a fresh session), both fixed below.

## Step 1: World smoke D (prepared, needs one human click-through)
Done without a human, on the real staging host, no dev skip (`/api/config` shows `devSkipWorld:false`; a request with `skipWorld:true` is refused with 400):
- `POST /api/world/rp-signature` works for all three sellers: returns `app_id`, the per-seller action (`review-meera-jewels`, `review-kurta-co`, `review-demo-seller3`), `environment: staging` and a signed `rp_context` (rp_id, nonce, created_at, expires_at 300 s later, signature). An unknown seller gets 404 "reviews are not enabled for this seller yet".
- World's verify endpoint `POST https://developer.world.org/api/v4/verify/{rp_id}` is reachable and the app is migrated. A fake proof gets 400 `all_verifications_failed`, per item `verification_failed: execution reverted (unknown custom error)`. The answer is identical for an existing action and for `review-does-not-exist-xyz`, so a fake proof cannot tell us whether an action exists. The portal actions now exist, so "action not found" cannot be reproduced anyway.
- Our `/api/world/verify-review` refuses with a clear 400 and writes nothing for: no proof, wrong action, wrong signal, wrong environment, a fake proof (World's `all_verifications_failed`). The reviews table and nullifier claims are still empty.
- Widget config matches the 4.0 docs: controlled `IDKitRequestWidget`, `allow_legacy_proofs`, `proofOfHuman({ signal })`, `environment` from the server, signed `rp_context`. No code change was needed.
- Script: `scripts/world-probe.ts` (no transactions, no review written). Rerun with the web app up: `NETWORK_MODE=testnet npx tsx scripts/world-probe.ts`.
- Mistake caught on the way: sourcing `.env` overrides an earlier `export NETWORK_MODE=testnet` (the file says `fork`). Export AFTER sourcing.

### READY-TO-CLICK checklist (the one step that needs the Simulator)
Order #1 on 1874 is Released, belongs to @meera.jewels and to the test buyer wallet, and has no review yet.
1. Start the web app on testnet, no dev flag (Git Bash, from `pop/`): `(set -a; . ./.env; set +a; unset POP_DEV_SKIP_WORLD; export NETWORK_MODE=testnet; npm run dev:web)`
2. Open `http://localhost:3000/dev/world`. The buyer wallet must be the test buyer: in the browser console run `localStorage.setItem("pop:testwallet:testnet:1874:buyer", "<TEST_BUYER_PK from .env>")` and reload. Paste your own key and do not share it.
3. Leave the order id at 1. Pick a rating, type a short review, press the World ID button.
4. In the widget, open https://simulator.worldcoin.org (staging) and approve the request.
5. Success: "Verified. Publishing your review…", then "Thanks! Your review is published." `/verify/meera.jewels` lists the review as verified (not DEV). The `/proof` World log shows one `verified` row (action review-meera-jewels, 12-character id hint).
6. Denied path A, cancel: start again and close or reject in the simulator. Expect "World ID: user_rejected" or "cancelled. Nothing was published." No log row, no claim, order still reviewable.
7. Denied path B, second review: press the button again for order #1 and verify again. Expect 409 "this order already has a review". The person-level rule (same human, same seller, different order) needs a second Released order of @meera.jewels; only order #1 is meera's today, so that case is covered by the fork e2e and the unique constraint, not by this click-through.
8. Note anything odd under this heading; the debrief draft is `docs/WORLD_DEBRIEF.md`.

## Step 2: UI/UX redesign (done, committed 6472a48 and a follow-up for titles)
- Studied whitechain.io (screenshots and computed styles) and wrote `docs/design-tokens.md`: tokens as CSS variables and Tailwind theme values once, in `apps/web/src/app/globals.css` (the store has the same file with its own terracotta accent). The default Tailwind palette, radii and shadows are removed, so only tokens render. Contrast ratios are computed by `scripts/contrast.js`, not estimated.
- Wrote `docs/ux-rules.md`: one cited line per rule (NN/g heuristics, WCAG 2.2, Laws of UX, reading width), the blockchain-wait rules, and the AI-tells checklist from Wikipedia's "Signs of AI writing" and three design lists. The Baymard lines are marked unverified (I did not open a specific article).
- Rebuilt: layout shell (own wordmark, skip link, header, footer), landing, `/p/[listing]` (trust block above Pay, labelled fields with inline errors, 4-step payment progress), `/o/[order]` (status, mm:ss countdown, delivery code as a numbered 2 by 3 grid, Settle, auto-settle, report a problem, review, progress, details), `/verify/[handle]`, restyled `/dashboard`, `/courier`, `/arbiter`, `/onboard`, `/proof`, and the whole Kurta Co. store (its own identity). No contract call, API shape, auth or business logic changed.
- Rules applied: no emoji, no dashes as punctuation (swept source and docs), no all-caps labels, sentence case, light theme only (the old dark theme had unreadable text), skeletons instead of spinners, errors that say what happened, why and what to do.
- Verified: `e2e-fork.ts` PASS (65 checks) and `e2e-merchant.ts` PASS (48 checks) on a fresh fork after the redesign. Lighthouse accessibility 100 on all nine pages, best practices 96 to 100. At 375 px: no horizontal scroll, every input named, no touch target under 44 px. `/proof` used to scroll sideways at 375 px (768 px content); fixed. Before and after screenshots in `docs/screens/`.
- Only one e2e assertion changed: the store home heading test looks for "Our record" instead of "Our protected record" (copy rename).
- Real flow checked by eye: paid an order through the redesigned checkout on the fork, saw the progress list, then the order page with the countdown and the delivery code grid (`docs/screens/after/order-funded-with-code.png`).
- Not done or not checked: screen reader test by a person, real phones, Safari, the Delivered and Disputed order states by eye (their code paths are covered by e2e, the layout is shared), a sticky Pay button on mobile (the form is long; Pay is at the bottom).
- Judgment calls: the nav says "Sell with PoP" and "Proof" only; team tools are linked from the landing page footer section instead of the header.

## Step 3: paperwork drafts (committed 6196eab)
- `arkiv/`: schema, how-you-use, why-arkiv, friction and reach, all from real runs. I wrote `scripts/arkiv-query.ts` (read-only) and ran it with PoP's key and with the store's own key: both returned the same 8 entities (1 smoke entity, 7 DEV entries from fork tests), all with creator = attestor and readonly = true. Entity keys, owners and expiry blocks are in `arkiv/reach.md`. The schema file now says plainly that only `pop_review_v1` is implemented; `pop_seller_v1` and `pop_outcome_v1` are planned names, not code.
- `WHITECHAIN_FEEDBACK.md`: eth_getLogs 10,000-block limit, Blockscout license "none", deploy script hiding the verify result, webhook recheck latency (about 2 of 12 deliveries hit a 5 s timeout on testnet, fork answers in about 2 s), USDT acquisition, Foundry on Windows, proxy token storage. The "faucet amount differs from the docs" item is marked reported, not verified: I have no recorded amounts.
- `docs/limitations.md`, `docs/deployment.md` (per-project Vercel env list, server-only vs config, `POP_DEV_SKIP_WORLD` must never be set), `AI_USAGE.md` completed, `README.md` rewritten (problem, three promises and how each is enforced, architecture, contract and tx links, setup, prior art).
- Mismatches I fixed while writing: the old schema file implied three Arkiv schemas existed; the README did not say the deployer holds an admin role that can grant and revoke roles (now in README and limitations); the README claimed Vercel as a tool while it is not configured.
- Unverified on purpose: the Baymard lines in `docs/ux-rules.md`, the faucet amount, block time (estimated), the problem statement in the README (our reading, not a statistic).

## Step 4: demo readiness (committed with this section)
- `scripts/seed-demo.ts`: five scenes (order near ship-by expiry, Delivered with the window open, Disputed, banned seller with an open order, look-alike unregistered seller). Idempotent: a second run skipped every scene (verified on the fork). Testnet needs `ALLOW_DEMO_SEED=yes` and sends about 15 test transactions plus 0.02 WBT to a derived demo-seller wallet. **I did not run it on testnet.** The scenes use short real windows, so run it 3 to 5 minutes before the segment.
- Verified on the fork through the app: `/verify/bad.bazaar` is the red banned page, `/verify/meera.jewels.official` is the red unknown page, the fake listing's seller standing is inactive (Pay disabled), the arbiter list shows the Disputed order, and the banned seller has one open order to force-refund.
- `docs/demo-script.md`: 4-minute live flow and the 2 to 4 minute video flow with exact clicks, failure cases and fallbacks. Not rehearsed by a human.

## Step 5: final verification (fresh local fork, after all changes)
| Check | Result |
|---|---|
| `forge test` | 58 passed, 0 failed (invariant suite 64 runs x 32, 6 invariants) |
| `scripts/e2e-fork.ts` | PASS, 65 checks |
| `scripts/e2e-merchant.ts` | PASS, 48 checks |
| `next build` with `VERCEL=1` and an empty environment, both apps | compiled, no errors |
| eslint | 0 errors; 2 warnings in `apps/web` (an `<img>` for the QR code and the badge, both intentional) |
| tsc (web, store, scripts) | clean |
| Banned classes, dashes, emoji in UI source and docs | none found |
| Lighthouse accessibility, nine pages | 100 each (best practices 96 to 100; the 96s are the expected 401s on the team tools when signed out) |
| 375 px render audit | no horizontal scroll, every input named, no touch target under 44 px |

Testnet activity tonight: none. After you handed over the plan I sent no transaction to 1874, wrote nothing to Arkiv and changed nothing in the `public` database schema. The only network calls were reads (the World verify host with fake proofs, Arkiv queries, the Blockscout and RPC reads). All local servers and the fork are stopped.

## What failed or was skipped
- Nothing failed twice. Tooling notes for the friction log: the browser tool cannot resize its viewport (so 375 px views use an iframe of exact width), and pages in the Next dev server do not hydrate inside that browser tab (production builds do). Both are about my tooling, not the apps.
- Skipped on purpose: the real World proof (needs a human), the testnet run of `seed-demo.ts` (the plan said do not run it yet), anything on Vercel, any contract change.
- Not verified: real phones, Safari, screen readers with a person, the unattended-written Baymard lines in `docs/ux-rules.md`, the faucet amount in `WHITECHAIN_FEEDBACK.md`, `/onboard` and `/arbiter` buttons clicked by a human, the timings in `docs/demo-script.md`.

## What I need from you when you wake (in this order)
1. **World smoke D click-through** (5 minutes): the READY-TO-CLICK checklist under Step 1 above. It is the only gate-4 step left.
2. **Read this file and the commits** (`git log --oneline`, 7 commits since `677803f`). Anything you disagree with in the redesign is easy to change in one place: the tokens in `apps/web/src/app/globals.css` (and the store's copy).
3. **Decide**: gate 5 mentor answer; go or no-go for the two Vercel projects (`docs/deployment.md`); whether to run `seed-demo.ts` on testnet (about 15 test transactions, 0.02 WBT, run it 3 to 5 minutes before each demo segment).
4. **Things you may not expect**: the whole UI is now light only (the old dark theme had unreadable text); the nav only shows "Sell with PoP" and "Proof" and the team tools moved to the landing page footer section; page titles are now sentence case; the Kurta store has its own terracotta accent, deliberately different from PoP's green; the README now says the deployer wallet holds an admin role that can grant and revoke roles.
