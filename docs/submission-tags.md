# Submission-form tags (only what the code really uses)

| Category | Tag | Justification (where in the repo) |
|---|---|---|
| Blockchain networks | EVM | Solidity contracts in `contracts/src`, viem clients |
| Blockchain networks | Optimism | Whitechain Sepolia is an OP Stack L2 (docs.whitechain.io); contracts deploy there |
| Ethereum developer tools | Foundry | `contracts/` built and tested with forge 1.9.0 |
| Ethereum developer tools | OpenZeppelin SDK | OpenZeppelin Contracts v5.6.1 in `contracts/lib` (SafeERC20, EIP712, ECDSA, ReentrancyGuard, AccessControl) |
| Web frameworks | Next.js | `apps/web`, `apps/demo-store` (Next 16.4.5, App Router) |
| Web frameworks | React.js | React 19 in both apps |
| Databases | PostgreSQL | `supabase/migrations/0001_init.sql` |
| Databases | Supabase | Hosted Postgres for private data: the project exists, `0001_init.sql` is applied to schemas `public` (testnet) and `pop_fork` (local fork); used by `packages/shared/src/server/store.ts` |

Not in a dropdown (README "Tools used"): viem, @arkiv-network/sdk 1.0.1, @worldcoin/idkit 4.x, Tailwind, qrcode, html5-qrcode, @scure/bip39, zod, Vercel (two live projects).
