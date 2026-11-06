# Design direction, UI pass 2 (Fri 6 Nov)

Audit: production builds on a fresh local fork after `seed-demo.ts`, every page and order state at 375 and 1280 px, taken with `scripts/screens.ts` (headless Chrome over the DevTools protocol). Every page fit at 375 px with one h1. The problems are about how the pages read in a 4-minute demo, not about function.

## The 10 biggest problems, ranked by what a judge notices
1. **The order page has no shape.** It is the page we show most and it is four stacked cards: status, countdown, Settle and progress each sit in their own box. Price and order number are small grey text. Nothing says "this is your proof of purchase".
2. **The current step is invisible.** Progress is a vertical list at the bottom with "Not yet" under three of four rows. The current step is not marked, and the refund rule sits apart from the timeline it controls.
3. **Settle does not say when.** The disabled button reads "Settle (opens when the timer ends)" but gives no time, and it sits in a separate box from the countdown that controls it.
4. **The TEST MODE banner takes the first screen.** At 375 px it is a five-line yellow box, the first thing on every page, above the product and the price.
5. **The landing page is five identical cards.** "How an order works" is a column of five same-sized boxes (the card-stack tell). There is no example of what a buyer actually gets.
6. **The Kurta Co. store looks like PoP in another colour.** Same column, same cards, same type, no product image. A judge would see one app, not an integration.
7. **Checkout rules are a bullet wall.** Four bullets, then a "demo timings" line, then the record line with "1 protected orders". On mobile, Pay is at the bottom of a long form, far from the price.
8. **Numbers are not set as numbers.** Proportional digits, inconsistent formats ("₹1,299 (1.50 test USDT…)" against "₹899 · 1.00 test USDT"), and dates with the year ("6 Nov 2026, 4:48 pm").
9. **Colour means two things.** The neutral "you are not the buyer" note uses the green success style, and the registered-seller status on /verify looks like a success toast.
10. **End states are flat.** Refunded says "Refunded to you." even to a viewer who is not the buyer, and does not say where the money went. Released does not lead to the review.

## Direction: a receipt and a courier slip, with restraint
- **The order page is the receipt.** A narrow paper column (`--color-paper` on `--color-surface`, 4 px radius, hairline rules), order number and amounts in IBM Plex Mono with tabular digits, right-aligned. A dashed tear line above the delivery code. The status is a stamp: a bordered box with one word in sentence case ("Paid", "Shipped", "Delivered", "Seller paid", "Refunded", "In dispute", "Split").
- **One tracker everywhere.** Four steps (Paid, Shipped, Delivered, Seller paid). Done is a filled square plus a time, now is a filled square plus the word "Now", future is an outlined square. Under it, one plain line with the rule that applies and its time ("If not shipped by 3:12 pm, 6 Nov, you are refunded automatically."). The same component is the landing page's "How an order works".
- **Numbers carry the trust.** `tabular-nums` on every number, rupees first and large via `Intl.NumberFormat("en-IN")`, test USDT second and smaller, times as "3:12 pm, 6 Nov" in IST.
- **Left-aligned and asymmetric.** Text column left, facts column right on desktop; one column on mobile. Only the delivery code grid is centred.
- **Kurta Co. is its own shop.** Warmer surface token, larger shop name, a large product picture (drawn in CSS from the store's own tokens, no image file), its own two-column layout. The "Pay with PoP" button is the one place PoP's green and wordmark appear.
- **The test label gets smaller, not weaker.** One line, still the exact words "TEST MODE", still on every page that uses the test wallet.

## Calls made during this pass (and why)
- `e2e-fork.ts` runs **without** `POP_DEV_SKIP_WORLD`, so it skips its review and ban sections (46 checks, not 65). With the flag it writes a real DEV entity to Arkiv Rabdi, and this pass is not allowed to write to Arkiv. The review UI is exercised by screenshots only.
- Conflict: the brief asks for "Simulated courier" in sentence case; CLAUDE.md section 2 locks the labels "TEST MODE" and "SIMULATED COURIER". The brief says CLAUDE.md wins, so both labels keep their exact text. They become smaller (one line), not different.
- The stamp and tracker squares are CSS shapes, not icons. No icon library, no image files.
