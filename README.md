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
| `scripts/` | Smoke tests, seed, fork e2e, wallet setup |
| `supabase/` | Postgres migrations (private data only) |
| `arkiv/` | Arkiv judging docs |
| `docs/` | Evidence, friction log, limitations, submission tags |
| `specs/` | Pre-build planning specs (AI and spec disclosure) |

## Deployed contracts and evidence
Whitechain Sepolia (chain 1874), both **verified on Blockscout**. Test USDT only; nothing here has any value.
| Contract | Address |
|---|---|
| PoPCheckout | [`0xB6A894bE070951a7331DebFf615e11F7a076794c`](https://explorer.testnet.whitechain.io/address/0xB6A894bE070951a7331DebFf615e11F7a076794c?tab=contract) |
| SellerRegistry | [`0x6D61cD77239dd61e43e943a4Aac006d8A6C285E5`](https://explorer.testnet.whitechain.io/address/0x6D61cD77239dd61e43e943a4Aac006d8A6C285E5?tab=contract) |
| Specified test USDT | [`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`](https://explorer.testnet.whitechain.io/address/0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7) |

A full protected order (pay, ship, deliver with the buyer's code, finalize, withdraw) was run with the specified USDT: pay [`0xa59f9067…aa5da3`](https://explorer.testnet.whitechain.io/tx/0xa59f9067bf1d58c716809efe520a0666e4aacbca2dfea4a52b0ad8a79caa5da3), deliver [`0x2df7522a…a8c3de`](https://explorer.testnet.whitechain.io/tx/0x2df7522a98d718c38bf7771f48447eb13d2e6fe3e5ba8fb076afbf8968a8c3de), finalize [`0x38708e79…c51290`](https://explorer.testnet.whitechain.io/tx/0x38708e796235108faede33d124e92e9777478041de13bec3a1322393e8c51290), withdraw [`0xee21a184…b5306a`](https://explorer.testnet.whitechain.io/tx/0xee21a18433c0a018c24d749faddc6f19f7c58322b55a3c987fe52bddc9b5306a). Every tx link is in `docs/evidence.md`.

## Arkiv
_TODO_: writer wallet + runnable query.

## Setup
_TODO_.

## Tools used
Foundry, OpenZeppelin Contracts, Next.js, React, viem, @arkiv-network/sdk, World IDKit, Supabase Postgres, Tailwind, zod, qrcode, html5-qrcode, @scure/bip39, Vercel.

## Limitations
See `docs/limitations.md`.

## AI usage
See `AI_USAGE.md`.

## License
MIT, see `LICENSE`.
