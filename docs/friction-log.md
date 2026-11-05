# Friction log (Whitechain, Arkiv, World)
Logged as it happens. Later split into `WHITECHAIN_FEEDBACK.md`, `arkiv/friction.md`, `docs/WORLD_DEBRIEF.md`.
Format: **[Sponsor] when (IST): title.** Expected / Actual / Repro / Workaround.

- **[Whitechain] Thu 23:55: Test USDT address in prize text not in docs.** Expected: the prize's USDT `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` listed in the docs token list. Actual: docs.whitechain.io/build/block-explorer/token-list lists USDT as `0xaa7962d073935D387e8d442DA1D7149C81388f46` (6 dp, "USDT.e", bridged from Tron Nile). Repro: compare the prize page with the token-list page. Workaround: read `0xcedf…` on-chain; ask mentor.
- **[Whitechain] Thu 23:55: Faucet gives only WBT.** Expected: test USDT from the faucet. Actual: 0.5 WBT per 24 h with GitHub OAuth (account ≥30 days); USDT only via the Tron Nile bridge. Workaround: ask mentor for test USDT.
- **[Whitechain] Thu 23:55: Foundry docs say "PowerShell and Command Prompt cannot run Foundry. Install WSL first".** Actual: foundryup works in Git Bash on Windows (Foundry's own docs allow it). Suggest mentioning Git Bash.
- **[World] Thu 23:55: Major API change in IDKit 4.x / World ID 4.0.** `IDKitWidget`/`verifyCloudProof`/`nullifier_hash` are gone; now `IDKitRequestWidget` + backend RP signature + `POST /api/v4/verify/{rp_id}`. Most tutorials still show v1–v3. "Max verifications" setting not documented for 4.0; "uniqueness proofs are one-time per action for each user" is unclear for per-seller reviews.
- **[World] Thu 23:55: npmjs.com returned HTTP 403 to our doc fetcher**, so versions were read with `npm view` instead (@worldcoin/idkit 4.6.0).
- **[Arkiv] Thu 23:55: Docs API sidebar lists only `localhost` and `tiramisu` chains; guides import `rabdi`.** Also skill says `ne`/`not` are not exported in 1.0.x while the docs list them.
