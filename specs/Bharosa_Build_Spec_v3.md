# Bharosa: Final Build Spec (v3)

**Pay with Bharosa: prepaid orders from small sellers, as safe as cash on delivery.**

ETHGlobal Mumbai 2026, From Scratch track. Written Thu 5 Nov 2026, ~10 PM IST. **Hard deadline: Sat 7 Nov, 9:00 AM IST. Aim to submit by 7:00 AM.**

This file replaces three earlier documents: `Bharosa_Final_Spec.md` (v2), `BHAROSA_MASTER_PLAN.md`, and the critique list. Where they disagree, section 3 says which one wins and why. Anything marked **UNVERIFIED** has not been confirmed from docs or a mentor; section 13 lists them as go/no-go gates.

---

## 0. The verdict, in one screen

**What we build.** One protected checkout that sellers reach two ways: a **link/QR** they paste into Instagram or WhatsApp, and a **"Pay with Bharosa" button** on a small website. Money sits in a Whitechain contract. It is released only when the **buyer's own delivery code** is entered at the doorstep, and refunded automatically if a deadline is missed. Every completed order can produce one **World-verified review per human per seller**, stored on Arkiv in a form that Bharosa can't edit. Any other app can read that reputation.

**The three things a judge must remember:**
1. **"If it doesn't arrive, you get your money back, automatically. Nobody can stop that refund, including us."**
2. **"The money is released by the buyer's code at the door, the same way cash is handed over in COD. Our courier key can't release a single rupee."**
3. **"A seller's reputation is earned only from protected deliveries, counts each human once, and lives on Arkiv, where any app can read it."**

**What we cut:** the COD-deposit mode, the courier oracle as a release trigger, Chainlink CRE, the gasless relayer, the full catalogue/storefront builder, the indexer/reconciliation service, the buyer COD score/ZK, and the monorepo with five packages. Reasons are in section 3.

**The one thing to remember:** a small product that works end to end and defends itself live beats a big spec that's half built. Every decision below makes the build smaller without weakening those three sentences.

---

## 1. Judge's review of where we are (read this critically)

I scored the three existing documents the way an ETHGlobal finalist judge would, out of 10 per criterion. This is my judgment, not data.

| | Technicality | Originality | Practicality | Usability | Wow | Main problem |
|---|---|---|---|---|---|---|
| v2 spec (COD deposit + courier oracle) | 6 | 6 | 6 | 6 | 5 | The money moves on a fact signed by our own key. The COD deposit forfeits on a "refused" report that we also sign. A sharp judge sees two trust holes in the core. |
| Master plan (EIP-712 + Commerce Passport) | 7 | 5 | 5 | 5 | 6 | Very well reasoned, but it's an enterprise build (indexer, reconciliation states, Prisma, 5 packages, 2 apps) for a team that hasn't confirmed who can write Solidity. It also never solves "the buyer just never clicks accept." |
| **This spec (v3)** | **8** | **7** | **8** | **8** | **8** | Still depends on a simulated courier and a team-run arbiter. Both are stated openly. |

### Why I'm confident v3 is the right shape

- **Prior art is crowded** (section 2). Escrow + reviews + World ID alone scores about 4/10 on originality. Judges have seen zBay, OathLock, Legit Reviews, World P2P, P2P Safety and Shippr.
- **The two things nobody built:** (a) release money with a **buyer-held secret entered at the doorstep**, which maps exactly onto India's COD habit and removes the delivery oracle, and (b) **one checkout that lives inside Instagram DMs and on small websites**, with reputation readable by apps we don't control.
- **The original thesis had a fatal sentence:** "a fake review now costs a real order." It doesn't. It costs about one shipment (₹60 to ₹120), roughly what brushing costs today. v3 never says it. See section 10.

---

## 2. Prior art, and the one line on how we differ

Name these in the README. Hiding them is worse than having them. Judges search the showcase.

| Project (event) | What it did | How Bharosa differs |
|---|---|---|
| zBay (Waterloo 2023, finalist) | eBay-style marketplace, escrow, imported reputation, zk receipt proof, UMA disputes | We're not a marketplace. The checkout lives in Instagram DMs and on other sites. Release is by the buyer's doorstep code, not a dispute oracle. |
| OathLock (New York 2025, Zircuit 1st) | USDC e-commerce escrow, deadline settle, **negative-only** reputation on EAS | We keep positive reviews but make them fade, while bans and lost disputes never fade (they live in contract counters). Defend this choice in Q&A. |
| Legit Reviews (Waterloo 2023) | Reviews only from World-verified buyers with a proof-of-payment NFT | Same thesis for reviews. Ours adds one review per human **per seller**, delivery-gated eligibility, and Arkiv records Bharosa can't edit. |
| World P2P (Bangkok, World pool prize) | P2P crypto-fiat trading, escrow vaults, World ID login, third-party disputes | Different market. We use World only at the review moment, not as a login. |
| P2P Safety (StarkHack, Dynamic prize) | Escrow add-on for second-hand marketplaces; buyer confirms receipt | "Buyer confirms" stalls if the buyer goes silent. Our code is entered at handover, and deadlines finalize everything. |
| Shippr (LFGHO), PODOnChain (ETHOnline 2025) | Escrow released by courier tracking via Chainlink, or by a signed delivery oracle | We deliberately **don't** let a courier oracle release money. The courier can only escalate a case to a human. |
| Repute (Waterloo 2023) | OTC escrow, attestor confirms delivery, World ID | Attestor-released; ours is released by a buyer secret. |
| GoKwik, Shiprocket (off-chain, India) | Checkout tools that cut failed-COD returns for D2C brands **(not re-checked tonight)** | Their protection is a company's promise and their data is theirs. Ours is enforced by a contract that nobody can override, and the reputation moves with the seller. |
| A ₹99 "COD commitment fee" (D2C ethnic-wear brand, 2026 trade article) | Off-chain deposit; reported 40% drop in returns | Evidence that sellers want buyer commitment. It's our roadmap "Assured COD" mode. |

