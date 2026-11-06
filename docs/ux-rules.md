# UX rules

Every rule has one line of reasoning and a source. The last section is the checklist we run before shipping a page. Rules were applied to every page of both apps; where a page still breaks one, `docs/OVERNIGHT.md` says so.

## Usability heuristics (Nielsen Norman Group, "10 usability heuristics")
Source: https://www.nngroup.com/articles/ten-usability-heuristics/
1. **Visible system status.** Every pending step says what is happening and about how long it takes ("Sending your payment", "Waiting for confirmation, about 5 seconds"), with a progress indicator.
2. **Match with the real world.** Buyer screens say "payment", "refund", "delivery code", never "escrow", "nullifier", "chain ID" or "gas". Money is shown in rupees next to test USDT.
3. **User control and freedom.** Every dialog has Cancel, every flow a way back, and the buyer can report a problem while the window is open.
4. **Consistency.** One button style per role (primary, secondary, danger), one status vocabulary, one date format.
5. **Error prevention.** Irreversible actions (ban a seller) need a confirmation checkbox; Pay is disabled until the form is valid; Settle is disabled until the contract allows it.
6. **Recognition over recall.** The deadline, the refund rule and the seller's record sit on the page where the decision is made, not in a help page.
7. **Flexibility and efficiency.** Auto-settle checkbox for people who do not want to wait; advanced details are one click away.
8. **Aesthetic and minimalist design.** One primary action per screen; details behind "Show details".
9. **Help users recover from errors.** Errors say what happened, why, and what to do next, in plain words.
10. **Help and documentation.** Short inline explanations; `/proof` for people who want to check us.

## Accessibility (W3C WCAG 2.2, level AA)
Source: https://www.w3.org/TR/WCAG22/
- **1.4.3 Contrast (Minimum):** text 4.5:1, large text 3:1. Our tokens are measured in `docs/design-tokens.md`.
- **1.4.11 Non-text contrast:** borders of inputs and buttons and the focus ring reach 3:1 (`--color-line-strong` 4.00:1, focus 6.70:1).
- **1.4.1 Use of color:** status is always a word as well as a color.
- **2.4.7 Focus visible and 2.4.11 Focus not obscured:** a 2 px focus ring with 2 px offset on every interactive element; no sticky bar covers it.
- **2.1.1 Keyboard:** everything reachable and operable with the keyboard, in reading order.
- **2.5.8 Target size (Minimum):** 24 px is the floor; we use 44 px.
- **3.3.2 Labels or instructions:** every input has a visible label; placeholders are examples, not labels.
- **3.3.1 and 3.3.3 Error identification and suggestion:** errors are text next to the field and read out through `role="alert"`.
- **4.1.3 Status messages:** countdowns do not announce every second; changes of state ("Payment confirmed") use `aria-live="polite"`.
- **2.3.3 and the `prefers-reduced-motion` media feature:** transitions and the skeleton pulse are off under reduced motion.
- **1.4.4 Resize text and 1.4.10 Reflow:** no horizontal scroll at 375 px (320 CSS px reflow target).

## Laws of UX (Jon Yablonski)
Source: https://lawsofux.com/
- **Fitts's law:** touch targets at least 44 px; the primary action sits in the lower, thumb-reachable part of the mobile screen and is full width.
- **Hick's law:** few choices per screen, one primary action, the rest secondary.
- **Progressive disclosure:** transaction hashes, the terms fingerprint and technical notes sit behind "Show details".
- **Miller's law and chunking:** the delivery code is shown as two rows of three words, with a numbered position per word.
- **Doherty threshold:** acknowledge every press within 400 ms (button changes to its pending label at once); loads use skeletons, not spinners.
- **Jakob's law:** a checkout looks like a checkout: item, price, what happens next, address form, one Pay button.
- **Law of proximity and Gestalt grouping:** related fields and statuses are grouped with 8 px inside and 24 px between groups.
- **Peak-end rule:** the end of a flow (payment confirmed, order complete, refund received) is a clear, calm success state.

