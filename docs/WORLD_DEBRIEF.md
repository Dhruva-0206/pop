# World IDKit integration debrief

## Trust moment and credential
- **Protected action:** publishing a review after a PoP order is Released on-chain. Not login, not buying, not withdrawing: World never blocks money or refunds.
- **Credential:** `proofOfHuman` (IDKit 4.x preset), with `allow_legacy_proofs: true`. Reviewing only needs "a unique human who hasn't reviewed this seller". **Why it is the minimum sufficient credential:** the review rule needs exactly one fact, that this is a unique person who has not reviewed this seller before. It needs nothing about who they are, how old they are or where they live. Passport and Selfie credentials add assurance about identity that this rule does not use, and asking for them would leave out buyers who do not have them.
- **Signal:** `keccak256(abi.encodePacked(orderId, buyerAddress))`, so a proof can't be replayed for another order or wallet. The server recomputes it and compares with `hashSignal(signal)` against every `responses[].signal_hash`.

## Key finding: per-seller uniqueness needs one action per seller (Fri 6 Nov ~01:05 IST)
- Our rule is **one review per human per seller**. The original plan was one portal action `review` with unlimited verifications plus a DB constraint on (nullifier, seller).
- World ID 4.0 docs: "World ID 4.0 uniqueness proofs are one-time per action for each user. Use separate actions for separate one-time operations" (docs.world.org/world-id/SKILL.md); "In 4.0, nullifiers are one-time-use" (4-0-migration.md). The nullifier is fixed per (user, app, action), so with a single `review` action a human could review only once across ALL sellers.
- Can the RP use arbitrary action strings like `review-<seller>` without creating them? **Not documented.** SKILL.md's troubleshooting says "action not found" means the action "wasn't created in the environment IDKit is pointing at". So we pre-create one action per seller.
- **Design now:** `WORLD_REVIEW_ACTIONS` map (packages/shared) seller handle → action: `meera.jewels → review-meera-jewels`, `kurta.co → review-kurta-co`, `demo.seller3 → review-demo-seller3`. Sellers without an action can't receive reviews (no fallback to a shared action). Postgres `UNIQUE(nullifier_hash, seller_wallet)` stays as defence in depth; Arkiv gets only `keccak(nullifier, seller)`.
- Because each seller has its own action, nullifiers differ across sellers, so nobody can link one human's reviews across sellers, even with our DB.
- **Scaling limit (honest):** one portal action per seller doesn't scale to thousands of sellers by hand. The docs list a create-action API (`POST /api/v2/create-action/{app_id}`) and an MCP tool `create_world_id_action`, but don't say whether they apply to 4.0 RPs. Top improvement request: documented dynamic/scoped actions (e.g. action prefix + suffix) for marketplaces.

## How it went
- Thu 23:55: read 4.x docs; found the v1, v3 → 4.0 breaking changes (RP signature, `IDKitRequestWidget`, v4 verify).
- Fri 00:28: server routes + dev page built against `@worldcoin/idkit` 4.6.0.
- Fri 01:05: switched to one action per seller (above).
- Fri 03:55 IST: World app created in the Developer Portal.
- Fri 03:57 IST: relying party registered (rp_id and signing key).
- Fri 09:21 IST: the per-seller actions created by hand in the portal.
- Fri 14:16 IST (08:46 UTC): scripted probes against the verify host (four rejected rows, by design).
- Fri 16:43 IST: the first accepted proof, @meera.jewels order #1, with the Simulator on a laptop (below).
- Fri 19:04 and 19:05 IST: the same person tried to review @meera.jewels again on order #17; refused both times, nothing written (log ids 6 and 7).
- Fri 19:12 IST (log row 19:11:55): first accepted proof on the deployed site, @kurta.co order #18, with its own action (log id 8, hint `595fe89d6634`).
- **Time to a working proof.** World asks for this in the debrief, so here it is from the log on `/proof` (UTC). Our first request to World's verify host was at 08:46:03 (14:16 IST) and the first accepted proof at 11:13:05 (16:43 IST), about two and a half hours later. The four rows at 08:46 UTC are scripted probes (`scripts/world-probe.ts`: wrong action, signal mismatch, wrong environment, fake proof), rejected on purpose. The log does not record when the person opened the Simulator, so we have not measured the human step. Counted from reading the docs on Thursday night (23:55 IST) to the first accepted proof on Friday afternoon, most of the time went on waiting for the portal app, the rp_id, the signing key and the actions to exist.

