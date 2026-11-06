# Demo script

Two versions: the 4-minute live finalist flow and the 2 to 4 minute video. Written against the current UI. **We have not rehearsed it end to end by hand yet.** We checked the steps with end-to-end runs and by looking at the pages, but nobody has timed a full run with the real World Simulator, so rehearse before relying on the timings. Where a step depends on something we could not verify, it says so.

## Setup (30 minutes before, once)
1. Servers: PoP web and the Kurta store on testnet (see `docs/OVERNIGHT.md` for the start command), `npm run webhooks` in a third terminal. Open `/proof` and check the contract addresses match `docs/evidence.md`.
2. Wallets and balances (addresses only, never keys on screen): the test buyer needs about 6 test USDT and a little WBT; the seller wallet and courier need a little WBT. Check on `/proof` or the explorer.
3. Browsers. Use a laptop, a clean window, 125 percent zoom, notifications off.
   - **Buyer window**: in the console, `localStorage.setItem("pop:testwallet:testnet:1874:buyer", "<TEST_BUYER_PK>")`, then reload. Do this off camera.
   - **Seller window**: `/dashboard`, paste the demo seller test key, sign in. Off camera.
   - **Courier window**: `/courier`, sign in with the team passcode. Off camera.
   - **Arbiter window**: `/arbiter`, import the arbiter test key and sign in as staff. Off camera.
