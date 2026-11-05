# ETHGlobal Mumbai 2026 — Rules, Guidelines & Bharaso Compliance Plan

> Source: ETHGlobal Mumbai FAQ/rules text supplied by the team on 5 November 2026. This document distinguishes **official requirements** from **recommended actions**. Sponsor-specific requirements are separate and must also be met.

## 1. Deadline and submission

**Official:** Submit by **Saturday, 7 November 2026, 09:00 IST**. Late submissions are not accepted. Submit through the Hacker Dashboard with the project title, description, repository and other requested details. The final submission step permits selection of **up to three partner prizes**. A partner with multiple tracks counts as one partner selection while permitting eligibility across its tracks, subject to track rules.

**Recommended for Bharaso:** Freeze core functionality well before the deadline. Reserve a dedicated window for the demo, sponsor evidence, repository cleanup and submission verification. Do not assume that visiting a sponsor booth substitutes for submitting to its prize.

## 2. Track eligibility: Classic vs Continuity

**Official — Classic / From Scratch:** Project work must begin after the hackathon officially starts. Prior project-specific code, designs and assets are prohibited, except public libraries and starter kits. A project built before the event may participate but does not qualify for partner prizes or Finalist consideration under Classic.

**Official — Continuity:** Existing codebases are permitted only under the selected Continuity track's conditions. Submissions must clearly separate existing work from new functionality developed during the event; partner eligibility varies.

**Bharaso decision:** Choose Classic only if the entire project-specific implementation, custom design and assets were created during the permitted window. Earlier discussions do not establish permission to reuse project-specific pre-event designs or artifacts. Ask organizers about whether any pre-event specification/planning artifacts can be included or reused; do not assume they are exempt.

## 3. Git history and provenance

**Official:** Use version control during the event. Large single commits or missing history can disqualify a submission. Include GitHub, Figma or equivalent evidence of when the work was created. Disclose reused libraries and boilerplates.

**Recommended:** Commit regularly by meaningful milestones: scaffold; identity verification; Arkiv write/read; payment contract; storefront; checkout plugin; dispute/review; tests; documentation. Keep commits authentic and timestamped. Never manufacture a commit history.

## 4. AI usage and transparency

**Official:** AI-assisted development is allowed, but the submission must identify how and where AI tools assisted code, files or assets. Meaningful human contribution is required. If using a spec-driven workflow (OpenSpec, Kiro, spec-kit, etc.), include all spec files, prompts and planning artifacts in the repository.

**Recommended:** Add `AI_USAGE.md` mapping tool, purpose, files, human review, testing and major manual decisions. If using specs, include the actual specs and prompts as required. Ensure team members can explain critical code without relying on AI-generated explanations.

## 5. Submission category and judging attendance

**Official:**
- **Finalist and Partner Prizes:** Attend a Finalist judging session. Optional sponsor-booth presentations are for feedback/networking and are not required for partner judging.
- **Partner Prizes Only:** Apply to up to three partner prizes, explain integrations and provide feedback/comments. Booth presentations remain optional.
- Finalist judging information appears on the Hacker Dashboard after submission.

**Recommended:** Select **Finalist and Partner Prizes** if Bharaso is eligible and demo-ready. Have a local backup demo in case a live service fails, but label any simulation honestly.

## 6. Finalist presentation format

**Official:** Each team gets **7 minutes**: **4-minute demo** followed by **3-minute Q&A**. Check in at the judging table. Expect questions about inspiration, tools/technology choices, challenges and solutions.

**Recommended four-minute Bharaso presentation:**

| Time | Content | Proof shown |
|---|---|---|
| 0:00–0:25 | COD trust problem across Indian commerce channels | Specific buyer/seller scenario, no unsupported market statistics |
| 0:25–1:05 | Instagram/WhatsApp seller creates a catalogue | Working storefront and seller wallet |
| 1:05–2:00 | Buyer pays using Bharaso and sees protection | Real transaction and contract/settlement state |
| 2:00–2:45 | World ID verification + one verified review | Server-validated proof, duplicate/failed review rejection |
| 2:45–3:30 | Commerce Passport read in another storefront | Live Arkiv query, reputation portability |
| 3:30–4:00 | Technical differentiation and final outcome | Sponsor architecture, transaction IDs and clear takeaway |