## Friction
Things that cost us time, in the order they bit:
- **The portal action form has only an identifier and a description.** There is no field for the per-seller scoping we needed, so one action per seller was created by hand, which took until 09:21 IST for the first three.
- **The dev server reloaded in a loop** on `/dev/world`. A production build (`npm run build`, `npm run start`) was the workaround. We suspect the file watcher, with the repo under Desktop (possibly OneDrive sync). Not proven.
- **The Simulator offers Human, Passport, ID and Device.** Our preset is `proofOfHuman`, and the Simulator showed Unique Human with World ID 4.0 selected for the successful runs. The other options sit in the same picker; we did not test them.
- **The widget hides the server's reason.** When our server refuses a proof, `handleVerify` throws; the widget shows its own "Verification declined" and calls `onError("failed_by_host_app")` with no message. We had to keep our own reason on the page (`ReviewBox`, commit 89fb3db) to tell the person what really happened (for example "You have already reviewed this seller").
- **A phone shows only the real World App.** On a phone the widget asks for the real World App, so a staging proof cannot be completed on a phone with the Simulator. We reviewed on a laptop. The phone order (#19) was paid and settled but not reviewed.

Also see `docs/friction-log.md` [World] entries: v4 breaking changes with v1, v3 tutorials still common; signal check helper (`hashSignal`) not in the docs; "max verifications" undocumented for 4.0; whether `nullifier_replayed` is raised by World or only by the app is unclear; npm page blocked automated fetches (403).

## Most impactful improvement
Let an RP create and name actions through a documented API, or accept a counterparty-scoped action string, so a marketplace can scope uniqueness per seller without hand-creating one portal action per seller. Second: return a distinct code for an unknown action (today a fake proof gets the same `verification_failed` whether the action exists or not).

## What we checked before the first real proof (staging)
- rp-signature works: 300 s validity, one action per seller.
- Verify host `developer.world.org/api/v4/verify/{rp_id}` answers and the app is migrated. Fake proof: 400 `all_verifications_failed`, item code `verification_failed`, detail "execution reverted (unknown custom error)". Same answer for an existing and a non-existent action, so action existence is not observable without a real proof.
- Our route refuses wrong action, wrong signal hash, wrong environment, fake proof and no proof with a readable 400 and stores nothing.
- Docs checked: actions are created in the Developer Portal or with the MCP tool `create_world_id_action` (production or staging). No REST create-action endpoint and nothing about dynamic action strings in the pages we could read (SKILL.md, error codes, verify reference). Nullifiers are scoped to RP and action. `nullifier_replayed` and `max_verifications_reached` exist as client error codes; other replay protection is the RP's own UNIQUE constraint.
- Mismatches with our code: none found. Notes: our `handleVerify` throws when we refuse a review, which IDKit reports as `failed_by_host_app` as documented, so the UI shows our own server message. `NEXT_PUBLIC_WORLD_APP_ID` is set in .env but unused (the app id comes from the server route). Staging proofs verify only with the Simulator.
- Still unobserved (needs the simulator): a real proof, the real nullifier format, whether `proofOfHuman` with `allow_legacy_proofs` returns a v3 or v4 response in staging, real `user_rejected` and `cancelled` behavior.

## The first real proofs (Fri 6 Nov, staging)
- A person ran the review flow for order #1 of @meera.jewels with the World Simulator (staging). The Simulator showed "Unique Human" with World ID 4.0 selected. The proof was verified on our server and the review was published to Arkiv as entity `0xa444fb932ea107e2814e191d8adc878e5936fd70c64ea4bd90c936e508c03508` (creator the attestor, owner the test buyer, read-only). World log row: `verified`, id `f2d508a533b2` (the first 12 hex characters of the nullifier's sha256).
- **What this proof shows and what it does not.** It shows that a unique person, as World counts them, approved this review for this order and this seller. It does not show that a purchase was satisfying, that the parcel was delivered, or that the seller is honest: those come from the PoP contract (the order reached Released) and from the review text.
- **Simulator, not a phone.** Every proof here comes from the World Simulator in the staging environment. No production World ID and no real phone has been used.
- **India availability is unverified.** We did not check which World ID credentials a real buyer in India can get today, or where an Orb is available.
- **Denied path done with a real proof: same-person replay.** On order #17 of @meera.jewels the person who had reviewed order #1 tried again at 19:04 and 19:05 IST. Our server refused (`replay`, "nullifier already used for this seller, or order already reviewed"), nothing was written, and the nullifier hint was the same as the first review (`f2d508a533b2`). World itself did not refuse: the refusal came from our `UNIQUE(nullifier_hash, seller_wallet)` check, so the proof had been accepted by World before our server said no.
- **Second success, different seller:** @kurta.co order #18, 19:12 IST, hint `595fe89d6634` (a different hint from the first review, because each seller has its own action). Review entity `0x5f509ea8843c62d9c4b8c10de5a219710de819d62cdf0a43eea3301d6065f42b`.
- Still open: a cancelled request in the Simulator (expected message: "You cancelled in World App. Nothing was published.").

## Vendor World ID check: one human, one shop (staging only)
**What it is.** The first real step of `/onboard` after the Instagram handle. The vendor proves with World ID that they are one unique person; only then do they get a bio code. It uses ONE portal action for all vendors, read from `VENDOR_WORLD_ACTION` (default `vendor-onboard`, `vendor-rehearsal` for rehearsals), the same staging environment and the same server-side verify call as the review flow. The signal is bound to the handle (`keccak256("pop-vendor:" + handle)`), so a proof made for one handle does not verify for another.

**What it stores.** Table `vendor_verifications`: `nullifier_hash` (the full sha256, UNIQUE, used for uniqueness), `nullifier_hint` (its first 12 hex characters, for display), `handle`, `created_at`, `banned`. The raw nullifier is never stored. Every outcome writes a row to the World verification log on `/proof`, with the handle as the seller and the detail "vendor onboarding".

**Outcomes** (unit tested in `scripts/test-vendor-verification.ts`, 11 checks including the real UNIQUE constraint on the fork database):
- verified: first proof for a person; the handle is claimed for them. The same person and the same handle again, before the shop is registered, is accepted as a resume (a page reload is not a second shop).
- replay: the same person with another handle, or the same handle once its shop exists. Refused with "This person already has a PoP shop." and logged as `replay`.
- banned: a person whose shop was banned. Refused with "This person was banned from selling on PoP." and logged as `rejected`.

**The ban block is NOT on-chain.** It is a PoP database rule. The contracts ban wallets and handles (`SellerRegistry.ban`); they know nothing about World nullifiers. We learn about a ban by reading the registry (`bannedHandle`, `bannedWallet`) when the vendor tries again, and when the arbiter looks a seller up (`/api/arbiter/seller`), and then mirror it into `vendor_verifications.banned`. A banned person could still use another World identity, another phone number or someone else's help; nothing here stops that.

**One human, one shop is as strong as World ID, no stronger.** It proves a unique person, not who they are. The vendor is told so on the page: "This proves you are one unique person. It does not prove who you are."

**Widget friction, vendor flow.** Same as the review flow: when our server refuses a proof the widget shows "Verification declined" and calls `onError("failed_by_host_app")` with no reason, so `apps/web/src/lib/client/vendor-errors.ts` keeps the server's reason on the page.

**Honest status.** Built, unit tested, and the rest of the flow rehearsed on testnet with a throwaway handle. **No real World proof has been run for the vendor action yet**: that needs the `vendor-rehearsal` (or `vendor-onboard`) action to exist in the World portal and one person with the Simulator. The testnet rehearsal used the local dev World skip, so its log row reads `dev-skipped`.
