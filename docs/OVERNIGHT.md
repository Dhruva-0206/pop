# Overnight log

Autonomous run while the team slept. Rules followed: small commits pushed after each step, no AI trailers, no keys printed, no wallet regeneration, no contract redeploy, no Vercel deploy, no new testnet transactions beyond the ones listed in the plan. Times are IST, Fri 6 to Sat 7 Nov 2026.

## Step 0: safe state
- Interrupted testnet e2e: nothing left mid-flight. On 1874 orders #1 to #10 are all terminal (odd ids Released, even ids Refunded), `totalLocked` is 0, next order id is 11. The merchant rate limit is 30 per minute (a crashed run had left it at 1 earlier; I restored it and the e2e now restores it in a `finally`).
- Orders key: the store's orders are unique on (checkout address, order id) since `913153a` (in place upgrade drops the old index). Fork `e2e-merchant.ts` passed 48/48 on that commit.
- Testnet `public` schema is migrated (onboarding_requests, world_verifications, rate_limit_per_min present, existing rows kept).
- Testnet `e2e-merchant.ts` PASSED 47 checks with real time on orders #9 and #10, using the store's own Arkiv key. Two earlier attempts failed for test reasons (webhook receiver slower than 5 s on the real network, and a rate-limit probe that needed a fresh session), both fixed below.
