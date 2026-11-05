# PoP: Proof of Purchase

**If it doesn't arrive, you get your money back automatically.**

PoP is a protected checkout for Instagram/WhatsApp sellers and small websites. The buyer pays test USDT into a contract on Whitechain Sepolia. The money is released only when the buyer's own delivery code is entered at the door, and it is refunded automatically if a deadline is missed. After a completed order, one World ID-verified human can leave one review per seller. Reviews live on Arkiv, where any app can read them.

> Built from scratch at ETHGlobal Mumbai 2026 (5 to 7 Nov). Status: **work in progress**.

## The three promises
1. If it doesn't arrive, you get your money back automatically. Nobody can stop that refund, including us.
2. The money is released by the buyer's code at the door; our courier key can't release a single rupee.
3. Reputation is earned only from protected deliveries, counts each human once per seller, and lives on Arkiv where any app can read it.

## Why on-chain stablecoin settlement
_TODO_: The refund deadline is enforced by code that neither the seller nor PoP can override, and settlement works the same for a buyer in Dubai as in Pune.

## Architecture
_TODO_ (see `specs/PoP_Technical_Architecture.md`).

## Repo layout
| Path | What |
|---|---|
| `contracts/` | Foundry project: `PoPCheckout`, `SellerRegistry`, tests, deploy script |
| `apps/web/` | PoP Next.js app (pages + API routes) |
| `apps/demo-store/` | "Kurta Co." demo merchant, a separate app |
| `packages/shared/` | Name constant, chain definitions, EIP-712 types, ABIs |
| `scripts/` | Smoke tests, seed, keeper, wallet setup |
| `supabase/` | Postgres migrations (private data only) |
| `arkiv/` | Arkiv judging docs |
| `docs/` | Evidence, friction log, limitations, submission tags |
| `specs/` | Pre-build planning specs (AI and spec disclosure) |

## Deployed contracts and evidence
_TODO_: see `docs/evidence.md`.

## Arkiv
_TODO_: writer wallet + runnable query.

## Setup
_TODO_.

## Tools used
Foundry, OpenZeppelin Contracts, Next.js, React, viem + wagmi, @arkiv-network/sdk, World IDKit, Supabase Postgres, Tailwind, zod, Vitest, qrcode, html5-qrcode, @scure/bip39, Vercel.

## Limitations
See `docs/limitations.md`.

## AI usage
See `AI_USAGE.md`.

## License
MIT, see `LICENSE`.
