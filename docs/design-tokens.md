# Design tokens

Source of truth: `apps/web/src/app/globals.css` and `apps/demo-store/src/app/globals.css` (same structure; the store has its own palette, see below). Components use these tokens only: no raw hex values, no default Tailwind palette colors (`emerald-*`, `neutral-*`, `red-*`).

## What we studied (whitechain.io, Fri 6 Nov 2026)
We looked at the home page with screenshots and computed styles. We took the structure, not the brand: no logo, text, images or marks are reused.

| Trait on whitechain.io | What we measured | Our take |
|---|---|---|
| Surface | White page, a single bordered content column | White page, one centered column, hairline borders |
| Ink | Near-navy text `#07081E`, secondary grey `#45464D`, `#6A6A72` | Navy-tinted ink and two greys, all above 4.5:1 on white |
| Accent | One saturated blue `#0066FF`, used for buttons and one highlighted headline line | One accent, a deep green (PoP is about money coming back), used for the primary action and success only |
| Type | Onest, weight 600 headings, h1 48 px with -0.96 px tracking, body 16/24 | Figtree for text, IBM Plex Mono for codes and hashes, weight 600 headings, same negative tracking idea |
| Buttons | 40 px high, 14 px radius, 16 px side padding, weight 500, 150 ms ease | 44 px high (touch target), 12 px radius, weight 600, 150 ms ease |
| Cards | Hairline `#E6E6EC` borders; one dark navy panel with a 0.8 px border | Hairline borders, no shadows, no nested cards |
| Labels | Small uppercase micro-labels | Not used: sentence case only (all-caps labels are listed as an AI-design tell in `docs/ux-rules.md`) |
| Pattern | Dotted grid backgrounds, big plain numbers for stats | Plain numbers from our own contracts only, no decorative patterns |
| Motion | `color/background 0.15s cubic-bezier(0.4, 0, 0.2, 1)` | Same easing, 150 ms, only on hover and focus, off under `prefers-reduced-motion` |

## Color tokens
| Token | Value | Use | Contrast on `--color-bg` |
|---|---|---|---|
| `--color-bg` | `#FFFFFF` | page | n/a |
| `--color-surface` | `#F6F7F9` | subtle panels, input background | n/a |
| `--color-line` | `#DADCE3` | decorative hairlines only (1.37:1, below the 3:1 needed for UI parts, so it never marks a control); controls use `--color-line-strong` | 1.37:1 |
| `--color-line-strong` | `#7A7F8E` | borders of inputs and buttons | 4.00:1 |
| `--color-ink` | `#0B1020` | primary text | 18.93:1 |
| `--color-ink-2` | `#3D4354` | secondary text | 9.86:1 |
| `--color-muted` | `#596072` | captions, hints | 6.29:1 (5.86:1 on `--color-surface`) |
| `--color-accent` | `#0A6B45` | primary buttons, success | 6.56:1 (white text on accent: 6.56:1) |
| `--color-accent-strong` | `#07553A` | hover, links | 8.86:1 |
| `--color-accent-soft` | `#E6F4EC` | success and info backgrounds | `accent-strong` on it 7.81:1, `ink` on it 16.69:1 |
| `--color-warn` | `#7A4B00` | test mode, caution text | 7.41:1 |
| `--color-warn-soft` | `#FFF4D6` | test mode background | `warn` on it 6.76:1 |
| `--color-danger` | `#A31515` | errors, refunds that need attention | 7.85:1 |
| `--color-danger-soft` | `#FDECEC` | error background | `danger` on it 6.87:1 |
| `--color-focus` | `#1D4ED8` | focus ring, 2 px with 2 px offset | 6.70:1 |

Meaning is never carried by color alone: every status also has a word (and the timeline an icon-free numbered marker).

## Type scale (one scale, 1.25 ratio, 16 px base)
| Token | Size / line height | Use |
|---|---|---|
| `text-xs` | 12 / 16 | legal, hashes |
| `text-sm` | 14 / 20 | captions, table cells |
| `text-base` | 16 / 24 | body (never below 16 px for inputs, avoids iOS zoom) |
| `text-lg` | 18 / 28 | card titles |
| `text-xl` | 22 / 30 | page titles on mobile |
| `text-2xl` | 28 / 36 | page titles on desktop, countdown |
| `text-3xl` | 36 / 44 | landing headline on desktop |

Headings: weight 600, letter-spacing -0.02em on 22 px and up. Body: weight 400. Reading width 65 characters (`max-w-prose` is 65ch).

## Space, radius, motion
- Spacing: multiples of 8 px (4 px only inside controls). Page padding 16 px on mobile, 24 px from 768 px. Section gap 24 px, card padding 16 px (mobile) or 24 px.
- Radius: `--radius-control` 12 px (buttons, inputs), `--radius-card` 16 px. Pills are not used.
- Borders: 1 px hairline. No shadows, no blur, no glow, no gradients.
- Motion: 150 ms ease-out on color, background and border only. `prefers-reduced-motion` turns every transition and animation off. The only animation is the skeleton pulse, also disabled under reduced motion.
- Breakpoints: design at 375 px first, then `sm` 640, `md` 768, `lg` 1024. Content column `max-w-2xl` for flows, `max-w-4xl` for tables (`/proof`, `/dashboard`).
- Touch targets: 44 px minimum height and width for anything pressed.
- Wordmark: the text "PoP" in Figtree 700 plus a small square mark made of two CSS shapes. It is ours and is not derived from any other brand.

Ratios are computed by `node scripts/contrast.js` (WCAG relative luminance formula), not estimated.

## Receipt pieces (UI pass 2, see `docs/design-direction.md`)
No new colours: the receipt is `--color-bg` paper on a `--color-surface` desk, with 1 px `--color-line` hairlines and a 1 px dashed `--color-line-strong` tear line. Its radius is 4 px (the one exception to the 12/16 px radii), and so is the stamp's. The stamp is a 2 px border in the text colour. Tracker and checklist squares are 14 px CSS boxes: filled for done and now, outlined in `--color-line-strong` for not yet. `font-variant-numeric: tabular-nums` is set on `body`.

## Kurta Co. palette (`apps/demo-store` only)
The store is a different shop that uses PoP, so it has its own warm palette and a display serif (Fraunces 600, via `next/font`, store only). PoP's green appears only on the "Pay with PoP" button.

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--color-bg` | `#FFFBF5` | page | n/a |
| `--color-surface` | `#F5ECDF` | header, picture background | n/a |
| `--color-line` | `#E2D5C3` | decorative hairlines only | 1.40:1 on bg |
| `--color-line-strong` | `#8A7B6B` | borders of inputs and buttons | 3.97:1 on bg, 3.50:1 on surface |
| `--color-ink` | `#22170F` | primary text | 17.01:1 on bg |
| `--color-ink-2` | `#4B3B2E` | secondary text | 10.37:1 on bg, 9.14:1 on surface |
| `--color-muted` | `#6A584A` | captions | 6.55:1 on bg, 5.77:1 on surface |
| `--color-accent` | `#9A3412` | the shop's terracotta | 7.09:1 on bg, white on it 7.31:1 |
| `--color-pop` | `#0A6B45` | "Pay with PoP" only | white on it 6.56:1 |
| `--color-pop-strong` | `#07553A` | its hover | white on it 8.86:1 |

Ratios computed with the formula in `scripts/contrast.js` (WCAG relative luminance).
