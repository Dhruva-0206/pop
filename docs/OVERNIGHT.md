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