**Our honest novelty claim** (originality is in the combination, not in escrow): doorstep-secret release + Instagram/website entry points + one-human-per-seller reviews that fade while penalties don't + a reputation record that Bharosa can't edit and others can read.

---

## 3. Decisions where our documents disagreed

| # | Question | v2 spec said | Master plan said | **v3 decision** | Why |
|---|---|---|---|---|---|
| 1 | What releases the money? | Courier oracle signs "delivered" after OTP | Buyer clicks "accept" | **Hash-locked delivery code.** The buyer's phone creates a secret; only its hash goes on-chain at payment. At the door, the courier scans or types it, and the contract checks it. After the dispute window, anyone can finalize. | Removes our key from the release path. Fixes "buyer never clicks accept" because the code is handed over at the door, like cash. |
| 2 | What can the courier key do? | Release money | (no courier) | **Only one thing: move a Shipped order to Disputed** ("delivered, but buyer refused to give the code"). | The worst a compromised courier key can do is send a case to a human. That's a great Q&A line. |
| 3 | COD-with-deposit mode | MUST | Future | **Roadmap only** | Forfeiting the deposit needs a trusted "refused" report, which brings back the oracle problem. It also doubles the state machine. Mention "Assured COD" in one sentence. |
| 4 | Storefront | Link + badge | Full hosted catalogue + editor | **Product page per listing** (`/p/<id>`) plus a seller page listing their products. No catalogue editor beyond "add product". | The demo needs one product. The catalogue doesn't win prizes. |
| 5 | Order terms | Plain parameters | EIP-712 signed agreement | **EIP-712 seller-signed Offer** | It's what makes `pay()` safe: a buyer can't invent a price or deadlines. It also powers the terms card and gives the "listing changed, your order didn't" demo for free. |
| 6 | Where World is used | Buyers (COD identity) and reviews | Reviews only | **Reviews only.** Buying never needs World. Sellers are anchored by handle proof plus wallet. | Minimum sufficient credential (IDKit judges reward this). World availability in India is unconfirmed; never block a purchase on it. |
| 7 | World scoping | Per-order action | Per-merchant if supported | **One Portal action `review`, unlimited verifications. Backend enforces one row per (nullifier, seller). Publish `keccak256(nullifier, sellerId)` to Arkiv, never the raw nullifier.** | World's docs say actions are created in the Developer Portal, and the nullifier is fixed per user + app + action. So per-seller dynamic actions probably aren't available (**UNVERIFIED**). This design still gives one review per human per seller, and the public can't link a person across sellers. |
| 8 | Seller handle proof | Reclaim zkTLS | Not required | **Reclaim, time-boxed to 90 minutes. Fallback: a code in the Instagram bio, checked by staff in the admin panel and labelled "staff-verified". Last resort: "Unverified handle" shown in amber.** | Instagram blocks server-side profile fetches often, so an automatic bio check is unreliable (**UNVERIFIED**). Never show an unproven handle as verified. |
| 9 | Who owns reviews on Arkiv | Attestor wallet, buyer signature inside | Not decided | **Attestor creates the review as `readonly`, then transfers ownership to the buyer's wallet.** | Arkiv SDK 1.0: readonly entities can't be patched by anyone; the owner can delete; transfer needs no recipient consent. Result: Bharosa vouches (`$creator`), the buyer owns it (`$owner`), nobody can edit it, and Bharosa can no longer delete it. That answers "your commons is just your database." |
| 10 | Bad history | Arkiv entities with expiry | Arkiv | **Bans and lost disputes are counters in the Whitechain contract (permanent). Positive reviews live on Arkiv and fade (about 180 days, Rabdi's max lifetime).** | Asymmetric decay: good reputation must be re-earned, bad history never expires. That's a better "why expiry" story than "everything expires." |
| 11 | Indexer | — | Full event indexer with reconciliation states | **No indexer.** After each on-chain step, the API reads the transaction receipt, checks the event, then writes Arkiv. A "re-sync" button on the proof page covers failures. | One endpoint instead of a service. Same guarantee for the demo. |
| 12 | Gas for buyers | Relayer (Whitechain Scale) | Stretch | **Cut the relayer. "Test-mode wallet":** the checkout creates a burner wallet in the browser and our faucet endpoint sends it a capped amount of WBT + test USDT. Clearly labelled. | The judge pays without installing MetaMask. Whether the test USDT supports `permit` is unknown. We don't claim the Scale track. |
| 13 | Chainlink CRE | Dropped | Not used | **Not used** | It would be a fourth sponsor, and the doorstep code removed the need for it. |
| 14 | Arkiv vs ENS swap gate | Swap at hour 3 | Arkiv | **Keep Arkiv.** Gate only if Arkiv writes fail outright by 2 AM. | Arkiv's official agent skills repo (SDK 1.0.x, verified 30 Oct 2026) removes most SDK guesswork. Point your coding agent at it. |
| 15 | Seller payout speed | — | — | **SHOULD: reputation-tiered dispute window**, computed on-chain from the contract's own counters. | Turns reputation into cash flow. Answers "my money is stuck." |
| 16 | Second reader of Arkiv | Badge widget (stretch) | Separate merchant-demo app | **Merchant demo store (MUST) with its own server and its own Arkiv key**, showing the seller's trust card read directly from Arkiv. Chrome extension = STRETCH. | Proves portability honestly: a separate app reading Arkiv, not calling Bharosa's API. |

---

## 4. The product

### 4.1 The promise (the landing page headline)

> **If it doesn't arrive, you get your money back. Automatically.**

The second line, for sellers:

> **Prepaid buyers don't refuse parcels.**

Evidence for the second line (secondary sources, re-check before putting on a slide): COD is about 60–65% of Indian e-commerce orders; 25–30% of COD orders come back versus 2–3% for prepaid; social commerce sees 35–40% (ET Prime Research via Dazeinfo, 2024). Each failed delivery costs the seller about ₹180–500 (2026 trade article).

### 4.2 Two signals, never mixed

| Signal | What it promises | Enforced by |
|---|---|---|
| 🛡 **Protected** | Your money is safe even if the seller is a scammer. | Whitechain contract: deadline refunds, doorstep-code release. |
| ⭐ **Verified reputation** | Reviews come from real, unique humans who paid and received the item, counted once per seller. | World + on-chain order state + Arkiv. |

We never say "this seller is good." We say "your money is safe" and "these reviews are real."

### 4.3 Who's in the demo

| Role | Real or simulated |
|---|---|
| Seller (team member) | Real |
| Buyer (judge, on a phone we hand them) | Real |
| Courier | **Simulated, labelled "Simulated courier"** |
| Arbiter (team) | Real, stated trust assumption |
| Merchant demo store | Real, separate deployment |

### 4.4 The story we demo (Meera and Arjun)

Meera sells silver jhumkas (₹899) as **@meera.jewels**.

1. **Onboarding (timer on screen, under 60 s).** Meera proves her handle, connects a wallet, adds one product (photo, price, ships within 3 days). She gets a link, a QR and a badge.
2. **Checkout.** Arjun opens the link from her DM. He sees the protection banner, Meera's trust card (completed orders, refunds, disputes, verified reviews, each with counts) and the **terms card**:
   > 🛡 Ships by 8 Nov, or you're refunded automatically
   > 📦 Arrives by 14 Nov, or you're refunded automatically
   > 🔑 Meera is paid only when you give your delivery code
   > ⏱ 2 days after delivery to report a problem
   > ✅ Verify these terms on-chain →
3. **Pay.** He taps Pay. The browser generates his delivery secret and keeps it. Only the hash goes on-chain.
4. **Ship.** Meera marks it shipped with a tracking number.
5. **Delivery.** The courier simulator scans Arjun's QR (or types his 6-word code). The contract checks it. The state becomes Delivered.
6. **Release.** The dispute window ends; anyone calls `finalize`; Meera withdraws.
7. **Review.** Arjun verifies with World and leaves a review. It appears on Meera's verify page and on the separate demo store, read from Arkiv.

### 4.5 When things go wrong

| What happens | What Bharosa does | Who triggers it |
|---|---|---|
| Seller never ships | After the ship-by deadline, full refund | Anyone (`finalize`) |
| Parcel lost or never arrives | After the deliver-by deadline, full refund | Anyone |
| Buyer receives the parcel but won't give the code | Courier reports "handover refused" → Disputed, not refunded | Courier key → arbiter |
| Item wrong, fake or broken | Buyer opens a dispute inside the window with photos/unboxing video → arbiter: refund, release or split | Buyer → arbiter |
| Seller edits the listing after payment | The order keeps the signed terms hash; the dispute screen shows "agreed vs current" | Automatic |
| Scammer shows Meera's badge | The badge **is** the payment link; it can only pay Meera. Unknown handles show red. | — |
| Courier key is stolen | It can only push orders into dispute. It can't move money. | — |
| Same human tries a second review for Meera | Rejected (same nullifier + seller) | Backend |
| Banned seller re-registers | Blocked: wallet and handle hash are both banned | Contract |

---

## 5. Architecture

```
Instagram DM / bio            Small website (separate deploy)
  link or QR                    "Pay with Bharosa" button
      \                              /         \
       v                            v           \ reads Arkiv itself
   [Bharosa web app: Next.js on Vercel]          \ (own key, own server)
    /onboard /p/<id> /o/<id> /verify/<handle>    [Merchant demo store]
    /dashboard /courier /arbiter /proof
        |            API routes (same app)
        |   - handle proof + attestor signature
        |   - test-mode faucet (capped)
        |   - courier simulator (holds courier key)
        |   - review: World proof check -> Arkiv write -> transfer to buyer
        |   - sync: read tx receipt -> write Arkiv outcome
        |   - Postgres (Supabase/Neon): listings, encrypted address, nullifier table
        v
 [Whitechain Sepolia, chain 1874]        [Arkiv Rabdi, chain 7794095]
   BharosaCheckout + SellerRegistry        bharosa_seller_v1
   holds the specified test USDT           bharosa_review_v1 (readonly, buyer-owned)
   counters: completed, lostDisputes       bharosa_outcome_v1
```

### 5.1 Stack (chosen for a small team on Windows)

| Layer | Choice | Notes |
|---|---|---|
| Frontend + API | **One Next.js (TypeScript, Tailwind) app on Vercel**, API routes for the backend | No separate backend host. |
| DB | Supabase or Neon Postgres (free tier) | Private data only: listings, buyer contact details (encrypted), World nullifiers, faucet log. |
| Contracts | Solidity 0.8.x, OpenZeppelin (`SafeERC20`, `ECDSA`, `EIP712`, `ReentrancyGuard`) | |
| Contract tooling | **Foundry** (invariant + fuzz tests). On Windows, use WSL or Git Bash. Fallback: Hardhat 3 if Foundry won't install within 30 min. | Node 26 is very new; if Hardhat complains, use Node 22 LTS via nvm-windows. |
| Chain client | viem + wagmi | Burner wallet: viem `generatePrivateKey` in localStorage (testnet only, labelled). |
| Arkiv | `@arkiv-network/sdk` **1.0.x**, server-side only | Install Arkiv's official agent skills (`github.com/Arkiv-Network/skills`) into your coding agent. They contain verified SDK 1.0.1 recipes. |
| World | IDKit (React) + backend verification | Simulator: simulator.worldcoin.org |
| Handle proof | Reclaim JS SDK (Instagram provider) | Time-boxed. **UNVERIFIED** that it works for us. |
| Demo store | Separate tiny Next.js app on its own Vercel URL | Its own Arkiv access key. |

---

## 6. Contracts

Keep the whole thing about 300 lines so it can be tested properly. Two contracts, or one if the Solidity person prefers.

### 6.1 The signed offer (EIP-712)

The seller signs an Offer once per listing, in the browser, when adding a product. The buyer submits it with payment.

```solidity
struct Offer {
    address seller;
    bytes32 listingId;
    bytes32 termsHash;      // keccak256 of canonical listing JSON: title, variant, image hashes, return policy
    uint256 price;          // in test-USDT base units
    uint32  shipWithin;     // seconds after funding (demo: 180; production: 3 days)
    uint32  deliverWithin;  // seconds after shipping (demo: 300; production: 7 days)
    uint32  maxUnits;       // stock cap for this offer
    uint64  validUntil;     // offer expiry
    uint256 version;        // seller can revoke all offers below a version
}
// domain: name "Bharosa", version "1", chainId 1874, verifyingContract = checkout
```

### 6.2 BharosaCheckout

```solidity
enum State { None, Funded, Shipped, Delivered, Disputed, Released, Refunded, Split }

struct Order {
    address buyer; address seller; uint256 amount;
    bytes32 termsHash; bytes32 codeHash; bytes32 trackingHash;
    uint64 fundedAt; uint64 shipBy; uint64 shippedAt; uint64 deliverBy;
    uint64 deliveredAt; uint32 disputeWindow; State state;
}

function pay(Offer calldata o, bytes calldata sellerSig, bytes32 codeHash) external returns (uint256 orderId);
// checks: valid sig, not expired, version not revoked, units left, seller active & not banned
// pulls o.price of the specified USDT via SafeERC20; stores order; emits OrderFunded

function markShipped(uint256 id, bytes32 trackingHash) external;          // seller, state Funded, before shipBy
function confirmDelivery(uint256 id, bytes calldata code) external;       // ANYONE (courier); state Shipped;
    // require keccak256(abi.encodePacked(block.chainid, address(this), code)) == codeHash
function confirmReceived(uint256 id) external;                            // buyer, state Shipped (same effect)
function reportHandoverRefused(uint256 id) external;                      // courier role only; Shipped -> Disputed
function openDispute(uint256 id, bytes32 evidenceHash) external;          // buyer; Delivered and inside window
function resolveDispute(uint256 id, uint16 buyerBps, bytes32 decisionHash) external; // arbiter; Disputed
    // buyerBps > 5000 => lostDisputes[seller]++
function finalize(uint256 id) external;                                   // ANYONE:
    // Funded  && now > shipBy                      -> Refunded (full)
    // Shipped && now > deliverBy                   -> Refunded (full)
    // Delivered && now > deliveredAt+disputeWindow -> Released (minus feeBps), completed[seller]++
function withdraw() external;                                             // pull payment
function revokeOffersBelow(uint256 version) external;                     // seller
```

**Dispute window by tier (SHOULD), computed from the contract's own counters:**

```solidity
function windowFor(address s) public view returns (uint32) {
    return (completed[s] >= TRUSTED_MIN && lostDisputes[s] == 0) ? SHORT_WINDOW : LONG_WINDOW;
    // demo: 3 orders, 30 s vs 120 s. production: 1 day vs 7 days.
}
```

It's set at the moment of delivery. Limitation to state: a seller can farm the counter with self-orders; each costs a real shipment and fee, and it only shortens the buyer's window, never removes the deadline refund.

### 6.3 SellerRegistry

```solidity
function registerSeller(address seller, bytes32 handleHash, uint8 handleTier, bytes calldata attestorSig) external;
// handleTier: 2 = cryptographic proof (Reclaim), 1 = staff-verified bio code, 0 = unverified
// one active seller per handleHash; attestor signature binds (seller, handleHash, handleTier, chainId, nonce)
function ban(address seller) external;   // arbiter; bans the wallet and its handleHash permanently
function isActive(address seller) external view returns (bool);
```

### 6.4 The delivery code (get this exactly right)

- **Secret:** 128 random bits, generated in the buyer's browser (`crypto.getRandomValues`), never sent to our server.
- **Shown two ways:** a QR holding the full secret (primary), and a **6-word code** from the BIP-39 wordlist (66 bits) for reading aloud. Both decode to the bytes hashed into `codeHash`. (Simplest: the 6 words *are* the secret, and the QR just encodes the words.)
- **Why not 6 digits:** the hash is public. A million options can be tried on a laptop in about a second. 66 bits takes years even on a GPU farm.
- **Binding:** `keccak256(chainid, contract, code)` stops reuse across deployments. The courier front-running risk is nil: anyone who copies the code can only do the same thing, release to the seller.
- **Lost code:** the buyer can still tap "I received it" (`confirmReceived`) from the same browser wallet. If both are lost, the deliver-by deadline refunds or it goes to dispute.
- **UX copy:** "This is your delivery code. Only show it to the courier when the parcel is in your hand."

### 6.5 Tests to show judges (state the count in the pitch)

**Invariants (Foundry):**
- Token balance held = sum of open order amounts + all credited balances + fees.
- An order reaches exactly one terminal state.
- No release without (correct code or buyer confirmation) **and** an expired window, or an arbiter ruling.
- The courier role can never increase any seller's credited balance.
- Banned sellers can't receive new orders.

**Unit tests for every failure path:** wrong code, code replay on another order, late ship, refund before deadline, dispute after window, non-buyer dispute, non-arbiter resolve, expired/revoked offer, tampered offer price, over-stock, double withdraw.

**Fuzz:** amounts, deadlines, split bps.

---

## 7. Arkiv design

Target SDK `@arkiv-network/sdk` 1.0.x on Rabdi (chain 7794095). Facts below come from Arkiv's own SDK 1.0.1 skill notes (verified by them 30 Oct to 3 Nov 2026). Re-check the installed package before coding.

Relevant SDK facts:
- Schemas are typed (`defineSchema`, `str`, `u64`, `u256`, `addr`, `bytes`); only `.indexed()` columns can be filtered.
- Strings are max 128 bytes; 31 named columns per schema.
- Expiry is in blocks (about 2 s each). The Rabdi maximum is 7,884,000 blocks (about 182 days).
- Flags `readonly` and `permissionlessExtension` are fixed at creation. Readonly means nobody can patch; the owner can still delete or transfer.
- `$creator` stays the original writer; `$owner` changes on transfer.
- Queries read current state only. Each costs 10 quota units out of 100M per key.
- **Keep access keys server-side.** Browsers must not get our key.

### 7.1 Schemas

| Schema | Indexed columns | Other columns | Expiry | Flags | Owner |
|---|---|---|---|---|---|
| `bharosa_seller_v1` | `seller` (addr), `handle` (str), `handle_tier` (u64), `status` (str) | `display` (bytes JSON: name, city, categories) | ~180 days, renewed while active | not readonly (status can change) | attestor |
| `bharosa_review_v1` | `seller` (addr), `order_id` (u256), `rating` (u64), `created_at` (u64), `reviewer_key` (str: hex of keccak(nullifier, seller)), `buyer_history` (u64: 1, 2–5, 6+ bucket) | `text` (bytes, ≤ 500 chars), `pay_tx` (str), `buyer_sig` (bytes) | max (~182 days) | **readonly**, permissionlessExtension false | created by attestor, **transferred to buyer wallet** |
| `bharosa_outcome_v1` | `seller` (addr), `order_id` (u256), `outcome` (str: released / refunded / dispute_buyer / dispute_seller / split), `settled_at` (u64) | `tx` (str) | max | readonly | attestor |

Every entity is scoped by its named schema. Add `project: "bharosa-mumbai-2026"` inside the JSON bytes if the sponsor asks for a project attribute (**UNVERIFIED** whether they still require it under SDK 1.0 schemas).

### 7.2 Trust rules for anyone reading

A reader (our verify page, the demo store, a third party) should:
1. Accept only rows whose `$creator` is the published Bharosa attestor address, and only readonly rows for reviews/outcomes.
2. Optionally re-check `pay_tx` on Whitechain (the proof page does this).
3. Show counts with denominators, never an opaque score: "37 protected orders · 1 refund · 0 disputes lost · 12 verified reviews (8 from repeat buyers)."
4. Weight by `created_at` (recency), not by whether the entity still exists. A buyer extending their own review doesn't make it count more.

### 7.3 One runnable query for the README

```json
{"jsonrpc":"2.0","id":1,"method":"arkiv_query",
 "params":["arkiv.schema = str('bharosa_review_v1') ORDER BY $key:key ASC",
           {"select":{"key":true,"owner":true,"creator":true,"attributes":true},"limit":"0x14","offset":"0x0"}]}
```
POST it to `https://rpc.rabdi.db-chain.testnet.arkiv.network/<your free access key>`. Check the exact grammar against the installed SDK; add a seller filter once confirmed.

### 7.4 The "why Arkiv" answer (25% of their score)

- **Ownership that limits us:** reviews are readonly and buyer-owned. Bharosa vouched for them, but can't edit or delete them afterwards.
- **Reach:** a separate app (the demo store) reads the same reputation with its own key, without calling our API.
- **Expiry as policy:** good reputation fades and must be re-earned; bans and lost disputes are permanent on Whitechain. We chose what fades on purpose.
- **What we keep off Arkiv:** money (Whitechain), permanent penalties (Whitechain counters), personal data (our encrypted DB). Saying this shows judgment.

---

## 8. World IDKit design

- **Action:** one Developer Portal action, `review`, max verifications unlimited (**UNVERIFIED** that the portal allows this setting).
- **Signal:** `orderId` + buyer wallet, so a proof can't be replayed for another order.
- **Credential:** whichever the simulator offers at the lowest level that gives uniqueness. Write one paragraph on why reviewing needs uniqueness and buying doesn't.
- **Backend check (in order):**
  1. Verify the proof with World's API.
  2. The order is `Released` on-chain, and the requester's wallet signature matches `order.buyer`.
  3. Insert `(nullifier, seller)` into a unique-constrained table. A conflict means a duplicate → reject.
  4. Write the Arkiv review, then transfer it to the buyer.
- **Demo paths:** success; duplicate human for the same seller (second wallet, second completed order) → rejected; cancelled verification → no review; verified human with no completed order → rejected.
- **Debrief file:** time to first success, friction, missing docs, top improvement. Start the log at hour one.

---

## 9. Screens

Mobile first. Rupees next to USDT (labelled "test value"). Never say "escrow", "chain 1874" or "nullifier" on buyer screens.

| Route | What's on it | Priority |
|---|---|---|
| `/` | "If it doesn't arrive, you get your money back." Buttons: "I sell on Instagram", "Check a seller" | MUST |
| `/onboard` | Handle proof → wallet → one product (signs the Offer) → link, QR, badge. Visible timer. | MUST |
| `/p/<listing>` | Product, trust card, terms card, Pay. Test-mode wallet auto-funds. | MUST |
| `/o/<order>` | Timeline, delivery code (QR + 6 words), "I received it", "Something wrong?" inside the window, review prompt after release | MUST |
| `/verify/<handle>` | Live from Arkiv + contract counters. Unknown or banned → big red "Not a Bharosa seller". | MUST |
| `/dashboard` | Orders by state, Mark shipped, Withdraw, CSV export with tx hashes | MUST (CSV = SHOULD) |
| `/courier` | "SIMULATED COURIER". Picked up → In transit → Out for delivery → Scan code / Handover refused | MUST |
| `/arbiter` | List of disputes, evidence, agreed vs current listing, Refund / Release / Split | SHOULD (a plain page is fine) |
| `/proof` | Every tx hash, contract addresses, Arkiv entity keys + runnable query, World results, test count, re-sync button | MUST |
| Demo store (separate URL) | "Kurta Co." product page, Pay with Bharosa button → our checkout; trust card read from Arkiv by its own server | MUST |
| Chrome extension | On `instagram.com/<handle>`, the popup shows the trust card (reads the handle from the URL only) | STRETCH |

---

## 10. Claims we make and claims we never make

| ✅ Say | ❌ Never say |
|---|---|
| "If it doesn't arrive, you get your money back automatically. Nobody can stop it, including us." | "Trustless." |
| "Fake reviews get much harder and more expensive: each needs a real shipment and a unique human, and counts once per seller. Reviews from one-time buyers are shown separately." | "A fake review now costs a real order" / "impossible to fake." |
| "Our courier key can't move money; it can only send a case to a human." | "Delivery is verified on-chain." |
| "Disputes about quality are decided by our arbiter today. That's the centralised part, and here's the path out." | "Disputes are decentralised." |
| "Test USDT on testnet. Real Indian rupee payments need a licensed on-ramp; that's our biggest go-to-market problem." | "Buyers in India will pay in stablecoins." |
| "First market where stablecoins are honestly better: diaspora buyers paying Indian sellers, where COD doesn't exist." | "Works on Amazon." |

---

## 11. The 4-minute finalist demo

Pre-seed orders in several states before going on stage: one about to miss its ship-by deadline, one Delivered with an open window, one Disputed. Rehearse 5+ times. Keep a recorded backup on a laptop.

| Time | Beat | What the judge should feel |
|---|---|---|
| 0:00–0:20 | "Hands up if you've hesitated before paying an Instagram store. 35–40% of social-commerce COD parcels come back, and each costs the seller up to ₹500. Both sides lose." | I have this problem. |
| 0:20–0:50 | Meera onboards, timer on screen, under 60 s. Link + QR. | That's easy. |
| 0:50–1:25 | Hand the judge the phone. They open the link: terms card, Pay. Test-mode wallet, no MetaMask. Explorer tx on the side screen. | I just used it. |
| 1:25–1:55 | Courier sim: "Handover refused" first → it goes to dispute, no refund. Then the judge shows the code; courier scans; Delivered. | The courier can't cheat, and neither can the buyer. |
| 1:55–2:20 | Window ends (short demo window), `finalize`, Meera is paid. Judge verifies with World and leaves a review. | Money moved on its own. |
| 2:20–2:50 | The review appears on `/verify/meera.jewels` **and** on the separate demo store, read from Arkiv. Scan a fake badge: red. | I can check this myself. |
| 2:50–3:30 | Attacks: pre-seeded order passes its ship-by → anyone presses refund, money back. Second review from the same human → rejected. Banned seller → can't take orders. | It defends itself. |
| 3:30–4:00 | "If it doesn't arrive, you get your money back, and nobody, not even us, can stop it. Next: a licensed rupee on-ramp and Assured COD." Mention the test count. | This could be real. |

**Video (2–4 min, ≥720p, real voice, not sped up):** same arc. Show all four parties. Put tx hashes on screen.

### Judge questions to rehearse

| Question | Answer |
|---|---|
| Why not Razorpay? | Razorpay can hold and reverse funds; that's a company's promise. Our deadline refund can't be overridden by anyone, including us, and the seller's reputation isn't locked inside our database. |
| Isn't this just escrow? | Escrow is one piece. The new parts: release by the buyer's doorstep code (no delivery oracle), signed terms that the seller can't change after payment, one-human-per-seller reviews that Bharosa can't edit, and a checkout that works inside Instagram DMs. |
| How do you know it was delivered? | The buyer gave their code at the door, like handing over cash in COD. Without it, the courier can only escalate to a dispute. |
| What if the item is fake or broken? | That's the hard part, and today our arbiter decides, with the unboxing video and the signed terms. It's the centralised piece, and we say so. |
| Can sellers still farm reviews? | Yes, by paying real shipping for each, finding a different human each time, and every one counts once. We show what share of reviews come from one-time buyers. Much more expensive, not impossible. |
| Why keep positive reviews? OathLock went negative-only. | Negative-only can't tell a great new seller from a new scammer. We keep positives but make them fade, while penalties never fade. |
| Who holds USDT in India? | Nobody in this demo; it's testnet. In production, a licensed partner converts rupees. Indian crypto tax and payment-aggregator rules are real hurdles we haven't solved (as far as we know: 1% TDS, 30% tax on gains, FIU-IND registration, RBI PA rules; verify before quoting). That's why diaspora buyers are the honest first market. |
| What if Bharosa disappears? | Funds stay in the contract; `finalize` and `withdraw` are public. Reviews stay on Arkiv, owned by buyers. The website and review gating would stop. |
| Remove World / Arkiv / Whitechain: what breaks? | World: one person could review a seller many times with many wallets. Arkiv: the reputation becomes our private database again. Whitechain: the refund becomes our promise instead of code. |

---

## 12. What makes this a winner (checklist)

1. Lead with the promise, not the technology.
2. A judge pays live on a phone with no wallet setup.
3. The courier can't release money: show "handover refused" going to dispute.
4. Show attacks failing, live.
5. Two independent apps show the same reputation.
6. State the invariant test count.
7. A proof page with every hash.
8. No crypto words on buyer screens.
9. A one-sentence "why blockchain" (the refund nobody can stop).
10. An honest limitations section and named prior art.
11. Sponsor paperwork done by Friday 8 PM.
12. One quote from a real Instagram seller about COD returns. Message one tonight.

---

## 13. Go/no-go gates (do these before building features, by ~1 AM)

| # | Check | Who | If it fails |
|---|---|---|---|
| 1 | Whitechain mentor: does a **protected checkout** (delivery-code release, deadline refunds, merchant payouts, CSV export, embeddable button) count as Operate, not "standalone escrow"? | Lead | Lean harder on the merchant-integration framing (demo store, CSV, fee). Ask what would place. |
| 2 | Where do we get the **specified test USDT** (`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`), and how much? Enough to fund burner wallets? | Contracts | If scarce: the faucet gives 1–2 USDT per burner; products priced at 1 test USDT ≈ ₹899 (label it). |
| 3 | Whitechain explorer contract verification works (which verifier API?) | Contracts | Ask the mentor; verification is required. |
| 4 | World Developer Portal: can the `review` action have unlimited verifications? Does the simulator flow validate server-side? Any change in current IDKit (v4/World ID 4.0) flow? | Identity | If per-action limits are forced, create one action per demo seller (we only need 2–3 sellers for the demo) and say so. |
| 5 | Reclaim Instagram proof works in our browser within 90 min | Identity | Staff-verified bio code (tier 1), labelled honestly. |
| 6 | Arkiv: one create + one query + one ownership transfer works with SDK 1.0.x and our access key | Arkiv | Ask the Arkiv mentor at their table. Swap to ENS only if writes fail outright by 2 AM. |
| 7 | Foundry installs on at least one laptop (WSL or Git Bash) | Contracts | Hardhat 3, keeping the same test list. |

**Also ask mentors:** Arkiv: is attestor-create + transfer-to-buyer the right ownership pattern? Is fade-the-good / keep-the-bad a strong expiry story? World: is review-only the right minimum credential?

---

## 14. Scope: MUST, SHOULD, STRETCH, ROADMAP

**Rule: nothing in SHOULD starts until every MUST works end to end. Feature freeze Fri 8 PM.**

| Priority | Item |
|---|---|
| **MUST** | EIP-712 offer + `pay` with the specified test USDT, verified on the Whitechain explorer |
| **MUST** | Delivery-code release (`confirmDelivery`) + `confirmReceived` + `finalize` (both deadline refunds and release) + `withdraw` |
| **MUST** | `reportHandoverRefused` → Disputed + `resolveDispute` (arbiter page can be ugly) |
| **MUST** | Seller registry with handle tier + ban |
| **MUST** | Onboarding (handle proof or fallback, one product, link/QR/badge) |
| **MUST** | Product checkout with terms card + test-mode wallet + faucet (capped, rate-limited) |
| **MUST** | Order page with code QR + 6 words; courier simulator |
| **MUST** | World-gated review → Arkiv readonly entity → transfer to buyer; duplicate and cancelled paths |
| **MUST** | Verify page reading Arkiv + contract; red for unknown/banned |
| **MUST** | Separate demo store with "Pay with Bharosa" and its own Arkiv read |
| **MUST** | Proof page; Foundry tests (invariants + failure paths) |
| **SHOULD** | Reputation-tiered dispute window |
| **SHOULD** | Outcome entities on Arkiv (`bharosa_outcome_v1`) + buyer-history bucket on reviews |
| **SHOULD** | Seller CSV export with tx hashes; platform fee (`feeBps`) |
| **SHOULD** | "Agreed vs current listing" panel on disputes (blue bag vs red bag) |
| **STRETCH** | Chrome extension reading the trust card on instagram.com |
| **STRETCH** | Dispute evidence on Swarm with the hash in Arkiv (Arkiv's $500 bonus, only if Arkiv is solid) |
| **ROADMAP (say, don't build)** | Assured COD (buyer commitment deposit), licensed UPI on-ramp, real courier APIs, staked arbiters, seller working-capital credit from verified sales, Shopify/WooCommerce plugins |

**Cut order if time slips:** extension → CSV → tiered window → outcome entities → arbiter polish. **Never cut:** deadline refund, delivery code, review gate, verify page, demo store.

---

## 15. Team plan and timeline

Team size is still unknown. Assign Contracts to whoever is most comfortable with Solidity. If nobody is, say so now: the contract is about 300 lines and must be written first.

| Workstream | Owns | First milestone (by ~1:30 AM Fri) |
|---|---|---|
| A. Contracts | Offer/EIP-712, checkout, registry, Foundry tests, deploy + verify | `pay` → `markShipped` → `confirmDelivery` → `finalize` on Whitechain with real test USDT |
| B. Identity + API | World verification, handle proof, attestor signatures, faucet, courier sim | One simulator proof verified server-side |
| C. Arkiv + reputation | Schemas, writer, transfer, verify page data, demo-store reader, `/arkiv` docs | Create, query and transfer one review entity |
| D. Frontend + demo | All screens, terms card, QR, proof page, demo store UI, video, pitch | Checkout page paying from a burner wallet on a phone |

- **2 people:** A+C and B+D.
- **3 people:** A, B+C, D.
- **Keep one shared friction log from hour one.** Arkiv, Whitechain and World all score honest feedback.

| When (IST) | Goal |
|---|---|
| Thu 10 PM – 1:30 AM | Gates 1–7. Freeze the contract ABI, Offer struct, Arkiv schemas, API list. First commit. Each workstream hits its first milestone. Message one real Instagram seller. |
| 1:30 AM – 8 AM | Sleep in shifts (at least 4 h each). Contracts person finishes tests and deploys. |
| Fri 9 AM – 2 PM | One ugly end-to-end path: onboard → pay → ship → code → release → review → verify page → demo store. |
| Fri 2 PM – 8 PM | Refund paths, handover-refused, dispute, ban, fake badge, duplicate review, proof page, polish. |
| **Fri 8 PM** | **Feature freeze.** README, limitations, prior art, sponsor files, World debrief, `/arkiv` docs. |
| Sat 12 AM – 5 AM | Pre-seed demo orders, rehearse, record the video, record a backup demo. |
| **By Sat 7 AM** | **Submit.** Hard deadline 9 AM. |

---

## 16. Repo layout

```
bharosa/
├── contracts/            Foundry: src/, test/ (invariants + unit), script/Deploy.s.sol
├── web/                  Next.js app + API routes (checkout, onboarding, courier, arbiter, verify, proof)
├── demo-store/           separate Next.js app ("Kurta Co."), own Arkiv reader
├── arkiv/                schema.md, friction.md, reach.md, why-arkiv.md, how-you-use-arkiv.md
├── docs/                 architecture.md, threat-model.md, limitations.md, prior-art.md, demo-script.md,
│                         WORLD_DEBRIEF.md, AI_USE.md (+ these spec files)
├── WHITECHAIN_FEEDBACK.md
├── README.md             problem, why stablecoin settlement, architecture, addresses, tx links,
│                         Arkiv writer wallet + runnable query, setup, limitations
├── .env.example          (never commit .env; add it to .gitignore before the first commit)
└── LICENSE               MIT
```

---

## 17. Submission checklist

**ETHGlobal**
- [ ] Public repo, open-source license, steady commits from after 9 PM Thursday
- [ ] AI-use disclosure with these spec files and prompts
- [ ] Video 2–4 min, ≥720p, real narration, not sped up
- [ ] Live links: web app and demo store
- [ ] Exactly three partner prizes selected: Whitechain, Arkiv, World

**Whitechain (Operate)**
- [ ] Contracts deployed and verified on Whitechain Sepolia (1874)
- [ ] At least one payment in the specified test USDT; explorer links in README (pay, release, refund)
- [ ] README paragraph: why this flow needs on-chain stablecoin settlement (the refund nobody can override; cross-border buyers)
- [ ] Setup, architecture, limitations
- [ ] Video shows buyer, seller, courier and arbiter
- [ ] `WHITECHAIN_FEEDBACK.md`

**Arkiv (Build from Scratch)**
- [ ] Five files in `/arkiv/`: schema, friction, reach, why-arkiv, how-you-use-arkiv
- [ ] README lists the attestor (writer) wallet and one runnable query
- [ ] User-visible reads: verify page **and** demo store
- [ ] Not a write-only log

**World (Best Use of IDKit)**
- [ ] Full journey: request → completed → validated in backend → protected action (review published)
- [ ] Denied/cancelled path and duplicate path shown
- [ ] Credential choice explained (minimum sufficient)
- [ ] Integration debrief

---

## 18. Honest limitations (paste into the README)

- The courier is simulated. Release depends on the buyer's code, not courier data, but the "handover refused" escalation comes from our courier key.
- Quality disputes are decided by a team-run arbiter. Roadmap: staked or third-party arbitration.
- Handle proof uses alpha tooling (Reclaim) or a staff check; tiers are shown honestly.
- World proofs are validated by our backend; simulator credentials are not real-world identity. World availability in India is unconfirmed.
- Reviews are created by our attestor and then transferred to the buyer: we can refuse to write a review, but can't edit or delete one after transfer.
- A seller can still pay for real shipments to friends to farm reviews and the trusted tier. It's much more expensive, not impossible.
- Everything on-chain is public: seller volumes and buyer wallets can be linked. Roadmap: private settlement.
- Test USDT has no value. Real rupee payments need a licensed partner; Indian crypto tax and payment-aggregator rules are unsolved for us.
- The test-mode burner wallet lives in the browser's storage; testnet only.
- Market figures come from secondary sources and may be dated.

---

## 19. Sources used for this version

- Prior art: [zBay](https://ethglobal.com/showcase), [Legit Reviews](https://ethglobal.com/showcase/legit-reviews-t9fvo), [World P2P](https://ethglobal.com/showcase/world-p2p-nxfuc), [P2P Safety](https://ethglobal.com/showcase/p2p-safety-kvvjb), [Repute](https://ethglobal.com/showcase/repute-o46vp), [B4B AA](https://ethglobal.com/showcase/b4b-aa-8f36o); OathLock, Shippr, PODOnChain from the earlier search (context file).
- COD figures: [Dazeinfo, citing ET Prime Research](https://dazeinfo.com/2024/06/05/over-25-of-cod-orders-fail-a-major-dent-in-indias-e-commerce-business); [DFU Publications on COD commitment fees](https://dfupublications.com/index.php/news/apparel/india-s-online-fashion-growth-resets-with-commitment-fees-margin-discipline).
- World actions and nullifiers: [World ID docs, cloud/incognito actions](https://world-id-docs-efew5168v-main-worldcoin.vercel.app/world-id/id/cloud).
- Arkiv SDK 1.0.x: [Arkiv official agent skills repo](https://github.com/Arkiv-Network/skills) (first-write, query, entity-lifecycle, limits, known-issues, trust-boundary, app-integration).
- Name check: Airtel Payments Bank has a "Bharosa" product, and a "Bharosa365" scam-protection app exists. Fine for a hackathon; don't claim the name is unique.
