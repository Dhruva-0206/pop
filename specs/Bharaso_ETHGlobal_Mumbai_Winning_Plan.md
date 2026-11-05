# BHARASO — ETHGlobal Mumbai 2026: Sponsor Requirements, Winning Strategy and Execution Plan

**Prepared:** 5 November 2026  
**Basis:** User-supplied ETHGlobal Mumbai prize-page text (2010 lines), plus explicitly labelled project strategy.  
**Status:** Planning document; no integration, eligibility, award, or deployment is claimed complete.

## 1. Executive decision

**Project:** Bharaso — a cross-platform commerce trust and protected-checkout layer for Indian social sellers and existing online stores. The problem is not that COD is intrinsically bad; it is that buyers and sellers lack portable, credible evidence and enforceable transaction workflows across Instagram, WhatsApp, independent storefronts and other channels.

**Two entry points:**
1. **Bharaso Storefront:** a micro-catalogue and checkout link for sellers operating via Instagram/WhatsApp. Sellers onboard, publish products and wallet/payment settings, and share a Bharaso purchase link.
2. **Pay by Bharaso:** an embeddable checkout/button/API for existing merchants. The merchant keeps their storefront; Bharaso handles protected settlement, order lifecycle and portable commerce passport.

**Trust mechanism:** Verified-human, purchase-bound reviews; a portable seller/buyer commerce passport based on actual Bharaso transaction events; programmable stablecoin escrow and refunds. **One verified human per eligible order review**, with nullifier/replay controls. Never claim that World ID guarantees one real person in all contexts or that an external COD order was verified without evidence.

**Primary sponsor strategy (three partner selections):** **World (Best Use of IDKit), Arkiv (Build on Arkiv from scratch), Whitechain (Operate: Stablecoin Payments for Business)**. These fit three essential layers: proof of human, portable/queryable trust records, and real payment settlement. If the checkout is made genuinely gasless, Whitechain Scale is a possible alternative track; do not dilute the MVP by chasing both.

**Important constraint:** The supplied page says the Arkiv + Swarm bonus is bundled with an Arkiv entry and does not consume another of the three partner picks. It also says each team can win only one Arkiv track prize. Confirm exact ETHGlobal submission rules and eligibility on the live event dashboard before final selection.

## 2. What judges need to see

| Judge question | Bharaso's demonstrated answer | Evidence |
|---|---|---|
| Is this a real, sharply defined problem? | Buyer fears fake seller/non-delivery; seller fears fraudulent orders and unjustified complaints | 30-second buyer/seller scenario, concrete examples, no fabricated statistics |
| Why Web3 rather than a normal database? | Shared independently readable reputation records and rule-enforced settlement that survives a single storefront | Read Arkiv data from a second client; show contract transactions |
| Is this actually cross-platform? | Same checkout/order and trust identity from a social-selling catalogue and a third-party demo shop | Two entry points, same backend/contract logic |
| Does identity do meaningful work? | Verified-human proof is required before submitting a purchase-bound review; failure blocks posting | Server verification and denied/replay paths |
| Does money move? | Buyer payment, hold, fulfillment confirmation and release/refund | Verified Whitechain Sepolia contract, real specified testnet USDT transfer, explorer links |
| Can others integrate it? | A documented button/SDK or payment-link API with order webhook | Standalone sample merchant and integration snippet |
| Is it safe and honest? | Timeouts, dispute handling, access control, no invented COD validation | Tests, threat model, clear prototype limitations |
| Is it finished enough to judge? | Live demo, reproducible repo, short video, sponsor-specific files | Submission checklist below |

**Winning thesis:** Do not pitch “blockchain fixes COD.” Pitch **portable trust and programmable buyer protection across disconnected sales channels**. COD reduction is a possible outcome to measure, not a proven result. Traditional COD cannot be cryptographically escrowed merely by creating a blockchain order; for physical cash delivery, use a separately verified logistics/payment integration or label the record unverified.

## 3. Primary sponsor #1 — World: Best Use of IDKit ($2,500 total)

