# Before and after screenshots

Captured from production builds (`next build` + `next start`) on the local fork, in an iframe of exact width (375 px and 1280 px), because the browser tool cannot resize its viewport. `before/` is the design at commit 2e0305f plus the checkout fixes; `after/` is the redesign. Horizontal overflow check before: `/proof` 768 px of content in a 375 px viewport (scrolls sideways); every other page fit.

## Checks run on the redesign (Fri 6 Nov night)
- Lighthouse 12 (axe-core rules), production build, `bash scripts/a11y-audit.sh`: accessibility 100 on `/`, `/p/jhumka-01`, `/o/1`, `/verify/meera.jewels`, `/dashboard`, `/courier`, `/arbiter`, `/onboard`, `/proof`. Best practices 100, except 96 on `/dashboard`, `/courier`, `/arbiter` for "errors in console": the expected 401 from the signed-out API calls on those team tools.
- Rendered-DOM audit at 375 px (every page, in a 375 px iframe): no horizontal scroll, every input has an accessible name, no touch target under 44 px (inline text links exempt), exactly one h1. Before the redesign `/proof` scrolled sideways (768 px of content in 375 px).
- Contrast values come from `node scripts/contrast.js`.
- Not checked: screen reader testing by a person, real phones, Safari, the pages while a transaction is pending on a slow network.

## UI pass 2 (Fri 6 Nov, day): `after2/`
Direction and audit: `docs/design-direction.md`. Production builds (`next build` + `next start`) of both apps on a fresh local fork after `scripts/seed-demo.ts`, captured with `npx tsx scripts/screens.ts <jobs.json> docs/screens/after2` (headless Chrome over the DevTools protocol at an exact viewport width; it also writes `after2/report.txt`, which lists horizontal overflow and the h1 count per page). Every page and width in this set fits (no horizontal scroll at 375 px) and has one h1.

Each name is `<width>-<page>.png`; `-fold.png` is the first screen only, used where a fixed bar matters (the full-page capture draws the phone Pay bar in the middle of the page, where the first screen ends).
- Landing: `375-home`, `1280-home` (example receipt and the four-step tracker).
- Checkout: `375-checkout` (+ `-fold` with the sticky Pay bar), `1280-checkout`; look-alike seller `375-checkout-fake` (+ `-fold`), `1280-checkout-fake`.
- Order receipt, by state: `order-paid-with-code` (Paid, buyer, delivery code below the tear line), `order-delivered-buyer`, `order-disputed-buyer`, `order-refunded-buyer` (with the button that moves the refund to the wallet), `order-released-review` (Seller paid, review box), `order-split` (viewed from another browser). Each at 375 and 1280.
- Seller record: `verify` (registered), `verify-banned`, `verify-unknown`.
- Team tools and proof: `proof`, `onboard`, `dashboard`, `courier`, `arbiter` (signed out, except the arbiter dispute list which needs no sign-in).
- Kurta Co.: `store-home`, `store-orders`.

The Paid, Delivered, Released and Refunded orders were driven through the UI on the fork: the checkout paid order #12, "I received it" moved it to Delivered, and after a fork time skip "Settle now" released it; scene 1 (order #8) was refunded with "Settle now" after its ship-by passed. Times on these screens are fork chain time, which runs ahead of the wall clock because the e2e scripts skip time.

Not checked in this pass: real phones, Safari, a screen reader with a person, and a real World ID proof (the review box is shown, not submitted).
