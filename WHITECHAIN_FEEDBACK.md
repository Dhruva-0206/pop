# Whitechain feedback

We are Dhruva Somen Chakrabarty, Shantanu Somwanshi and Tanishqa Chopade. We built PoP, a protected checkout for small sellers, on Whitechain Sepolia (chain 1874) during ETHGlobal Mumbai 2026. This is what happened to us, in the order a builder would hit it. Where something is reported by one of us and not independently checked, we say so.

## What we built on Whitechain

A buyer pays the specified test USDT into a contract. The money comes back to the buyer automatically if the parcel is late, and it is paid to the seller when the buyer's own code is entered at the door. We deployed two contracts ([PoPCheckout](https://explorer.testnet.whitechain.io/address/0xB6A894bE070951a7331DebFf615e11F7a076794c?tab=contract) and [SellerRegistry](https://explorer.testnet.whitechain.io/address/0x6D61cD77239dd61e43e943a4Aac006d8A6C285E5?tab=contract), block 12330545) and ran 25 test orders through them at last count: releases, deadline refunds, a dispute split, merchant orders through our SDK, and one order paid from a real phone over mobile data. Every transaction is in [docs/evidence.md](docs/evidence.md).

## What worked

- The chain and the public RPC were steady for the whole build. No transaction failed because of the network.
- Blockscout verification worked inside the same `forge script` command that deployed the contracts. Both contracts show as verified (compiler 0.8.30, EVM Prague, optimizer 200 runs).
- The specified USDT (`0xcedf...55a7`) is a normal 6 decimal token. Our checkout uses plain `approve` and `transferFrom`.

## Where we got stuck, and what we suggest

1. **`eth_getLogs` is limited to 10,000 blocks per call.** The RPC answers "query exceeds max block range 10000". A scan that starts at the deploy block works for a few hours and then fails for good. We hit it first in the Kurta store's record endpoint, and the same pattern was in several of our own endpoints (seller records, the arbiter list, the CSV export, the webhook dispatcher, the badge). We fixed it with a `chunkedLogs` helper that reads 9,000-block ranges. We found no mention of the limit in the docs. Suggestion: state it next to the RPC endpoint.
2. **The specified test USDT is hard to get.** The faucet gives WBT only. We got the USDT by swapping WBT on YetiTrade (transaction in `docs/evidence.md`). The network reference page we checked on 7 Nov lists no stablecoin at all, and on Thursday night another docs page listed a different USDT (`0xaa79...8f46`, "USDT.e") and not the prize address. We have not re-checked that second page. Suggestion: say which USDT a build must use and how to get it.
3. **Faucet amount.** One of us reported that the faucet paid 2 WBT while the docs said 0.5 WBT per 24 hours with a GitHub login. We did not capture the transaction and the faucet page does not state the amount, so treat this as reported, not verified. Suggestion: make the docs and the faucet agree.
4. **The YetiTrade WBT approval failed until we changed the RPC in the wallet.** We never found out why. Because this swap was our only route to the prize USDT, a working default RPC for the DEX matters. We did not record the failing attempts; the working swap is in `docs/evidence.md`.
5. **One IP polling hard got HTTP 403 from the public RPC.** Whitechain's docs say the limit is 50 requests per second per IP and that going over returns 429 with a `Retry-After` header. We saw 403 instead, while several scripts and a polling loop shared one network. Suggestion: return the 429 the docs describe, so a client can back off.
6. **Blockscout shows the license of both contracts as "none"**, although the source files carry `SPDX-License-Identifier: MIT`. It is cosmetic, but it looks like missing information to a reviewer.
7. **Webhook receivers need time on a real network.** Our merchant receiver rechecks each order on chain before it answers. On a local fork it answered in about 2 seconds. On Whitechain Sepolia, about 2 of 12 deliveries across two runs passed our 5 second timeout and succeeded on the retry, so we raised the timeout to 15 seconds. The round trip to the RPC is part of any "verify on chain before you trust a webhook" design.
8. **The test USDT is a proxy**, and its balance is not a plain mapping in the first storage slots. Writing balances on a local fork meant finding the slot from an access list. This is not a Whitechain bug, but a line in the docs about the token's implementation would help builders who test on a fork.
9. **Foundry on Windows.** The docs say PowerShell and Command Prompt cannot run Foundry and suggest WSL. It also runs from Git Bash, which is what we used. Suggestion: mention Git Bash.
10. **Our own deploy script hid the verification result.** `scripts/deploy.ts` printed only the addresses, so we confirmed "verified" through the Blockscout API. This one is ours, but it is worth knowing for anyone who wraps `forge script`: if verification fails after a successful broadcast, a wrapper that throws looks like a failed deploy and invites a second, duplicate deploy.

## Numbers from our run

- Deployed in block 12330545. The estimated cost was about 0.053 WBT at most; the deployer spent about 0.0204 WBT on the actual deploy.
- Whitechain's docs give a 1 second block time for Whitechain Sepolia.
- The contracts, the orders and the full transaction links are in [docs/evidence.md](docs/evidence.md) and on [/proof](https://pop-web-six.vercel.app/proof).