### Official expectations in the supplied prize text
- Functioning application, mini app or onchain flow using IDKit.
- At least one supported World ID credential; verification on the server or onchain as appropriate.
- Identify the **specific trust moment**, explain why the credential is the **minimum sufficient** one.
- Show successful verification and a meaningful unsuccessful path (cancel, reject, unavailable credential, ineligible).
- Short integration debrief: time to first success, friction, missing capability/docs, highest-impact improvement.
- Prize: up to two teams at $1,250 each.

### Exact Bharaso integration
**Trust moment:** a buyer attempts to publish a reputation-changing review after a completed, eligible Bharaso purchase. The UI launches IDKit only at that moment. The backend validates the proof and checks that the order is eligible, reviewable and not already reviewed. It then records the review with a privacy-preserving per-app nullifier / duplicate control where supported.

**Rules:** One review per completed order per verified-human account; block duplicates for the same order. A buyer may review multiple distinct purchases, subject to anti-abuse policy. Do **not** equate proof of humanity with verified shipping, authentic merchandise, buyer innocence, or seller legitimacy. Do not store sensitive identity details on public chains.

**Required demo:** successful completed purchase → review prompt → IDKit → backend validation → review published → Arkiv passport updated; then replay same order → rejected; cancellation/failed proof → no review. Include a server-side verification log stripped of secrets.

**Implementation:** frontend IDKit component; backend `/api/reviews/verify-and-submit`; order eligibility and nullifier uniqueness enforced by database constraints; hash/commitment stored in Arkiv, not raw identity proof. Follow current credential docs and verify the credential available to the team.

**Do not accidentally enter the wrong World track:** Agent Pass has a separate $5,000 general prize and $2,500 Continuity prize, requiring the *official Agent Pass* and full approval/denial journey. IDKit alone does not qualify for Agent Pass. World specifically warns Agent Pass proofs currently use fake identities and must not be trusted in production. Pursue Agent Pass only if a genuinely meaningful agent action is introduced and the official integration is built.

**Docs:** https://docs.world.org/world-id/idkit/integrate ; https://docs.world.org/world-id/idkit/credentials ; https://docs.world.org/world-id/idkit/verification-flows

## 4. Primary sponsor #2 — Arkiv: Build on Arkiv (from scratch), $4,000 total

### Official qualification requirements
- New app built from scratch during ETHGlobal Mumbai under ETHGlobal rules.
- Write to current Arkiv testnet using `@arkiv-network/sdk` or JSON-RPC; **at least one user-visible feature must read data from Arkiv**.
- README includes writer wallet address(es) and one executable query.
- `/arkiv/schema.md` specifies entities, query fields, ownership and expiration; `/arkiv/friction.md` gives honest feedback.
- One file per judging criterion: `/arkiv/reach.md`, `/arkiv/why-arkiv.md`, `/arkiv/how-you-use-arkiv.md`, plus friction file.
- Public open-source repo and license; disclose AI usage as ETHGlobal requires.
- SDK merely installed or Arkiv used only as unread logs **does not count**.

### Official scoring — four equal 25% components
1. **Feedback:** concrete friction, expected vs actual behavior, reproduction steps.
2. **Reach:** target users, actual testability, continued use after event.
3. **Why Arkiv:** what a Postgres-only alternative loses; what is deliberately kept offchain.
4. **How Arkiv is used:** appropriate filters, edit rights, expiration, user-visible effects.

### Exact Bharaso integration
**Commerce Passport** is a portable, public, queryable record of *verified Bharaso-mediated transaction events*, not a universal history of all purchases across the internet.

Proposed Arkiv entities:

| Entity | Fields (illustrative) | Owner | Expiration | User-visible query |
|---|---|---|---|---|
| `MerchantProfile` | merchantId, wallet, displayName, platformLinks, createdAt | merchant wallet or authorized service | Long-lived/renewable | Merchant profile across shops |
| `OrderAttestation` | orderCommitment, merchantId, status, chainTxHash, updatedAt | authorized settlement service | Long enough for dispute/audit policy | Evidence-backed completed order count |
| `ReviewAttestation` | orderCommitment, merchantId, rating, contentHash, verifiedHumanFlag, createdAt | review author/authorized publisher | Published review retention policy | Filter verified reviews for seller |
| `DisputeOutcome` | orderCommitment, outcome, evidenceHash, resolutionTxHash | authorized resolver | Defined audit period | Buyer protection history |
| `Listing` | sellerId, productId, title, price, availability, expiresAt | seller wallet | Short, renewable | Cross-platform catalogue search |

