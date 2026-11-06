# Evidence
Contract addresses, tx links, Arkiv entity keys and runnable queries. Newest first within each section.

## Live evening orders and World reviews (Fri 6 Nov 2026, about 18:55 to 19:30 IST)
All on 1874 with test USDT. Every hash below is the full transaction hash, read from the PoPCheckout events by order id on Fri 6 Nov. "Driver" means `scripts/demo-driver.ts` (ship as the seller, courier delivers with the buyer's six words, wait out the problem window, finalize, seller withdraw).

| Order | Seller | How it was placed | How it ended |
|---|---|---|---|
| #11 | @kurta.co, 1.50 | Paid in a browser through the live Kurta store (details in the order #11 section below) | Released: [pay](https://explorer.testnet.whitechain.io/tx/0xdaa45657ffae0e638b54ec9ef9e0fc1f0a0e4aecb13ea2e4a88de3bcedc19d17), [finalize](https://explorer.testnet.whitechain.io/tx/0xee163815e16110c405d2918287c8cf075edbafc9e7c58e4beea6f7e464d3d179), [withdraw](https://explorer.testnet.whitechain.io/tx/0x087e45bd1420d224dc10618f1ac0aa79662f346ec74b82d5d2f2a2db0d39fe3c) |
| #16 | @meera.jewels, 1.00 | Demo dry run from a script: [pay](https://explorer.testnet.whitechain.io/tx/0xa1787feee6ba856bcec74185db2748e3a2be347cfefaa0523aab0213c87b1b03) | Delivered, buyer reported a problem ([openDispute](https://explorer.testnet.whitechain.io/tx/0xd64d92cb531fe9a3e0af4598c06cee19bf382bf0e7d535e4e07c189505c31657)), the arbiter key resolved it as a **50/50 split** ([resolveDispute](https://explorer.testnet.whitechain.io/tx/0x317912f725369419fb9086c1d9ead89a28b7aaedda0383c4bf6397bedcacb3d7)) |
| #17 | @meera.jewels, 1.00 | [pay](https://explorer.testnet.whitechain.io/tx/0x46be3418165ffb4875fd56598e34dd299961199602498e25f89c816e20eb99c2) | Driven to release by the driver: [ship](https://explorer.testnet.whitechain.io/tx/0x837264376c34d7901a25ba600d06f651e417586105294882613feb7ecceb7973), [deliver](https://explorer.testnet.whitechain.io/tx/0x831e57cc3e729de06190b90bb3eb00cae075a333021d4f155335f3aefc046bfe), [finalize](https://explorer.testnet.whitechain.io/tx/0x729fc4819ef49d29c451abf04180e43fc9f263440d6868047e7a23ec42e9b988), [withdraw](https://explorer.testnet.whitechain.io/tx/0x4bb0d99e0d3bc368714487cd8df378a8a6033438ce1f03c90563f82f753e9487) |
| #18 | @kurta.co, 1.50 | Paid in a browser through the live Kurta store: [pay](https://explorer.testnet.whitechain.io/tx/0x3ed1afc4ce4610057bf80707964b93f4435eafde76fedd3dd465e7390401509e) | Driven to release by the driver: [ship](https://explorer.testnet.whitechain.io/tx/0x3d8b86873cdf176de0addb548b10dce1863f1b87eb19784e0857f93fe664b2ef), [deliver](https://explorer.testnet.whitechain.io/tx/0x176b2ba3a21d07952cdf2b3ab196f52a3d9e59e6ffe5b044520055fccb45c27f), [finalize](https://explorer.testnet.whitechain.io/tx/0xb2039b9f5da80b144147510747636f6006ffdf406ae6fa2ff84e5fff37640a39), [withdraw](https://explorer.testnet.whitechain.io/tx/0xbf3c31b6b9086e76cdcd6074bdf7e32af3861c836135cfce371c2e916b7072f4) |
| **#19** | @kurta.co, 1.50 | **Paid by a person on a real phone over mobile data (4G) through the live Kurta store, Fri 6 Nov about 19:26 IST** (the chain timestamp of the payment is 13:56:24 UTC, which is 19:26:24 IST): [pay](https://explorer.testnet.whitechain.io/tx/0x28d7bcaade234cb29b7d5a8fa8e987a26227a82f8229852a903e6134dbf38fd7) | Driven to release by the driver: ship [`0x9b5bed42…b1708`](https://explorer.testnet.whitechain.io/tx/0x9b5bed420f52621de57c8ec3081fd5e7de7308c699dd154bf1d8091baf4b1708), deliver [`0x98275553…b38048`](https://explorer.testnet.whitechain.io/tx/0x9827555357b8d0c8026ab8f231c7544cebb68517be4d4c79ef740894a6b38048), finalize [`0xe33009d0…b886`](https://explorer.testnet.whitechain.io/tx/0xe33009d0d04778e0e18f402ccc1e38e3a85684bf5033091e9ae9caeb3851b886), seller withdraw [`0xae66158d…f11058`](https://explorer.testnet.whitechain.io/tx/0xae66158d2bfd798b5e0cf97d4438ec2b74c76349989f94725f406e99c2f11058) |

Order #19 is the only order here placed from a phone. The seller (@kurta.co) had 3 or more completed orders by then, so its problem window was the short one: finalize came 36 blocks after delivery.

### World ID reviews (staging environment, World Simulator on a laptop, done by a person)
| Result | Seller and order | When | Log row on /proof | Nullifier hint (first 12 hex characters, not an id) |
|---|---|---|---|---|
| **Verified**, review published | @meera.jewels, order #1 | 16:43 IST (11:13:05 UTC) | id 5 | `f2d508a533b2` |
| **Verified**, review published | @kurta.co, order #18 | 19:11:55 IST (13:41:55 UTC) | id 8 | `595fe89d6634` |
| **Replay refused** ("nullifier already used for this seller, or order already reviewed"), nothing written | @meera.jewels, order #17, the same person as order #1 | 19:04 and 19:05 IST (13:34:17 and 13:35:12 UTC) | ids 6 and 7 | `f2d508a533b2` (the same person gives the same hint for the same seller) |

The simulator showed Unique Human with World ID 4.0 selected. The earlier 08:46 UTC "rejected" rows (ids 1 to 4) came from scripted probes, not from a person.

Arkiv entities written by these two verified reviews (creator is the attestor, readonly, owner is the buyer wallet): order #1 [`0xa444fb932ea107e2814e191d8adc878e5936fd70c64ea4bd90c936e508c03508`] and order #18 [`0x5f509ea8843c62d9c4b8c10de5a219710de819d62cdf0a43eea3301d6065f42b`]. Both are read by PoP's key and by the Kurta store's own key (`scripts/arkiv-query.ts`, Fri 6 Nov, 12 attestor entities seen by each key: 2 real reviews, 9 DEV entries from fork tests, 1 smoke entity).

**A World review cannot be completed on a phone with the staging simulator.** The World widget asks for the real World App on a phone, so the reviews above were done on a laptop with the Simulator. The phone order #19 was paid and settled, but not reviewed.

## Persistent demo scenes seeded on testnet (Fri 6 Nov 2026, 19:48 IST, `scripts/seed-demo.ts`, default scenes 4 and 5)
| Scene | What was created | Tx |
|---|---|---|
| 4 banned seller | @bad.bazaar registered (`registerSeller`) | [registerSeller](https://explorer.testnet.whitechain.io/tx/0xfb127e3ca5661e17cacbbb59865ef65cf4f71989347eceaaf22fe01679119fa1) |
| 4 banned seller | open order **#20**, 1.00 test USDT, paid and left Funded | [pay](https://explorer.testnet.whitechain.io/tx/0x0b8ef1dec614832af421b61765bd3cee3a3f07e987551ddb1c78172e557b6771) |
| 4 banned seller | seller banned by the arbiter key (permanent) | [ban](https://explorer.testnet.whitechain.io/tx/0x3834d4db53bb1e390e041c495cc55b42022f72ac871bba6b5c5a77d068077561) |
| 5 look-alike | listing `demo-fake-meera` for @meera.jewels.official, a handle that is NOT registered (database row only, no transaction) | none |

Checked through the live APIs the pages read (not by looking at the pages): `/api/verify/bad.bazaar` is 404 with reason `banned`; `/api/verify/meera.jewels.official` is 404 with reason `unknown`; `/api/listings/demo-fake-meera` is 200 with `sellerStanding.active: false` (the checkout disables Pay when the seller is not active); `/api/arbiter/seller?handle=bad.bazaar` shows banned and the open order #20 (Funded, 1.00). **Order #20 has not been force-refunded**; it is the force-refund scene for the demo (arbiter page, look up @bad.bazaar, Force refund). The timed scenes 1 to 3 were not seeded.

## Live deployments (Vercel Pro)
| What | Value | Checked |
|---|---|---|
| PoP web | https://pop-web-six.vercel.app | Fri 06 Nov 2026 17:43 IST: `scripts/vercel-smoke.ts` 11 of 11 PASS |
| Kurta Co. store | https://kurta-store.vercel.app | Fri 06 Nov 2026 17:43 IST: same run, store checks 4 of 4 PASS |
| Merchant row for @kurta.co (schema `public`) | webhook URL `https://kurta-store.vercel.app/api/pop/webhook`, return origin `https://kurta-store.vercel.app` | Fri 06 Nov 2026 17:43 IST: `npm run seed:merchant` in testnet mode; output said `@kurta.co already registered`; no transaction sent |
| Webhook dispatcher | `GET https://pop-web-six.vercel.app/api/webhooks/dispatch` answered 200 with `{"scannedTo":12370672,"enqueued":0,"delivered":0,"failed":0}` | Fri 06 Nov 2026 17:43 IST. Whether the Vercel cron fires on its own is not proven yet; the 5 second loop we ran hides it |

Re-run: `npx tsx scripts/vercel-smoke.ts https://pop-web-six.vercel.app https://kurta-store.vercel.app`

## Order #11: paid through the web checkout by a browser (Fri 6 Nov 2026, about 17:55 to 17:58 IST)
Kurta Co. on https://kurta-store.vercel.app, "Pay with PoP", PoP checkout on https://pop-web-six.vercel.app with the in-page TEST MODE wallet (a fresh browser wallet `0xF8262B3e43DE0E4d82ec7D0285a6720B1588428b`, funded by the faucet inside the page). Session `s_18f7d33d43a1153e`, store reference `KC-9E24AE5A`, 1.50 test USDT, TEST values and fake delivery details. The payment, the redirect and the order page were driven in Chrome. Shipping, the courier step, finalize and withdraw were sent by a script (`scripts/_drive-store-order.ts`, a temporary file not kept in the repo) with the store merchant wallet, the courier wallet and the deployer wallet as the third party; the buyer's 6 words were read from the order page.
| Step | Tx |
|---|---|
| Faucet sends 0.05 WBT to the browser wallet (block 12371557) | [`0xdb689b94…9d3f30`](https://explorer.testnet.whitechain.io/tx/0xdb689b94211b153c43d16f368f42e73ab583973e9307166e3d7b508e6c9d3f30) |
| Faucet sends 2 test USDT (block 12371559) | [`0x429f9c63…805100`](https://explorer.testnet.whitechain.io/tx/0x429f9c6320f0272c1d2866f70e93cba5f9ae79d13ad88ed1410bc5b0b8805100) |
| Buyer `approve` 1.50 USDT (block 12371563) | [`0x40e3c5cd…42813a`](https://explorer.testnet.whitechain.io/tx/0x40e3c5cdfee85847b2c3f8f8ac7d1450513b5659acb593c1318c0afebb42813a) |
| Buyer `pay`, order **#11** (block 12371566) | [`0xdaa45657…c19d17`](https://explorer.testnet.whitechain.io/tx/0xdaa45657ffae0e638b54ec9ef9e0fc1f0a0e4aecb13ea2e4a88de3bcedc19d17) |
| Merchant `markShipped` (block 12371597) | [`0x038d8f8b…bee913`](https://explorer.testnet.whitechain.io/tx/0x038d8f8b501c44b7d8f5e73ee5e47427f074e8e93db83aa8f10e191534bee913) |
| Courier `confirmDelivery` with the buyer's 6 words (block 12371600) | [`0xdf0db4c7…ad75e9`](https://explorer.testnet.whitechain.io/tx/0xdf0db4c7d65d68d4aa0f298621ee258abf0be924ba25bfafb906e95999ad75e9) |
| Third party `finalize` after the problem window (block 12371635) to Released | [`0xee163815…d3d179`](https://explorer.testnet.whitechain.io/tx/0xee163815e16110c405d2918287c8cf075edbafc9e7c58e4beea6f7e464d3d179) |
| Seller `withdraw` (block 12371638) | [`0x087e45bd…39fe3c`](https://explorer.testnet.whitechain.io/tx/0x087e45bd1420d224dc10618f1ac0aa79662f346ec74b82d5d2f2a2db0d39fe3c) |

Store side (read from the live store, `GET /api/orders`, and from `webhook_deliveries` in schema `public`): order book entry `KC-9E24AE5A` is `released` with history funded, shipped, delivered, released, each with the on-chain state the store rechecked. Four webhooks (`order.funded`, `order.shipped`, `order.delivered`, `order.released`), all `delivered` on attempt 1. The store's `/orders` page shows the order as complete. PoP's "Back to Kurta Co." link points at `https://kurta-store.vercel.app/orders`. The proof page lists order 11 after the next read.

## Demo dry run on the live sites (Fri 6 Nov 2026, about 18:30 to 18:55 IST)
Orders #13 to #16 on 1874, test USDT only, 1.00 each, paid by wallets driven from a script (no browser). Timings and findings are in `docs/demo-script.md`. Never-shipped orders #13 and #14 were settled into refunds by a third party after their 180 s ship-by (their random buyer wallets were not kept, so their 2 test USDT refund credit stays in the checkout contract). #15 is the full release path through `scripts/demo-driver.ts`. #16 is the report-a-problem path: delivered, buyer `openDispute`, arbiter 50/50 split, both sides withdrew.
| Order | Step | Tx |
|---|---|---|
| #13 | pay | [`0xbc9bf6c1…9ae83a`](https://explorer.testnet.whitechain.io/tx/0xbc9bf6c195a1d44946ab3bb437d39b580429cb1afeb1de7a5387bda3ac9ae83a) |
| #13 | Settle now (finalize) to Refunded | [`0xe1eacd03…21a74b`](https://explorer.testnet.whitechain.io/tx/0xe1eacd034208f5bfdd7274f4f174f6b1e9b17eb40b618e4cefc2d4168621a74b) |
| #14 | pay | [`0xc8ff8a30…e53bfa`](https://explorer.testnet.whitechain.io/tx/0xc8ff8a30d7895672538f6dfb9e0e41d90f22ecbd1b22720a6f7334b0c8e53bfa) |
| #14 | Settle now (finalize) to Refunded | [`0x9f9fda2a…70236f`](https://explorer.testnet.whitechain.io/tx/0x9f9fda2a8b0ba57a86151fd911616cc6a14df436d75090c76915aea81470236f) |
| #15 | pay | [`0xe94b0693…d8eeec`](https://explorer.testnet.whitechain.io/tx/0xe94b069368eaaf22e994b74c613163c55b9e63efe5c2e8e701e77c0657d8eeec) |
| #15 | ship, courier delivery, finalize, seller withdraw 0.99 USDT | listed with full links on `/proof` (order 15) |
| #16 | pay | [`0xa1787fee…7b1b03`](https://explorer.testnet.whitechain.io/tx/0xa1787feee6ba856bcec74185db2748e3a2be347cfefaa0523aab0213c87b1b03) |
| #16 | buyer `openDispute` | [`0xd64d92cb…c31657`](https://explorer.testnet.whitechain.io/tx/0xd64d92cb531fe9a3e0af4598c06cee19bf382bf0e7d535e4e07c189505c31657) |
| #16 | arbiter `resolveDispute` 50/50 split | [`0x317912f7…acb3d7`](https://explorer.testnet.whitechain.io/tx/0x317912f725369419fb9086c1d9ead89a28b7aaedda0383c4bf6397bedcacb3d7) |

Also: 4 test USDT moved from the faucet wallet to the test buyer wallet (`0x056df20d…283b6873`) so a seed run would have funds; the seed itself was not run on testnet.

## Whitechain Sepolia (1874)
| What | Value | Link |
|---|---|---|
| Specified test USDT | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`: name "Tether USD", symbol USDT, **decimals 6**, totalSupply ~1,945,273 (read Fri 6 Nov 00:05 IST, block 12306918) | https://explorer.testnet.whitechain.io/address/0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7 |
| Test USDT acquisition | WBT swapped to USDT on YetiTrade: tx [`0x382599b2410c59a0c6515b83cd7d4dc131854317f2ace32b996978f18ed5d54d`](https://explorer.testnet.whitechain.io/tx/0x382599b2410c59a0c6515b83cd7d4dc131854317f2ace32b996978f18ed5d54d), block 12327812. The Whitechain flyer confirms this token and says it supports permit + EIP-3009 | https://explorer.testnet.whitechain.io/address/0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7 |
| Faucet wallet balances (read on-chain Fri 6 Nov) | `0x012f9baaDbCF059Fc70DAFcD7eB109404e703A43`: **25 USDT** (25000000 raw) + **0.5 WBT** | https://explorer.testnet.whitechain.io/address/0x012f9baaDbCF059Fc70DAFcD7eB109404e703A43 |
| Deployer balance (read on-chain) | `0xB7C637cb5a37abbA288ca51f1d2Fd0c6776ABb2c`: 2 WBT | |
| **PoPCheckout** (deployed Fri 6 Nov, block 12330545) | [`0xB6A894bE070951a7331DebFf615e11F7a076794c`](https://explorer.testnet.whitechain.io/address/0xB6A894bE070951a7331DebFf615e11F7a076794c?tab=contract) | **Verified on Blockscout** (compiler v0.8.30, evm prague, optimizer 200 runs). Deploy tx [`0x179e2cfd…e1d4ed`](https://explorer.testnet.whitechain.io/tx/0x179e2cfdd423a5356cd4c4dd2bf55115501f5bce37a6801aefff49e4c9e1d4ed) |
| **SellerRegistry** (deployed Fri 6 Nov, block 12330545) | [`0x6D61cD77239dd61e43e943a4Aac006d8A6C285E5`](https://explorer.testnet.whitechain.io/address/0x6D61cD77239dd61e43e943a4Aac006d8A6C285E5?tab=contract) | **Verified on Blockscout** (same settings). Deploy tx [`0xf0196821…f5dfa8`](https://explorer.testnet.whitechain.io/tx/0xf0196821f93bcdeb21d27b2bb631a0ae200bd2f44eab2b14b0848bae22f5dfa8) |
| Creation block check (read from the chain, Fri 6 Nov) | Both deploy transactions above have receipts with `status` success in block **12330545**; each receipt's `contractAddress` equals the address in the rows above; `getCode` at block 12330544 returns nothing at both addresses and bytecode at 12330545. Block 12330545 is timestamped 2026-11-06 01:01:53 UTC. `deployments/testnet.json` used to say 12330534 (the block the deploy script read before sending, 11 seconds earlier); it now says 12330545 | RPC `https://rpc.testnet.whitechain.io`, `eth_getTransactionReceipt` and `eth_getCode`, read only |
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

### Late-ship refund order (Fri 6 Nov, order #2, 1.00 test USDT)
The seller never shipped; real time passed the ship-by deadline (180 s); a third party (the deployer wallet, not buyer, seller or courier) called `finalize`; the buyer withdrew the full refund. `OrderRefunded` reason 1 (no ship), amount 1000000 (1.000000 USDT), no fee.
| Step | Tx |
|---|---|
| Buyer `approve` 1.00 USDT (block 12331733) | [`0xfd1b7227…5863f7`](https://explorer.testnet.whitechain.io/tx/0xfd1b7227c996bd03e5496490a7de72cd8f0985f87657f9c82ddb9583165863f7) |
| Buyer `pay` (block 12331736) | [`0x924b43d9…b0bb50`](https://explorer.testnet.whitechain.io/tx/0x924b43d9454d01c9a9c3ab7116e1f5499f2a8f8f9bc743b0c3ce303fa4b0bb50) |
| Anyone `finalize` after ship-by (block 12331922) → Refunded | [`0xa9d9489e…8f0278`](https://explorer.testnet.whitechain.io/tx/0xa9d9489ed3094a5497b3ff6982abf3ec7b5ddad3559423a6d3ad696aa28f0278) |
| Buyer `withdraw` 1.00 USDT (block 12331926) | [`0xea25db67…03008e`](https://explorer.testnet.whitechain.io/tx/0xea25db67fa057553cd95c6915ac60fa04fab48e78b56d1be4fc28dacb403008e) |

Result: buyer credit 0 → 1,000,000, then the buyer's USDT balance went back to 4.000000; `totalLocked` = 0. The seller was paid nothing and `completed(seller)` stays 1. Script: `scripts/testnet-refund.ts` (testnet-only, guarded, run once).

### Pay with PoP + Kurta Co. demo store on 1874 (Fri 6 Nov, `scripts/e2e-merchant.ts` TESTNET PASS, 41 checks)
Merchant @kurta.co (wallet `0xB6a8fA0698Fdf0a8CD1b94e9101dCE39E63358Cf`, tier 1) sells through `@pop/checkout-sdk`: the store's own server signs each Offer with its own seller key and creates a single-use checkout session with its API key; the buyer pays on PoP's hosted checkout; PoP sends HMAC-signed webhooks; the store verifies the signature AND rechecks the order on-chain before changing its order book. Test USDT only (1.50 per order).
| Step | Tx |
|---|---|
| Fund merchant wallet gas (0.02 WBT from deployer) | [`0xc86b5e40…0dbdc4`](https://explorer.testnet.whitechain.io/tx/0xc86b5e40896f36e1e64f399c31156c13914d8c160e99b2329baa50fdbc0dbdc4) |
| `registerSeller` @kurta.co (attestor-signed) | [`0xc1094b7e…63c399`](https://explorer.testnet.whitechain.io/tx/0xc1094b7eee5bc018754b261fe4cbbc9a010dee23b7bc537e6e7d971e8463c399) |
| Order #3 (session A) `pay` (block 12333158) | [`0x7bdbd73f…f40120`](https://explorer.testnet.whitechain.io/tx/0x7bdbd73f594d9bbf0a54f1bf9312e0473fa3622a87deb27c6c0f317e7ef40120) |
| Order #3 `markShipped` (block 12333190) | [`0x2498e500…4d2316`](https://explorer.testnet.whitechain.io/tx/0x2498e50030094ac4a14fbf073eb49c364459067a7198bb98763740e5234d2316) |
| Order #3 courier `confirmDelivery` (block 12333198) | [`0x0862f718…dabc20`](https://explorer.testnet.whitechain.io/tx/0x0862f7183450a4ecfa6c790269b2efa022e9bbef8e509cc7152e38c82edabc20) |
| Order #3 `finalize` → OrderReleased (block 12333323) | [`0xe924962b…3163d0`](https://explorer.testnet.whitechain.io/tx/0xe924962b6eb53b871b60867d9f81f2c056cdc04606eb27744688db12ac3163d0) |
| Order #4 (session B, never shipped) `pay` (block 12333174) | [`0x840d363c…02917e`](https://explorer.testnet.whitechain.io/tx/0x840d363c7da00e546c7524c26067c906622def0047490bcea41176191f02917e) |
| Order #4 `finalize` → OrderRefunded (block 12333361) | [`0xdfc9bb74…84157b`](https://explorer.testnet.whitechain.io/tx/0xdfc9bb74441678acd4a5e73c8edb8b5f09c136eb8fa72c8ba7196acd9b84157b) |

Webhooks for these orders (table `webhook_deliveries`, schema `public`): 6 rows (order #3: funded, shipped, delivered, released; order #4: funded, refunded), all `delivered` on the first attempt. The store's order book showed funded → shipped → delivered → released for #3 and funded → refunded for #4, each status set only after the signature check and the on-chain recheck. The same script also proves the refusals: no/wrong signature, a replayed (old) signature, a body changed after signing, a signed "refunded" for an order that is not refunded, a wrong amount, a mismatched merchantRef, a non-existent order id (all rejected, order book unchanged). The store reads its record directly (contract counters + Arkiv with its own key): 1 of 2 completed at that point. Order #4's 1.50 USDT refund is credited to the test buyer in the checkout (`withdraw` not called, kept for the next test).

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
