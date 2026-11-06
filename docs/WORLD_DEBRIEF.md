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

## Timeline
- Thu 23:55: read 4.x docs; found the v1, v3 → 4.0 breaking changes (RP signature, `IDKitRequestWidget`, v4 verify).
- Fri 00:28: server routes + dev page built against `@worldcoin/idkit` 4.6.0.
- Fri 01:05: switched to one action per seller (above).
- Fri 16:43 IST: first successful verification (below).
- **Time to first successful verification**, from the World log on `/proof` (UTC): the first logged request is at 08:46:03 (14:16:03 IST) and the first `verified` row is at 11:13:05 (16:43:05 IST), so 2 h 27 min between them. The four rows at 08:46 UTC were scripted probes (`scripts/world-probe.ts`, wrong action, signal mismatch, wrong environment, fake proof), rejected by design, not a person trying. The log does not record when the person opened the Simulator, so the length of the human step itself is not measured. From the first docs read (Thu 23:55 IST) to the first verified proof (Fri 16:43 IST): 16 h 48 min of wall clock, most of it waiting for the portal app, rp_id, signing key and actions to be created by a person.

## Friction
See `docs/friction-log.md` [World] entries: v4 breaking changes with v1, v3 tutorials still common; signal check helper (`hashSignal`) not in the docs; "max verifications" undocumented for 4.0; whether `nullifier_replayed` is raised by World or only by the app is unclear; npm page blocked automated fetches (403).

## Most impactful improvement
_Draft._ Let an RP create and name actions through a documented API, or accept a counterparty-scoped action string, so a marketplace can scope uniqueness per seller without hand-creating one portal action per seller. Second: return a distinct code for an unknown action (today a fake proof gets the same `verification_failed` whether the action exists or not).

## Live log (Fri 6 Nov night, staging)
- rp-signature works: 300 s validity, one action per seller.
- Verify host `developer.world.org/api/v4/verify/{rp_id}` answers and the app is migrated. Fake proof: 400 `all_verifications_failed`, item code `verification_failed`, detail "execution reverted (unknown custom error)". Same answer for an existing and a non-existent action, so action existence is not observable without a real proof.
- Our route refuses wrong action, wrong signal hash, wrong environment, fake proof and no proof with a readable 400 and stores nothing.
- Docs checked: actions are created in the Developer Portal or with the MCP tool `create_world_id_action` (production or staging). No REST create-action endpoint and nothing about dynamic action strings in the pages we could read (SKILL.md, error codes, verify reference). Nullifiers are scoped to RP and action. `nullifier_replayed` and `max_verifications_reached` exist as client error codes; other replay protection is the RP's own UNIQUE constraint.
- Mismatches with our code: none found. Notes: our `handleVerify` throws when we refuse a review, which IDKit reports as `failed_by_host_app` as documented, so the UI shows our own server message. `NEXT_PUBLIC_WORLD_APP_ID` is set in .env but unused (the app id comes from the server route). Staging proofs verify only with the Simulator.
- Still unobserved (needs the simulator): a real proof, the real nullifier format, whether `proofOfHuman` with `allow_legacy_proofs` returns a v3 or v4 response in staging, real `user_rejected` and `cancelled` behavior.

## First real proof (Fri 6 Nov 16:43 IST, staging)
- A person ran the review flow for order #1 of @meera.jewels with the World Simulator (staging). The Simulator showed "Unique Human" with World ID 4.0 selected. The proof was verified on our server and the review was published to Arkiv as entity `0xa444fb932ea107e2814e191d8adc878e5936fd70c64ea4bd90c936e508c03508` (creator the attestor, owner the test buyer, read-only). World log row: `verified`, id `f2d508a533b2` (the first 12 hex characters of the nullifier's sha256).
- **What this proof shows and what it does not.** It shows that a unique person, as World counts them, approved this review for this order and this seller. It does not show that a purchase was satisfying, that the parcel was delivered, or that the seller is honest: those come from the PoP contract (the order reached Released) and from the review text.
- **Simulator, not a phone.** Every proof here comes from the World Simulator in the staging environment. No production World ID and no real phone has been used.
- **India availability is unverified.** We did not check which World ID credentials a real buyer in India can get today, or where an Orb is available.
- Still open: the denied paths with a real proof (a second review for the same seller, a cancelled request), see `parallel.md` section 7.