**Data minimization:** No buyer name, phone, shipping address, raw World ID proof, full chat history or unencrypted dispute evidence in public entities. Keep PII in access-controlled application storage. Do not promise that entity deletion/expiry removes previously replicated information.

**Visible demo:** Merchant opens public passport → UI fetches Arkiv entities → show verified completed orders, review distribution, dispute outcomes; switch to a separate demo merchant integration and query the same seller data directly from Arkiv. Show a real Arkiv write and query in developer console/explorer.

**Why Arkiv instead of Postgres:** third-party merchants can independently query shared attestations using wallet-owned entities and common filters, without requiring access to Bharaso's private database. **Honest caveat:** a centralized attestation issuer can still lie; contract event verification, signed provenance and third-party reproducibility matter. Avoid asserting that Arkiv alone makes reviews truthful.

**Testnet supplied:** chain ID `7794095`; RPC `https://rpc.rabdi.db-chain.testnet.arkiv.network`; docs https://docs.arkiv.network . Check live network availability before implementation.

### Optional Arkiv + Swarm bonus ($500)
If time allows, place **non-sensitive or appropriately encrypted** evidence files/receipts on Swarm and store safe references in Arkiv. Required `/arkiv/swarm.md`: data split, entity key + retrievable reference, postage batch ID and payer wallet, Bee service, upload/read code, reproduction steps, video timestamp and friction. **Never publish an encrypted Swarm reference containing its decryption key directly in public Arkiv data.** This bonus does not consume a separate partner selection, per supplied page.

## 5. Primary sponsor #3 — Whitechain: Operate, Stablecoin Payments for Business ($5,000 total)

### Official expectations
- **Reusable drop-in integration:** widget, SDK, payment-link API or plugin that a separate demo app adds in approximately 20 lines.
- Show **both merchant and customer views**.
- Extra credit for flows beyond initial payment: refund, renewal or accounting export.
- Deploy contracts on **Whitechain Sepolia, chain ID 1874**, verify on explorer.
- At least **one real payment in the specified Whitechain USDT** in the main flow, with explorer link in README; a self-minted test token does not qualify.
- README line explaining why onchain Whitechain stablecoin settlement adds value over ordinary payment rails.
- **2–4 minute video** showing all parties and `WHITECHAIN_FEEDBACK.md` with genuine integration feedback.

**Specified testnet USDT address from source:** `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` (verify current docs/network before use).

### Exact Bharaso integration
- **Checkout SDK:** `createBharasoCheckout({merchantId, orderId, amount, callbackUrl})` returns a checkout URL or embeddable widget.
- **Payment contract:** receives the specified USDT, links payment to unique order commitment, holds funds, releases to seller on agreed fulfillment proof/confirmation, or refunds according to documented dispute/timeouts.
- **Merchant dashboard:** orders, funded status, payout/refund actions, ledger/export and webhooks.
- **Buyer dashboard:** price, protection terms, payment confirmation, delivery confirmation, dispute/refund status.
- **Second demo application:** minimal independent merchant storefront imports the SDK and uses the same contract/API.

**Important:** Escrow is not inherently a fair oracle. A smart contract cannot know that a physical parcel arrived. The MVP must define the attestor: buyer confirmation, tracked delivery provider, jointly approved dispute resolver, or timeout policy. Make trust assumptions explicit. Prevent duplicate settlement, unauthorized release, reentrancy, replay, mismatched token/amount and indefinite locks. Use OpenZeppelin-style access controls and safe ERC-20 transfers where appropriate.

**Required live demo:** create social-store order → fund with specified USDT → contract event/explorer → mark delivery through defined demo attestation → release; then separate order → dispute/refund. Show same integration from a third-party store and exportable merchant receipt.

**Docs:** https://docs.whitechain.io ; https://explorer.testnet.whitechain.io ; https://faucet.testnet.whitechain.io

