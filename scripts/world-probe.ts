/**
 * World smoke D without a human: probes our routes and World's staging verify host with deliberately invalid proofs.
 * Needs the web app running in testnet mode WITHOUT POP_DEV_SKIP_WORLD. Makes no on-chain transactions, writes no review.
 * Usage: NETWORK_MODE=testnet npx tsx scripts/world-probe.ts
 */
import { hashSignal } from "@worldcoin/idkit/hashing";
import { encodePacked, keccak256, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { reviewAuthMessage } from "../apps/web/src/lib/messages";
import { need, opt } from "./env";

const WEB = opt("WEB_URL") ?? "http://localhost:3000";
const RP = need("WORLD_RP_ID");
const buyer = privateKeyToAccount(need("TEST_BUYER_PK") as Hex);
const show = (label: string, status: number, body: unknown) => console.log(`${label}: HTTP ${status} ${JSON.stringify(body).slice(0, 400)}`);

// 1) World's v4 verify endpoint with a syntactically valid but fake proof, for each action (does an unknown action differ from a known one?)
for (const action of ["review-meera-jewels", "review-does-not-exist-xyz"]) {
  const signal = keccak256(encodePacked(["uint256", "address"], [1n, buyer.address as Address]));
  const body = {
    protocol_version: "4.0",
    nonce: "0x" + "11".repeat(32),
    action,
    environment: "staging",
    responses: [
      {
        identifier: "proof_of_human",
        issuer_schema_id: 1,
        nullifier: "0x" + "22".repeat(32),
        expires_at_min: Math.floor(Date.now() / 1000) + 3600,
        proof: Array(5).fill("0x" + "33".repeat(32)),
        signal_hash: hashSignal(signal),
      },
    ],
  };
  for (const host of ["https://developer.world.org"]) {
    const r = await fetch(`${host}/api/v4/verify/${RP}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    show(`verify ${host} action=${action}`, r.status, await r.json().catch(() => ({})));
  }
}

// 2) Our review route with a fake IDKit result: must be refused, nothing written
const text = "probe";
const sig = await buyer.signMessage({ message: reviewAuthMessage("1", "meera.jewels", 5, text) });
const fake = { protocol_version: "4.0", nonce: "0x" + "11".repeat(32), action: "review-meera-jewels", environment: "staging", responses: [{ identifier: "proof_of_human", signal_hash: hashSignal(keccak256(encodePacked(["uint256", "address"], [1n, buyer.address as Address]))), nullifier: "0x" + "22".repeat(32), proof: Array(5).fill("0x" + "33".repeat(32)), issuer_schema_id: 1, expires_at_min: 9999999999 }] };
const post = async (label: string, body: unknown) => {
  const r = await fetch(`${WEB}/api/world/verify-review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  show(label, r.status, await r.json().catch(() => ({})));
};
await post("our route: no proof", { seller: "meera.jewels", orderId: "1", rating: 5, text, buyerSignature: sig });
await post("our route: wrong action in result", { seller: "meera.jewels", orderId: "1", rating: 5, text, buyerSignature: sig, idkitResult: { ...fake, action: "review-kurta-co" } });
await post("our route: wrong signal", { seller: "meera.jewels", orderId: "1", rating: 5, text, buyerSignature: sig, idkitResult: { ...fake, responses: [{ ...fake.responses[0], signal_hash: "0x1234" }] } });
await post("our route: wrong environment", { seller: "meera.jewels", orderId: "1", rating: 5, text, buyerSignature: sig, idkitResult: { ...fake, environment: "production" } });
await post("our route: fake proof, right action+signal", { seller: "meera.jewels", orderId: "1", rating: 5, text, buyerSignature: sig, idkitResult: fake });
await post("our route: skipWorld attempt (flag off)", { seller: "meera.jewels", orderId: "1", rating: 5, text, buyerSignature: sig, skipWorld: true });
process.exit(0);