**Suggested Q&A preparation:** Explain how payments are released/refunded; how buyer delivery is confirmed; how disputes are resolved; why World ID does not itself prove a purchase; how the one-review-per-person-per-order rule works; why Arkiv rather than Postgres; which part is onchain versus offchain; limitations around fiat COD, wallets, gas, privacy, identity availability and adoption.

## 7. Five official judging categories

| Official criterion | What it means for Bharaso | Evidence to prepare |
|---|---|---|
| Technicality | Sophisticated solution to a hard problem | Verified contract transactions, secure proof verification, state machine, tests |
| Originality | Creative solution to an existing problem | Portable trust/reputation across social commerce and independent stores |
| Practicality | Functional and usable by the intended audience today | End-to-end demo, clear limitations and deployable app |
| Usability (UI/UX/DX) | Easy to use and integrate | Buyer journey, merchant onboarding, simple integration docs |
| WOW Factor | Memorable, unusually compelling execution | Same verified Commerce Passport appearing across two channels after an actual purchase |

**Important:** The FAQ does not specify numerical weights for these five categories. Do not invent a scoring formula.

## 8. Demo video requirements

**Official:** The demo video is described as optional but strongly encouraged. The upload accepts **2–4 minutes only**; shorter or longer videos are rejected. Use **720p or higher**. Speak clearly, minimize noise, keep backstory under 20 seconds, show working product and edit out unnecessary waits. Slides should have no more than four bullet points each.

**Official prohibitions:** Do not speed up footage to fit the time limit; do not substitute background music and text for spoken explanation; do not record the submission video using a mobile phone; do not use text-to-speech or AI voiceover.

**Recommended:** Record a real screen capture with a human voiceover, 1080p, approximately 3:00–3:30. Include one failure/denial case and sponsor proof in the product flow. Check the video after export and upload it early enough to resolve errors.

## 9. Partner prize judging

**Official:** Partner judges evaluate submitted materials. Sponsor booth visits are optional and do not replace the formal submission. For each selected partner, explain the integration, give feedback and satisfy its track-specific qualifications.

**Bharaso sponsor checklist (subject to final sponsor selection):**

### World
- Show a meaningful trust gate, not merely a sign-in screen.
- For IDKit, demonstrate an appropriate credential, secure server/onchain verification, a successful flow and an alternative denied/cancelled/ineligible flow.
- For Agent Pass, follow that separate track's exact requirements; do not conflate it with IDKit.
- Explain why a proof of unique humanity is useful but **does not prove purchase, delivery, seller honesty or identity in the legal sense**.
- Enforce one review per verified human **per eligible purchase**, with a purchase entitlement and nullifier/uniqueness design that respects privacy and proof scope.
- Supply the sponsor's required integration feedback.

### Arkiv
- For the from-scratch Build on Arkiv track, demonstrate an actual **write and user-visible read** using the current testnet, not an unused SDK or archival-only log.
- Publish wallet address(es) that wrote entities and a reproducible query.
- Include `arkiv/schema.md`, `arkiv/friction.md`, `arkiv/reach.md`, `arkiv/why-arkiv.md`, `arkiv/how-you-use-arkiv.md` (as applicable to the selected track).
- Explain entity ownership, queryable fields, expiration and why cross-app queryability matters.
- Include an open-source license and AI-use disclosure.

### Third sponsor
- **Do not treat any tentative third sponsor as selected until its precise bounty requirements are verified.** Confirm its required chain, SDK/contracts, live transaction evidence, submission artifacts and eligibility before committing.
- Build a meaningful integration, not a logo or dependency installation.

## 10. Architecture and safety claims to be precise about

**Do not claim Bharaso eliminates COD fraud across all platforms.** The proposed architecture can serve independent sellers and integrating stores; adoption, payment rail support, fulfillment verification, dispute handling and fraud prevention remain real limitations. A checkout button cannot automatically protect transactions completed entirely outside Bharaso.