### Alternative Whitechain Scale track ($3,000)
Choose **Scale** only if you implement truly gasless payer UX: relayer or smart account, gas funded by business, relayer funding model and abuse limits. Whitechain explicitly says a payer signing a gas-paying transaction will not place in this track. Operate is the more natural target for a commerce SDK plus escrow/refunds. Avoid pretending one implementation automatically qualifies for both.

## 6. Architecture

```text
Instagram / WhatsApp seller               Existing Shopify/custom store
          |                                           |
    Bharaso catalog link                     Pay by Bharaso SDK
          |                                           |
          +------------------+------------------------+
                             |
                   Checkout + Order API
                             |
               +-------------+--------------+
               |                            |
       Whitechain Sepolia              Application DB
       USDT escrow/refunds          private order + PII
               |                            |
         settlement events --------> event processor
                                            |
                                      Arkiv entities
                                            |
                                 Commerce Passport UI
                                            |
                          Verified-order review submission
                                            |
                              World IDKit -> server verify
                                            |
                               publish review attestation
```

**Separation of concerns:** Whitechain is source of truth for escrow movements; application DB holds private operational state; Arkiv publishes queryable, limited attestations; World verifies eligibility at the review trust moment. Do not let a frontend response alone trigger money release or reputation writes.

## 7. End-to-end product flows

### A. Instagram/WhatsApp micro-seller
1. Seller creates profile, connects wallet and publishes product listings.
2. Seller posts Bharaso product link in Instagram bio, DM or WhatsApp.
3. Buyer visits catalogue, sees passport (real Arkiv query), selects item.
4. Checkout shows item, merchant, shipping policy, dispute rules and payment token.
5. Buyer pays designated USDT on Whitechain; app verifies contract event and records order.
6. Seller sees funded order and fulfills it.
7. Defined delivery/acceptance mechanism triggers release or dispute; funds never release merely because seller clicked “shipped.”
8. Eligible completed buyer uses World IDKit to post a purchase-bound review.
9. Server validates proof + order + uniqueness, publishes Arkiv review attestation; passport updates.

### B. Existing e-commerce store
1. Merchant installs minimal SDK/button and configures webhook secret.
2. Store creates order and redirects buyer to Bharaso checkout.
3. Buyer sees existing seller's portable passport and protected terms.
4. Whitechain settlement and status callbacks update merchant's original order.
5. Review and dispute history become queryable across participating stores.

### C. Failure paths (must be demonstrated/tested)
- Cancel World verification → review blocked.
- Reuse World proof or duplicate order review → blocked.
- Unpaid checkout → no paid-order passport entry.
- Seller tries early release → rejected unless policy condition met.
- Refund after eligible dispute → contract event and status synchronized.
- Webhook replay → idempotent processing.
- Arkiv temporarily unavailable → checkout state remains accurate; passport displays explicit unavailable/stale status, never fabricated score.

## 8. Critical product honesty: the COD problem

**Bharaso is cross-platform at the integration layer, not omniscient across all platforms.** It can serve Instagram/WhatsApp merchants and other shops that adopt its checkout. It cannot validate every external COD delivery or magically prevent scams on a nonparticipating platform.

**COD-specific positioning:** Offer a trusted **prepaid alternative** with escrow, seller track record and refund rules. Optionally introduce a hybrid deposit/COD flow later, but only with a real logistics and fiat collection integration. Explain that many Indian consumers use UPI/INR and cannot directly pay USDT; the hackathon stablecoin checkout is a technical prototype, not a production-ready Indian payment or regulatory solution. Obtain legal/compliance review before live consumer launch (payments, crypto, KYC, consumer protection, refunds, data protection).

**Trust score:** Avoid a black-box “fraud-free” badge. Show transparent, bounded metrics: count of confirmed Bharaso transactions, verified-order reviews, disputes resolved, refunds, history window and coverage percentage. Display “insufficient data” for new sellers. Make merchant appeals and malicious-review defenses part of the roadmap.

## 9. Sponsor comparison and alternatives

