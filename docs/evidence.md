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
| Attestor (writer) wallet | `0x95da11ed9eC58De7684D41E6135970c9D481a42A` |
| Smoke entity | pending (needs access key + tGLM) |

## World
| What | Result |
|---|---|
| Review proof verified server-side | pending (needs app_id, rp_id, signing key) |

## Contracts (local)
| What | Result |
|---|---|
| `forge test` | 34 passed, 0 failed (Fri 00:12 IST): 28 PoPCheckout (incl. 256-run fuzz), 6 SellerRegistry |
| Deploy dry run | local anvil fork of 1874, `token()` = 0xcedf… (Fri 00:15) |

## Smoke tests
| Test | When (IST) | Result |
|---|---|---|
| A. Whitechain read | Fri 00:05 | PASS (token readable; wallets unfunded) |
| B. Contracts on anvil | Fri 00:15 | PASS (34 tests + fork deploy) |
| C. Arkiv create/query/transfer | | BLOCKED: needs ARKIV_ACCESS_KEY + tGLM |
| D. World server verify | | BLOCKED: needs World app + rp_id + signing key |
| E. Supabase unique constraint | | BLOCKED: needs DATABASE_URL |