**Do not claim World ID means 'one review per real person' without qualification.** World ID may help prevent repeated unique-human submissions, but eligibility still requires a verified completed order, scope-specific replay protection and secure verification.

**Do not promise fiat COD escrow if the demo only supports crypto/stablecoin prepayment.** Explain the bridge from a working stablecoin pilot to eventual Indian merchant/payment integrations and any legal/compliance dependencies.

**Do not store sensitive buyer information or plaintext order details on a public data chain.** Use pseudonymous identifiers, minimal public fields and appropriate private storage.

## 11. Required deliverables and recommended repository layout

```text
bharaso/
├── README.md                 # setup, demo, sponsor integration, architecture
├── LICENSE                   # open-source license
├── AI_USAGE.md               # AI assistance disclosure
├── docs/
│   ├── architecture.md
│   ├── trust-model.md
│   ├── limitations.md
│   ├── demo-script.md
│   └── evidence.md            # tx hashes, testnet links, queries
├── arkiv/
│   ├── schema.md
│   ├── friction.md
│   ├── reach.md
│   ├── why-arkiv.md
│   └── how-you-use-arkiv.md
├── apps/                     # storefront, checkout, dashboards
├── contracts/                # source and tests, if applicable
├── packages/                 # shared integration code
└── specs/                    # if spec-driven, include all required prompts/specs
```

This tree is a **recommended implementation layout**, not a universal ETHGlobal requirement. Add any other exact sponsor-specific filenames, feedback forms and artifacts.

## 12. Pre-submission acceptance checklist

- [ ] Track selection is correct; all work complies with start-fresh/continuity rules.
- [ ] Repo is public, functional and has authentic incremental commits.
- [ ] Reused assets/libraries are attributed.
- [ ] AI assistance and spec-driven prompts/artifacts are disclosed as required.
- [ ] README explains installation, testnet, environment variables, architecture and reproducible demo.
- [ ] No API secrets, private keys or buyer personal data are committed.
- [ ] Real end-to-end checkout is demonstrated; failures and refunds/denials are tested.
- [ ] World verification is server-validated; duplicate and failed review cases are blocked.
- [ ] Arkiv write and visible read are working; required `/arkiv/` files and query evidence are included.
- [ ] Third sponsor's exact bounty qualification checklist is satisfied.
- [ ] Demo video is 2–4 minutes, >=720p, with real human narration and no prohibited techniques.
- [ ] Project title, description, repo and all requested submission fields are complete.
- [ ] Correct three partner selections are chosen and integration/feedback fields filled.
- [ ] Finalist judging readiness: 4-minute live demo, 3-minute Q&A, fallback plan.
- [ ] Submission is completed **before 09:00 IST on 7 November 2026**.

## 13. Priority order when time is short

1. **Eligibility and submission:** do not risk disqualification or miss the deadline.
2. **One complete transaction:** seller → buyer → protected payment → outcome.
3. **Sponsor evidence:** World verification, Arkiv write/read and the chosen third sponsor's actual required integration.
4. **A real cross-platform portability moment:** same passport shown in two contexts.
5. **Negative-path tests:** duplicate review, failed proof, invalid payment or unauthorized release.
6. **Documentation and video:** reproducible repo, required feedback files, concise demo.
7. **Polish:** only after the functional and compliance requirements work.

## 14. What winning would require beyond eligibility

The official judging categories reward a project that is technically credible, original, functional, intuitive and memorable. The strongest Bharaso narrative is not simply “we put escrow on blockchain”; it is **“a buyer's verified commerce history and a seller's accountability can travel across social storefronts and integrated merchant websites, while protected settlement and review eligibility are enforced rather than asserted.”**

Demonstrate that statement with a live transaction, an independently queryable reputation record, and a denied fraudulent action. Be candid about what is prototype-only and what would be necessary to deploy in Indian commerce at scale.

---

**Primary basis:** User-supplied ETHGlobal Mumbai FAQ/rules text, 5 November 2026. Sponsor details additionally reflect the user's supplied ETHGlobal Mumbai prizes material; verify any sponsor-specific requirements against the live event page before submission.