| Sponsor | Prize/track relevant to Bharaso | What would actually qualify | Fit / warning |
|---|---|---|---|
| **World** | IDKit $2,500 | Functioning credential verification at meaningful trust moment, successful + failed path, debrief | **Primary** |
| **Arkiv** | Build from scratch $4,000 | Real Arkiv writes + user-visible queries, four judging docs, schema, wallet, open source | **Primary** |
| **Whitechain** | Operate $5,000 | Verified contracts, specified USDT payment, reusable checkout, both parties, video + feedback | **Primary** |
| **Arc** | Advanced Stablecoin Logic $3,000 | **Must start in Arc Studio**, shareable Studio URL, frontend/backend, diagram, video/presentation, repo; conditional USDC/EURC escrow is explicitly sought | Strong **alternative to Whitechain**, not a free extra |
| **Chainlink** | CRE $1,500 | Meaningful CRE orchestration, blockchain + external API, CLI simulation or deployment | Possible future delivery attestation; requires real CRE flow |
| **Ethereum Foundation** | CROPS $3,500 / Anon-RPC $5,000 | CROPS-by-letter README and privacy/resilience demo, or RPC reads routed through Anon-RPC by default | Privacy-oriented alternative, but adds scope |
| **ENS** | ENSv2 $7,000 | ENSv2 central on mainnet/Sepolia, live demo, open source; existing-project track needs mainnet | Not just a merchant `.eth` label |
| **1inch** | Aqua $5,000 | Official Aqua/SwapVM, sophisticated DeFi position, onchain token transfers, commit history; SwapVM scores higher | Poor fit for straightforward escrow |
| **0G** | Private Computer $5,000 | Main user flow inference with request IDs, working repeat-use AI app, repo/video/live link | Poor fit unless AI is essential |
| **Hedera** | x402 $6,500 | Autonomous paid request settled on Hedera, tx ID, ≤5 min demo | Different product thesis |
| **Uniswap** | Build with Uniswap $10,000 | Meaningful Uniswap integration, public repo, `FEEDBACK.md` and submitted developer feedback form | Swaps alone add little to trust thesis |
| **Definitive** | Flash API tracks $5,000 combined | Real Flash trading/advanced-order integration, plus required social demo posting | Trading focus; weak fit |

**Do not select partners by prize pool alone.** One sponsor used deeply and verifiably is stronger than three superficial SDK imports. If Whitechain testnet USDT access blocks the build, **Arc advanced stablecoin escrow** is the strongest conceptual replacement, but only if Arc Studio is genuinely used as the starting point and all Arc requirements are met.

## 10. Build priorities and ownership

### P0 — must work for a credible submission
- Two merchant entry points, shared checkout/order model.
- Real Whitechain USDT payment and verified escrow contract.
- Order states and buyer/merchant views; at least one release/refund path.
- Real Arkiv write/read powering a public passport.
- World IDKit server-verified purchase review and rejected path.
- GitHub README, sponsor files, deployment evidence, demo video.

### P1 — differentiators after P0
- Third-party merchant SDK with concise integration and signed webhooks.
- Clear dispute policy, automated status transitions, replay prevention.
- Merchant CSV export, public explorer links, transparent score breakdown.
- One independent client querying Arkiv data without Bharaso's API.

### P2 — only if substantial time remains
- Swarm bonus integration.
- Fully gasless Whitechain Scale implementation.
- Logistics API attestation via Chainlink CRE.
- Fiat/UPI integration, carrier verification, advanced scoring, multi-platform plugins.

**Suggested parallel workstreams (adapt to team size):**
- Contracts/payment: Whitechain escrow, tests, explorer and refund/release.
- Identity/reputation: World server verification, Arkiv schema/write/read, review controls.
- Product/integrations: social catalogue, merchant SDK, buyer/merchant UI, API.
- Integration/demo owner: deployment, failure-path rehearsals, docs, Git history and video.

## 11. Proposed build schedule (relative to actual hackathon start)

