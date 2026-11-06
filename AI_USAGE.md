# How we used AI

We are Dhruva Somen Chakrabarty, Shantanu Somwanshi and Tanishqa Chopade. We used AI tools heavily on this project, and this page says where, so nobody has to guess. Short version: **we set the product, the trust rules and the contract design, and AI tools wrote a large share of the code, the tests and the documents under our direction.** We did not write most of the application code by hand.

## Tools

| Tool | What we used it for |
|---|---|
| Claude | Planning. The documents in [`specs/`](specs) (build spec, architecture, event rules, sponsor requirements, the winning plan) were written with it from our direction and are included unchanged. |
| Claude Code | Implementation, tests and documents, working in this repository from our written prompt ([`specs/prompts/`](specs/prompts)) and from decisions we recorded in [`CLAUDE.md`](CLAUDE.md). We ran it on two machines. It wrote the contracts and their tests, both apps, the SDK, the scripts, the end-to-end tests and most of the docs, and it ran the testnet deploy and the test orders after we said go. We do not name a model version here because the repository does not record one. |
| ChatGPT and Figma | The logo and the cover image. ChatGPT gave us concepts and we finished them by hand in Figma. The original logo file is [`docs/brand/pop-logo-original.png`](docs/brand/pop-logo-original.png). |

## What we decided and did ourselves

- The product: a protected checkout for small sellers on social platforms and websites, paid in USDT, with a refund nobody can stop and a release only by the buyer's code.
- The trust rules: the refund after a missed deadline, the courier that can only report a refused handover, one review per person per seller, one shop per person, and the ban rules. [`CLAUDE.md`](CLAUDE.md) section 8 records each decision and who made it.
- The contract design: the states, the roles, the 1% fee, the windows (30 and 120 seconds, a 300 second arbiter timeout), the arbiter timeout refund, and `forceRefundBanned` for banned sellers. We decided to narrow `forceRefundBanned` after reading the first draft, and Claude Code made the change.
- The prize targets (Whitechain, Arkiv, World) and the choice to leave other tracks out.
- Every go decision on money and accounts: the testnet deploy (one broadcast, after a dry run), the test USDT purchase on YetiTrade, the Vercel projects, and what runs on the live sites.
- The World ID portal setup (the app, the relying party and the actions) and every real World proof. We ran the Simulator ourselves.
- The logo and cover, the brand colours, and the wording of the landing page, checkout and onboarding. A teammate also ran the UI and copy passes with Claude Code on the second machine.
- The demo and the video.

## What AI tools did, by area

| Area | What was written with AI |
|---|---|
| Contracts | `PoPCheckout`, `SellerRegistry`, the deploy script and the Foundry tests, including the invariant suite and the mutation checks (remove a check and watch a test fail). |
| Apps | PoP's pages and API (checkout, order, onboarding, dashboard, simulated courier, arbiter, `/proof`, `/verify`, badge) and the Kurta Co. store. |
| Merchant SDK | `@pop/checkout-sdk`: offer signing, sessions, HMAC webhooks and the on-chain recheck. |
| Reviews and World | The review pipeline (World proof, claim in Postgres, Arkiv entity, ownership transfer, retry), the readable refusal messages, and the vendor World ID check. |
| Vendor onboarding | The flow from handle to payment link and QR, the demo mode that skips the bio check on testnet, and the `/dashboard` shipping fixes. |
| Data | The Supabase schema and the store layer. |
| Tooling | Fork, deploy, seed and demo scripts, the live smoke script and the demo driver. |
| Docs | The README, the Arkiv judging files, the Whitechain and World feedback, limitations and evidence, written from logs and runs in this repository. |
| Brand and screenshots | We applied the finished logo across the apps and took the submission screenshots with browser automation. |

## How we checked the work

These are the numbers we measured, not estimates:

- **Contracts:** `forge test` passes 58 of 58, including an invariant suite with 6 invariants. The mutation checks confirmed that removing the self-purchase check or the banned-seller check makes tests fail.
- **End to end:** `scripts/e2e-fork.ts` passes 66 checks on a local fork. `scripts/e2e-merchant.ts` passes 48 checks on a fork, and an earlier real-time run passed 47 checks on Whitechain Sepolia. `scripts/test-vendor-verification.ts` passes 11 checks.
- **Live:** `scripts/vercel-smoke.ts` passes 11 of 11 checks against both live sites.
- **By hand:** a person paid orders 18 and 19 through the live Kurta store, order 19 from a real phone over mobile data, and ran the World Simulator for two reviews. Orders 11 and 25 were paid through the same checkout by Claude Code driving a browser, so they show the flow works but are not hand tests. We list what has only been tested by script in [README.md](README.md) under "Honest limits"; that list includes `/onboard`, the `/arbiter` buttons and `/dashboard` shipping.
- **Accessibility:** Lighthouse accessibility scored 100 on nine pages on 6 Nov, before the later copy and logo changes. We did not test with a screen reader or in Safari.
- **Every claim in [`docs/evidence.md`](docs/evidence.md)** has a transaction or a query behind it.

## What AI tools did not do

- They did not choose the product, the prize targets or the contract rules.
- They did not hold or print our private keys. Keys live in `.env`; scripts read them by name and print addresses only.
- They did not run a World proof. A person did, with the Simulator, and the log on `/proof` shows the result.
- They did not redeploy the contracts or regenerate wallets, and they deployed to testnet once, after our go.

## Our rules

- Humans make the product and sponsor decisions; AI proposes and implements.
- Every contract change gets tests, and we review the contract before any testnet deploy.
- We keep secrets out of prompts and logs.
- We say in the README what we have not proven yet, instead of hiding it.

Organizer confirmation that the planning documents in `specs/` may be included is still pending.