## Checkout and trust (Baymard Institute)
Source: https://baymard.com/ (site root only; UNVERIFIED: I did not open a specific Baymard article, so these two lines state general checkout practice, not a quoted finding)
- Ask only for what the seller needs (name, phone, address); label every field; show the price and the total above the button.
- Show trust cues next to the payment decision: seller record, protection terms and the refund deadline.

## Layout and type
- Reading width 50 to 75 characters (`max-w-prose`); line height about 1.5 for body text. Source: https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html (WCAG 1.4.8 advice: no more than 80 characters per line, spacing of at least 1.5).
- 8 px spacing grid and one type scale (see `docs/design-tokens.md`).
- Mobile first at 375 px, then tablet (768) and desktop (1280).

## Waiting on a blockchain (our biggest risk)
- Every pending step has: a plain sentence of what is happening, an expected duration, a progress bar or step list, and the next action.
- Never show a bare spinner. After 30 seconds say what the user can do (wait, refresh, check the transaction).
- Four states on every page: loading (skeleton), empty (what to do), error (what happened, why, what to do), success.

## Words we do not use
Scope: buyer screens (`/`, `/p`, `/o`, `/verify`, `/onboard`, the Kurta Co. store). The judge page `/proof` and the team tools (`/arbiter`, `/courier`, `/dashboard`) may use the technical terms because their readers need them (for example "nullifier" in the World verification log).
Buyer screens: no "escrow", "nullifier", "chain ID", "gas". Never "trustless", "impossible to fake", "delivery verified on-chain". Label TEST MODE wallets and the SIMULATED COURIER.

## Checklist against AI-generated look and voice
Sources: Wikipedia, "Signs of AI writing" (https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing); "20 Signs a Website Was Made by AI" (https://scalr.sg/blog/20-signs-a-website-was-made-by-ai/); "AI Slop Design" (https://vibecodekit.dev/ai-slop-design); "AI Slop Fonts and Gradients" (https://www.925studios.co/blog/ai-slop-design-tells).

Copy
- [ ] No em dash or en dash used as punctuation. Use a comma, period or colon. (Ranges use "to".)
- [ ] None of: seamless, unlock, empower, elevate, revolutionary, next-gen, cutting-edge, leverage, robust, delve, tapestry, testament, pivotal, crucial, vibrant, landscape (abstract), showcase, foster, "in today's fast-paced world".
- [ ] No "not just X, but Y", "it's not X, it's Y", "no X, no Y, just Z".
- [ ] No rule-of-three adjective lists, no tacked-on "-ing" clause that restates the sentence ("ensuring…", "highlighting…").
- [ ] Use "is" and "has", not "serves as", "stands as", "features", "boasts".
- [ ] No weasel attribution ("studies show", "experts say"). Every number comes from the app or a contract.
- [ ] Sentence case for every heading, button and label. No title case.
- [ ] Concrete verbs ("Pay 1.50 test USDT", "Report a problem"), real numbers, no hope-filled closing lines.
- [ ] No lorem ipsum, no fake stats, no fake testimonials, no placeholder names that look real.

Design
- [ ] No purple-to-blue or any gradient hero, no gradient text, no gradient buttons.
- [ ] No glassmorphism, blur, glow, floating orbs, or semi-transparent panels.
- [ ] No row of three identical cards (icon, bold title, one line).
- [ ] No emoji or generic icon (rocket, bolt, shield) as bullet or decoration.
- [ ] No all-caps labels, no pill badges above headlines, no cards nested in cards.
- [ ] Not everything centered: flows are left-aligned, one column.
- [ ] No stock illustrations and no decorative animation.
- [ ] A face-value check: remove the logo and the page must still say whose it is, from its own facts (seller handle, order number, rupee amounts).

Repository check (run before each release):
`grep -rnP "[\x{2013}\x{2014}]" apps/*/src docs README.md` must return nothing in UI strings and user-facing docs.