| Window | Output | Exit test |
|---|---|---|
| Hours 0–3 | Repo, contracts/API schemas, network credentials, sponsor docs skeleton | Team can run frontend/backend/contracts locally |
| Hours 3–9 | Whitechain payment contract and checkout stub | Actual specified-USDT payment visible on explorer |
| Hours 6–12 (parallel) | Arkiv entities and passport UI | Entity write + query from live UI |
| Hours 9–16 | World verification and review rules | Success, cancel, replay tests pass |
| Hours 14–22 | Both merchant surfaces + integrated order lifecycle | End-to-end social seller purchase and third-party store checkout |
| Hours 22–28 | Refund/dispute, webhook idempotency, security tests | Second end-to-end failure/refund demo |
| Final hours | Sponsor docs, live link, videos, presentation, backup recording | Clean judge rehearsal on a fresh browser |

This is an **illustrative** schedule, not the event's confirmed duration. Start with the riskiest external integration rather than spending half the event on UI polish.

## 12. Exact repository deliverables

```text
bharaso/
  README.md
  LICENSE
  AI_USAGE.md                      # AI tools and what was generated/verified
  WHITECHAIN_FEEDBACK.md
  arkiv/
    schema.md
    friction.md
    reach.md
    why-arkiv.md
    how-you-use-arkiv.md
    swarm.md                       # only if pursuing bonus
  apps/
    web/                           # social catalogue + passport + dashboards
    demo-merchant/                 # independent Pay by Bharaso integration
  packages/
    checkout-sdk/
    contracts/
  services/
    api/
    arkiv-indexer/
  tests/
    escrow/
    reviews/
    webhooks/
  docs/
    architecture.md
    threat-model.md
    demo-script.md
    deployment-addresses.md
    sponsor-evidence.md
    integration-debrief-world.md
```

**README must link directly to:** live demo; demo video; quick-start; architecture; each sponsor's actual implementation files; chain ID, verified contract and USDT tx hash; Arkiv writer wallet and executable query; World verification path; test commands; known limitations; AI usage disclosure; license. Keep secrets in `.env.example`, never `.env`.

## 13. Demo script (2–4 minute Whitechain-compliant master cut)

| Time | What appears | Proof |
|---|---|---|
| 0:00–0:20 | Instagram seller DM link and scam/trust problem | Clear India-specific motivation |
| 0:20–0:45 | Social catalogue + portable merchant passport | Live Arkiv read |
| 0:45–1:20 | Buyer pays USDT; explorer link | Real Whitechain tx |
| 1:20–1:50 | Merchant receives funded order; confirms fulfillment via stated policy | Merchant side + contract state |
| 1:50–2:15 | Buyer reviews using World IDKit | Server-verified proof + Arkiv write |
| 2:15–2:35 | Attempt duplicate/cancelled review | Protected action blocked |
| 2:35–3:05 | Independent merchant site uses Pay by Bharaso | Reusable integration |
| 3:05–3:30 | Refund or dispute resolution + explorer | Post-payment lifecycle |
| 3:30–3:50 | Architecture and sponsor mapping | Each sponsor indispensable |

**Record separate cuts if needed:** World verification-focused demo; Arkiv write/query-focused demo; Whitechain 2–4 minute required video. Avoid pretending a pre-recorded event is live; have explorer links and a backup run.

## 14. Submission evidence matrix

| Sponsor | Required artifact | Completion check |
|---|---|---|
| World IDKit | App + server-side verification | Success + cancellation/rejection shown |
| World IDKit | Integration debrief | Time to first success, friction, missing docs, biggest improvement |
| Arkiv | Real testnet entities and user-visible query | Wallet, query and UI screenshots/recording |
| Arkiv | `/arkiv/schema.md` | Owner, filter fields, expiry for each entity |
| Arkiv | `/arkiv/friction.md` | Reproducible honest feedback |
| Arkiv | `/arkiv/reach.md` | Target users and grounded evidence of interest |
| Arkiv | `/arkiv/why-arkiv.md` | Specific Postgres comparison |
| Arkiv | `/arkiv/how-you-use-arkiv.md` | Query/ownership/expiry and UI connection |
| Arkiv | Open source + AI disclosure | LICENSE, README and explanation |
| Whitechain | Verified deployed contract | Correct chain and explorer URL |
| Whitechain | Specified USDT transfer | Main-flow tx hash in README |
| Whitechain | Merchant + buyer demo | Both roles, refund or export |
| Whitechain | 2–4 minute video | Every involved party visible |
| Whitechain | `WHITECHAIN_FEEDBACK.md` | Honest friction and docs feedback |
| Whitechain | Drop-in integration | Separate merchant app and concise SDK example |
| ETHGlobal | Complete project showcase | Accurate team, repo, live demo, sponsor selections and event-specific submission fields |