4. Seed the scenes **3 to 5 minutes before each segment that needs them**, because the windows are real time: `NETWORK_MODE=testnet ALLOW_DEMO_SEED=yes npx tsx scripts/seed-demo.ts` (export NETWORK_MODE after anything that sources `.env`). By default it runs only the **persistent** scenes, 4 and 5, which stay valid until someone acts on them: a banned seller (@bad.bazaar) with one open order, and a look-alike seller that is not registered (@meera.jewels.official). **Both were seeded on testnet on Fri 6 Nov** (open order #20; `/verify/bad.bazaar` banned, `/p/demo-fake-meera` Pay disabled), so there is nothing to seed for them again unless the order #20 refund has been used. The **timed** scenes need `--scenes=1,2,3` (or `--scenes=all`) and real seconds: an order near ship-by expiry, a Delivered order with the problem window open, a Disputed order. Seed those 3 to 5 minutes before the segment that needs them; they were not run on testnet.
5. World simulator: open https://simulator.worldcoin.org in a second tab, staging. Have the order #1 review step ready (`docs/OVERNIGHT.md`, ready-to-click checklist).
6. Close every tab you do not need. Hide bookmarks.

## 4-minute live flow (finalist judging)
| Time | Say | Do (exact clicks) |
|---|---|---|
| 0:00 | "A buyer who pays an Instagram seller first has no protection. PoP gives them a refund rule they can verify." | Show `/`. Point at the headline and the five steps. |
| 0:25 | "This is a normal checkout. Before I pay I see the seller's record and the refund deadline." | Open `/p/jhumka-01` in the buyer window. Point at "Before you pay": orders completed, the two refund deadlines. Fill name, phone, address. |
| 0:50 | "I pay with test USDT. Nothing goes to the seller yet." | Press **Pay**. Read the progress list as it moves (add funds, allow, pay, save). About 15 seconds. |
| 1:10 | "My browser made a six-word code. Only its hash is on the chain." | The order page opens. Point at the countdown and the code grid. Take a screenshot as the page says. |
| 1:25 | "The seller ships, the courier asks for my code." | Seller window: press **Mark shipped** on the order. Courier window: type the six words, press **Delivered: submit code**. Buyer window updates to "Delivered. The problem window is open." |
| 1:50 | "If something is wrong I can report it, and the arbiter decides." | Use the prepared Delivered order from scene 2: open `/o/<order>` in the buyer window, press **Report a problem**, type a sentence, **Send report**. Switch to `/arbiter`: the dispute is listed with the buyer's words. Press **Refund buyer** or **Split**. |
| 2:20 | "If the seller never ships, nobody has to be trusted." | Open the scene 1 order (ship-by passes about 3 minutes after seeding). Show the countdown reach zero, then **Settle now**. The page says "Refunded to you". Then **Move ... test USDT back to my wallet**. |
| 2:50 | "A look-alike seller and a banned seller." | Open `/p/demo-fake-meera`: red warning, Pay disabled. Open `/verify/bad.bazaar`: red "Not a registered seller". In `/arbiter` look up `@bad.bazaar` and press **Force refund** on its open order. |
| 3:10 | "Reviews come only from paid orders, one per person per seller." | Open order #1 in the buyer window, leave a review, approve in the World simulator. Then `/verify/meera.jewels` shows it and `/proof` lists the Arkiv entity. If World is slow, say so and show `/proof` instead. |
| 3:35 | "A second shop reads the same data with its own keys." | Open the Kurta store: "Our record" card, then **Pay with PoP**, which lands on the same checkout. Open the store's **My orders** to show statuses that arrived by signed webhook and were rechecked on the chain. |
| 3:50 | "Everything is on one page you can check." | Show `/proof` for two seconds. Close with the three promises. |

Time risks: the Pay step (15 s), the shipping and delivery transactions (about 5 s each) and World (unknown). If you are behind at 2:50, drop the Kurta store and keep the review.

## Video flow (2 to 4 minutes, 720p or better, recorded on a laptop, real voice, not sped up, no AI voice)
Same order as the live flow, with these changes:
- Record each blockchain wait in real time. Do not cut inside a wait shorter than 20 seconds; narrate what the progress list says instead.
- Cut the dispute segment to the arbiter screen: the buyer's words, then **Split** with 50 percent.
- Show the failing paths on purpose, as separate short clips: (1) wrong code at the courier (the courier page says "That code doesn't match this order."), (2) Settle disabled before the deadline and enabled after, (3) the look-alike seller, (4) cancelling the World request ("Nothing was published").
- End on `/proof`: contracts, a transaction link opened in Blockscout, the Arkiv entity table, the test count line.
- Voice script, about 330 words for 2:40: problem (20 s), checkout and trust cues (25 s), pay and code (25 s), ship and deliver (20 s), report and decide (25 s), automatic refund (25 s), fake and banned seller (15 s), review and Arkiv (25 s), the second store (15 s), proof and limits (30 s). Say the limits out loud: the courier is simulated, one arbiter key decides disputes, test USDT only.

## Failure cases to show, and what to say
| Case | How to show it | What it proves |
|---|---|---|
| Seller never ships | scene 1, **Settle now** after the countdown | The refund needs nobody's permission |
| Wrong delivery code | courier page, type a wrong word | The contract checks the code, not the courier |
| Buyer reports a problem | scene 2 | The buyer is heard inside the window |
| Courier says the buyer refused | scene 3 on `/arbiter` | The courier can only open a dispute, never move money |
| Banned seller | scene 4 | Open orders of a banned seller are refunded in full |
| Look-alike seller | scene 5 | A handle that is not registered is flagged red |
| Webhook replay or edit | not shown live; mention `scripts/e2e-merchant.ts` | The store rechecks the chain and ignores forged events |

## If something breaks
- A transaction is slow: say "Whitechain is confirming, about five seconds" and wait. Do not click twice.
- The page shows an error: read it aloud (it says what happened and what to do) and follow it.
- World fails: show the `/proof` World log row, say the simulator step is staging only, and move on.
- A scene was not seeded in time: seed again, it is idempotent, and continue with another segment first.

## Dry run on the live sites (Fri 6 Nov 2026, about 18:30 to 18:55 IST)
We ran this from a script over HTTP and the chain, **not through a browser and not through the team pages** (a script cannot type the seller, courier or arbiter keys into a page). Buyer, seller, courier and arbiter steps used the same contract calls and the same PoP API routes the pages use. Orders #13 to #16, test USDT only. Tool: `scripts/demo-driver.ts` (ship, courier code, window, finalize, withdraw, with timings).

| Demo step | Script says | Measured |
|---|---|---|
| Landing, checkout and seller record load | instant | 0.0 to 0.8 s for the HTML, `/proof` 2.9 to 3.6 s (the slowest page) |
| Pay button, whole progress list (funds, allow, pay, save) | about 15 s | 9.5 to 15.7 s over four orders; funds 5.6 to 7.9 s, allow about 3.2 s, pay 3.1 to 6.8 s, save 1.5 to 3.0 s |
| Seller ships | about 5 s | 3.3 s, but 16.3 s once (chain latency varies) |
| Courier delivers with the six words | about 5 s | 2.5 s, but 8.5 s once |
| Problem window for a seller below the trusted minimum (@meera.jewels) | not stated | **120 s**; after delivery you have 2 minutes to press Report a problem |
| Problem window for a trusted seller (@kurta.co, 3 or more completed orders) | not stated | **30 s**; from the shipping click to the seller withdrawing (ship, delivery, 30 s window, finalize, withdraw) takes **about 45 s**; payment to release is longer because it includes the time until someone ships |
| Report a problem (tx plus text) | a few seconds | 6.5 s tx plus 1.3 s for the text |
| Arbiter Split | a few seconds | 5.9 s |
| Never-shipped order, Settle now | ship-by about 3 minutes after the order | 2.3 s and 3.2 s once the deadline passed; ship-by is exactly 180 s after pay |
| Release path, ship to seller withdrawn | not stated | 135.6 s, of which 123.6 s is the problem window |
| Kurta "Pay with PoP" to PoP checkout | about 5 s ("Opening the checkout, about 5 seconds") | about 12 s in the browser on Fri 6 Nov (order #11) |

**Not run in this dry run:** the World review and simulator (reviews were done by a person the same evening: see `docs/evidence.md`), the seller, courier and arbiter pages (key entry), and the Kurta store beyond order #11. The two seed scenes were not available then; they were seeded afterwards (see Setup step 4).

**Timings to say out loud (measured Fri 6 Nov):** Pay about 10 to 15 s; Kurta "Pay with PoP" to the PoP checkout about 12 s, not 5 s; `/proof` loads in about 3 s (the slowest page); from shipping to the seller withdrawing a trusted seller's order takes about 45 s (30 s problem window) and a new seller's about 2.3 minutes (120 s window; 135.6 s measured).

**What to change in this script:** say "about 15 seconds" for Pay as written (it holds); budget 10 to 20 s per ship or delivery step instead of 5 s; tell the presenter the window is 120 s; and note the faucet wallet had 4 test USDT left after this dry run (each fresh browser wallet takes 2), so top it up before judging.
