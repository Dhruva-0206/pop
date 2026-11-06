# Before and after screenshots

Captured from production builds (`next build` + `next start`) on the local fork, in an iframe of exact width (375 px and 1280 px), because the browser tool cannot resize its viewport. `before/` is the design at commit 2e0305f plus the checkout fixes; `after/` is the redesign. Horizontal overflow check before: `/proof` 768 px of content in a 375 px viewport (scrolls sideways); every other page fit.

## Checks run on the redesign (Fri 6 Nov night)
- Lighthouse 12 (axe-core rules), production build, `bash scripts/a11y-audit.sh`: accessibility 100 on `/`, `/p/jhumka-01`, `/o/1`, `/verify/meera.jewels`, `/dashboard`, `/courier`, `/arbiter`, `/onboard`, `/proof`. Best practices 100, except 96 on `/dashboard`, `/courier`, `/arbiter` for "errors in console": the expected 401 from the signed-out API calls on those team tools.
- Rendered-DOM audit at 375 px (every page, in a 375 px iframe): no horizontal scroll, every input has an accessible name, no touch target under 44 px (inline text links exempt), exactly one h1. Before the redesign `/proof` scrolled sideways (768 px of content in 375 px).
- Contrast values come from `node scripts/contrast.js`.
- Not checked: screen reader testing by a person, real phones, Safari, the pages while a transaction is pending on a slow network.