## 15. Security and product acceptance tests

- Only authorized buyer can confirm receipt or request relevant refund; only authorized resolver can decide contested disputes.
- Escrow cannot be released twice; refund cannot happen after final release; token/amount/order ID are validated.
- Onchain state and backend state are reconciled from confirmed events, not assumed after wallet popup.
- Every payment webhook and Arkiv publication job is idempotent.
- Review API checks purchase completion, server-validated proof and unique order review atomically.
- Replay and duplicate nullifier attempts fail; user cancellation does not create a review.
- Seller cannot self-issue “verified purchase” reviews without a genuine paid order.
- Private shipping details never enter public Arkiv entities or onchain calldata.
- UI distinguishes `pending`, `confirmed`, `disputed`, `refunded`, `released`, `unverified` and `unavailable` accurately.
- Contract test suite covers invalid caller, expired window, zero/incorrect amount, double action and refund conditions.

## 16. How to maximize the chance of winning

1. **Demonstrate sponsor necessity, not sponsor presence.** Remove World → purchase-bound human reviews become less resistant to sybils. Remove Arkiv → independent portable querying disappears. Remove Whitechain → enforceable USDT escrow/settlement disappears.
2. **Show two different sellers/stores and one shared trust record.** This is the differentiator versus a generic escrow marketplace.
3. **Prove real transactions.** Judges should see explorer URLs, actual writes and an actual validated proof flow, not hard-coded badges.
4. **Show one credible failure path for each critical layer.** Rejected review, unauthorized release, missing/stale passport data.
5. **Give judges a testable artifact.** Live URL, fresh-browser instructions, demo wallets, seed/test data, query, contract address and repo file paths.
6. **Use quantitative evidence without inventing traction.** Report measured transaction times, test counts, SDK lines, latency, and actual user feedback if collected.
7. **Explain real-world limits.** Cross-platform adoption, logistics oracles, stablecoin access, regulation and disputes are future integrations, not solved by a prototype.
8. **Do not neglect sponsor-specific paperwork.** Arkiv's scoring files are explicitly weighted; Whitechain's feedback file/video/USDT transaction are qualifying evidence; World requires integration debrief and denied path.
9. **Keep a clean incremental commit history.** Even where not mandated for these three tracks, it supports the event's new-work expectations and makes judging easier.
10. **Rehearse a short, robust story.** Buyer risk → shared passport → protected checkout → verified review → portable trust. Every screen must serve that narrative.

## 17. Final go/no-go decision

**Submit for the primary three only if all three integrations are demonstrably real.** If any sponsor's hard requirement cannot be met, change that sponsor selection rather than claiming compliance. Winning is never guaranteed; the aim is a strong, eligible, differentiated and verifiable submission.

**Suggested pitch:** “Bharaso is the trust layer for commerce that starts in a DM. Small sellers get a storefront; established stores get a checkout SDK. Buyers see a portable, evidence-backed merchant passport, pay through protected onchain settlement, and leave one verified-human review per completed order. The trust record travels with the merchant instead of staying trapped inside one platform.”

## 18. Primary source and verification notes

- ETHGlobal Mumbai prize page: https://ethglobal.com/events/mumbai/prizes
- ETHGlobal Mumbai FAQ: https://ethglobal.com/events/mumbai#faq
- This document's sponsor requirements were extracted from the **user-supplied prize-page snapshot** dated around 5 November 2026. Its text is authoritative for this plan's *reported* requirements, but sponsor pages, deadlines, token contracts and eligibility may change; verify before submission.
- The user-supplied text does **not** establish that Bharaso is built, that any partner has approved it, or that it can legally operate a real-money Indian consumer payment service.
