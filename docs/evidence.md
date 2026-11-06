# Evidence
Contract addresses, tx links, Arkiv entity keys and runnable queries. Newest first within each section.

## Whitechain Sepolia (1874)
| What | Value | Link |
|---|---|---|
| Specified test USDT | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`: name "Tether USD", symbol USDT, **decimals 6**, totalSupply ~1,945,273 (read Fri 6 Nov 00:05 IST, block 12306918) | https://explorer.testnet.whitechain.io/address/0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7 |
| Test USDT acquisition | WBT swapped to USDT on YetiTrade: tx [`0x382599b2410c59a0c6515b83cd7d4dc131854317f2ace32b996978f18ed5d54d`](https://explorer.testnet.whitechain.io/tx/0x382599b2410c59a0c6515b83cd7d4dc131854317f2ace32b996978f18ed5d54d), block 12327812. The Whitechain flyer confirms this token and says it supports permit + EIP-3009 | https://explorer.testnet.whitechain.io/address/0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7 |
| Faucet wallet balances (read on-chain Fri 6 Nov) | `0x012f9baaDbCF059Fc70DAFcD7eB109404e703A43`: **25 USDT** (25000000 raw) + **0.5 WBT** | https://explorer.testnet.whitechain.io/address/0x012f9baaDbCF059Fc70DAFcD7eB109404e703A43 |
| Deployer balance (read on-chain) | `0xB7C637cb5a37abbA288ca51f1d2Fd0c6776ABb2c`: 2 WBT | |
| **PoPCheckout** (deployed Fri 6 Nov, block 12330545) | [`0xB6A894bE070951a7331DebFf615e11F7a076794c`](https://explorer.testnet.whitechain.io/address/0xB6A894bE070951a7331DebFf615e11F7a076794c?tab=contract) | **Verified on Blockscout** (compiler v0.8.30, evm prague, optimizer 200 runs). Deploy tx [`0x179e2cfd…e1d4ed`](https://explorer.testnet.whitechain.io/tx/0x179e2cfdd423a5356cd4c4dd2bf55115501f5bce37a6801aefff49e4c9e1d4ed) |
| **SellerRegistry** (deployed Fri 6 Nov, block 12330545) | [`0x6D61cD77239dd61e43e943a4Aac006d8A6C285E5`](https://explorer.testnet.whitechain.io/address/0x6D61cD77239dd61e43e943a4Aac006d8A6C285E5?tab=contract) | **Verified on Blockscout** (same settings). Deploy tx [`0xf0196821…f5dfa8`](https://explorer.testnet.whitechain.io/tx/0xf0196821f93bcdeb21d27b2bb631a0ae200bd2f44eab2b14b0848bae22f5dfa8) |
| Constructor config (read back on-chain) | token = `0xcedf…55a7`, treasury = deployer `0xB7C6…Bb2c`, fee 100 bps, short window 30 s, long window 120 s, trusted min 3, arbiter timeout 300 s | defaults only; no time override exists |
| Roles (read back on-chain) | PoPCheckout: admin = deployer, COURIER = `0x63d1…2E0C`, ARBITER = `0x502C…d2E9`. SellerRegistry: admin = deployer, ATTESTOR = `0xeF0C…A21c`, ARBITER = `0x502C…d2E9`. Negative checks (attestor has no checkout admin, courier has no registry attestor role) all false | |

### First real test-USDT order (Fri 6 Nov, order #1, 1.00 test USDT, TEST values, no real money)
Seller @meera.jewels (tier 1) registered via an attestor-signed registration; listing `jhumka-01` with a seller-signed EIP-712 Offer; the order was walked through the whole happy path with the SPECIFIED USDT `0xcedf…55a7`.
| Step | Tx |
|---|---|
| Fund seller gas (0.02 WBT from deployer) | [`0xabfb17d7…147b17`](https://explorer.testnet.whitechain.io/tx/0xabfb17d7dba39e18b50b3b7f2e81b13cdbbec127d15c64d0758ca59e5b147b17) |
| Fund test buyer 0.05 WBT (from faucet wallet) | [`0xcae484b4…25ea31`](https://explorer.testnet.whitechain.io/tx/0xcae484b44ed94e150087cf61117ea5c8dfbfff676dbfd93e1f4e689eb925ea31) |
| Fund test buyer 5 USDT (from faucet wallet) | [`0xb24daf46…137c10`](https://explorer.testnet.whitechain.io/tx/0xb24daf4604833430ca0bcce39ac7fb0c1ba640de03b671402249415e3c137c10) |
| `registerSeller` @meera.jewels (block 12330670) | [`0x12ae0d7b…67e7fd`](https://explorer.testnet.whitechain.io/tx/0x12ae0d7b36bca517774049c2cf325c09a75b20752e01e28fa882d3bee167e7fd) |
| Buyer `approve` 1.00 USDT (block 12330750) | [`0xe1412835…564aaa`](https://explorer.testnet.whitechain.io/tx/0xe141283596ae47e153b40181a07e1c6ef24e08591647d88ee49cf71e83564aaa) |
| Buyer `pay` (block 12330754) | [`0xa59f9067…aa5da3`](https://explorer.testnet.whitechain.io/tx/0xa59f9067bf1d58c716809efe520a0666e4aacbca2dfea4a52b0ad8a79caa5da3) |
| Seller `markShipped` (block 12330760) | [`0xfec133f3…baff65`](https://explorer.testnet.whitechain.io/tx/0xfec133f3fcbe5a39ab27af5d4d7883ab034833013abdc2201df68ee973baff65) |
| Courier `confirmDelivery` with the buyer's 6-word code (block 12330763) | [`0x2df7522a…a8c3de`](https://explorer.testnet.whitechain.io/tx/0x2df7522a98d718c38bf7771f48447eb13d2e6fe3e5ba8fb076afbf8968a8c3de) |
| Anyone `finalize` after the 120 s dispute window (block 12330995) → Released | [`0x38708e79…c51290`](https://explorer.testnet.whitechain.io/tx/0x38708e796235108faede33d124e92e9777478041de13bec3a1322393e8c51290) |
| Seller `withdraw` 0.99 USDT (block 12330998) | [`0xee21a184…b5306a`](https://explorer.testnet.whitechain.io/tx/0xee21a18433c0a018c24d749faddc6f19f7c58322b55a3c987fe52bddc9b5306a) |

Result: seller received 0.990000 USDT, treasury (deployer) holds 0.01 USDT credit (1% fee), `totalLocked` = 0, checkout token balance = `totalCredit` = 0.01. `completed(seller)` = 1. `/api/verify/meera.jewels` shows 1 order, 1 released. Script: `scripts/testnet-order.ts` (testnet-only, guarded, run once).

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
| E. Supabase unique constraint | Fri 6 Nov | **PASS** (migration applied; same human + same seller rejected with SQLSTATE 23505 on `review_nullifiers_human_seller_uq`; same human + different seller allowed). Now exercised by the app's review claim in the fork e2e |
