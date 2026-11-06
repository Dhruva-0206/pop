# Limitations

What PoP does not do or cannot promise today. Written from what the repository does, not from what we hope.

## Delivery and disputes
- **The courier is simulated.** A person on the team plays the courier page. Release depends on the buyer's delivery code, not on courier data, and the courier key cannot release or refund money. But "handover refused" is reported by that same simulated courier, so the only real-world delivery signal in the demo is the buyer's code.
- **One arbiter key.** Disputes (refund, release or split) and bans are decided by one team-held wallet. If it is lost or abused, there is no second signer. If nobody decides within the arbiter timeout, the buyer is refunded automatically, which limits the damage but is not a decision. A multi-signature or on-chain jury is the obvious next step and is not built.
- **The deployer wallet holds the admin role** on both contracts. It cannot move funds or change a deadline, but it can grant or revoke the courier, arbiter and attestor roles. Anyone who controls that key controls who can decide disputes.
- **The arbiter signs from a pasted test key in a browser.** Acceptable for a test network. Not acceptable for real money.
- **A buyer can report a problem only inside the dispute window.** After it the seller is paid.
- **The dispute window is short and set by the seller's record** (30 seconds for trusted sellers, 120 seconds for others, in the demo). Real orders would use days.

## Sellers and reputation
- **A seller can buy from a second wallet they control.** The contract blocks `msg.sender == seller`, not a second wallet, so someone can still raise their own "orders completed" count with their own money. The cost is the 1% fee and gas, which is cheap on a test network.
- **Handle proof is a staff check of a bio code (tier 1).** A person on the team looks at the Instagram bio. It proves control of the handle at that moment, not who the seller is or that they will deliver.
- **World ID proves "a unique person", not "a good person".** The proof is verified on the Simulator (staging) only; a real phone needs a production action. One review per person per seller depends on one World action per seller, created by hand in the portal.
- **Reviews can be refused, not edited.** Our writer wallet creates the Arkiv entity. A buyer's review is signed by the buyer, so we cannot change it, but we can fail to publish it. A retry path exists. Reviews expire after about 180 days by design.
- **A checkout redeploy resets every seller's visible history,** because readers count only payments on the current contract. We will not redeploy.

## Privacy and data
- **Everything on chain is public.** Seller volumes, buyer wallets and order timings can be linked by anyone.
- **Delivery details are encrypted in Postgres, but we hold the key.** `ADDRESS_ENC_KEY` is a server secret. The seller sees the ship-to details of their own orders.
- **The database connection uses SSL without certificate verification** (`rejectUnauthorized: false`), because the Supabase pooler certificate is not in Node's trust store. Traffic is encrypted but the server is not authenticated. This should be fixed by pinning the Supabase CA before real use.

## Money
- **Test USDT only.** It has no value. Real rupee payments would need a licensed payment partner and a legal review that this project has not done.
- **The checkout contract has not been audited.** It has 58 Foundry tests (unit, fuzz and an invariant suite) and was reviewed by the team, not by an outside firm.
- **Demo windows are minutes** (ship within 3 minutes, deliver within 5). The constructor takes them as parameters; production values would be days, and the arbiter timeout 14 days.
- **No time override exists in the contracts.** That is a safety choice and it makes demos slower: every deadline in a demo is real time.

## Software
- **The dev-only flag `POP_DEV_SKIP_WORLD`** skips the World proof for local testing. It refuses to run on any deployed build, and entries it writes are labelled DEV and expire in 24 hours. It must stay unset on Vercel.
- **Rate limits are simple.** Session creation is limited per merchant in Postgres and is not atomic under heavy parallel load. The faucet has a daily cap per address and a global cap.
- **Webhooks have no queue.** A dispatcher scans the checkout's events and retries failed deliveries up to 8 times. It runs when order pages are opened, from a script, or from a cron that is not configured yet.
- **Only five webhook events** are sent (funded, shipped, delivered, released, refunded). Disputes and splits are not.
- **Not tested:** screen readers with a person, real phones, Safari, more than a few concurrent users, two simultaneous review claims racing.
