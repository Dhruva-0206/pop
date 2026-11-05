# Evidence
Contract addresses, tx links, Arkiv entity keys and runnable queries. Newest first within each section.

## Whitechain Sepolia (1874)
| What | Value | Link |
|---|---|---|
| Specified test USDT | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`: name "Tether USD", symbol USDT, **decimals 6**, totalSupply ~1,945,273 (read Fri 6 Nov 00:05 IST, block 12306918) | https://explorer.testnet.whitechain.io/address/0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7 |
| PoPCheckout | not deployed yet | |
| SellerRegistry | not deployed yet | |

Re-run: `npx tsx scripts/smoke-whitechain.ts`

## Arkiv Rabdi (7794095)
| What | Value |
|---|---|
| Attestor (writer) wallet | `0xeF0CC7f7f280083e425A741957B920c7eF39A21c` |
| Smoke entity (`pop_review_v1`, readonly, order_id 999000001, a clearly fake test entity, 24 h expiry) | key `0x731d721cf6b3b621983f30bc21ee2a1ee1f6e40917e3113203a5e9b6cee6f620` |
| Create tx (block 265818) | `0xcb2da0660b9328b2705ba0fae2736fdd787899e446f4c825eeb6223fb31d0e63` |
| changeOwnership tx (block 265821) | `0x0d7ec9768699fe503c72fa762b3f80b1b89bb7b6fa979b9e6f81e72b4ad6ce5e` |
| Read back (Fri 6 Nov) | `$creator` = attestor `0xeF0C…A21c`, `$owner` = test buyer `0xC47e…34cE`, `readonly: true`, expires at block 309018 |

Re-run (safe, queries first and creates nothing if the entity exists): `npm run smoke:arkiv`. The two tx hashes were recovered by reading the blocks at the entity's `$createdAt` / `$updatedAt` for the attestor's transactions.

## World
| What | Result |
|---|---|
| Review proof verified server-side | pending (needs app_id, rp_id, signing key) |

## Contracts (local)
| What | Result |
|---|---|
| `forge test` | Fri 6 Nov, 2nd machine, forge 1.9.0: **57 passed, 0 failed** (56 unit/fuzz + invariant suite of 5 invariants, 64 runs x 32; also held at 512 runs x 32) |
| Deploy dry run | local anvil fork of 1874, `token()` = 0xcedf… (Fri 00:15) |

## LOCAL FORK end-to-end (NOT real payments; anvil fork, chain id 31337, real USDT bytecode)
| When (IST) | Result |
|---|---|
| Fri 02:05 | `scripts/e2e-fork.ts` PASS: pay → confirm (idempotent) → seller sign-in sees decrypted ship-to → ship → wrong code rejected → code accepted → random wallet finalizes → seller withdraws 0.99; unshipped order refunded 1.00 via finalize + withdrawFor; handover refused → Disputed |

| Fri 6 Nov (2nd machine) | `scripts/e2e-fork.ts` PASS after the security fixes (buyer-signed order registration, single-use login nonce, on-chain listing id); same path as above. Fork-only addresses, not real payments |

## Smoke tests
| Test | When (IST) | Result |
|---|---|---|
| A. Whitechain read | Fri 00:05 | PASS (token readable; wallets unfunded) |
| B. Contracts on anvil | Fri 00:15 | PASS (34 tests + fork deploy) |
| C. Arkiv create/query/transfer | Fri 6 Nov | **PASS** (create, query by creator, changeOwnership to buyer; creator stays attestor) |
| D. World server verify | | BLOCKED: needs World app + rp_id + signing key |
| E. Supabase unique constraint | | BLOCKED: needs DATABASE_URL |
