# Arkiv friction log
Expected versus actual, with how to reproduce. Mirrors the Arkiv entries in `docs/friction-log.md`.

1. **Chains in the docs.** Expected: the API sidebar lists the chain we need. Actual (Thu 23:55): it lists `localhost` and `tiramisu`, while the guides import `rabdi`. Installed SDK 1.0.1 exports `rabdi` and `localhost` and no `tiramisu`. Repro: `Object.keys(await import("@arkiv-network/sdk/chains"))`.
2. **Query operators.** Expected: `ne` and `not` as the docs site lists. Actual: SDK 1.0.1 does not export them (the official skills repo says the same). Workaround: filter in code after the query. We keep only rows whose creator is our attestor and that are readonly, so this cost nothing.
3. **Access key in the RPC URL.** `rabdi({ accessKey })` puts the key in the URL, and viem errors include the URL. A failed read could print the key into a log or a page. We scrub the key and URLs from every error before it is stored or returned (`scrub()` in `apps/web/src/lib/server/reviews.ts`).
4. **Expiry is a block number.** `$expiresAt` comes back as a block number. To show "expires in 11 hours" an app has to know the block time. We show the block number on `/proof` and say so.
5. **Entity identity after a restart.** Our `order_id` restarts at 1 on every fork restart or checkout redeploy, so (`order_id`, `seller`) alone matched an older entity owned by a previous test buyer. Not an Arkiv bug, but the lesson was ours to learn: the key must include something globally unique, so we also match `pay_tx`.
6. **Query results are pages.** `fetch()` returns pages with a `skipped` count; a reader must page with `limit` and `offset`. We read in pages of 100.
7. **Writes need a single writer.** Two writes at once from one key race on the nonce. We serialise all writes in one process with a mutex and set an explicit gas limit.

Nothing here blocked us.
