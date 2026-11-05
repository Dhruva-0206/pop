/**
 * Smoke C: Arkiv Rabdi (7794095). Attestor creates ONE readonly `pop_review_v1` test entity,
 * queries it by creator, transfers ownership to the test buyer, and reads back $creator vs $owner.
 *
 * Write-safety (Arkiv skills): check chain id, query first (no duplicate create), explicit gas,
 * single writer, never blind-retry a write, read back after each write.
 *
 * Needs in pop/.env: ARKIV_ACCESS_KEY, ATTESTOR_PK (funded with tGLM), TEST_BUYER_PK.
 * Usage: npx tsx scripts/smoke-arkiv.ts
 */
import { createPublicClient, createWalletClient, ExpirationTime } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { addr, bytes, defineSchema, str, u256, u64 } from "@arkiv-network/sdk/schema";
import { eq } from "@arkiv-network/sdk/query";
import { formatEther, http, keccak256, encodePacked, toHex } from "viem";
import { getGasPrice } from "viem/actions";
import { ARKIV_SCHEMAS } from "../packages/shared/src/index";
import { accountOf, addrOf, need } from "./env";

// Architecture §6.2 review schema.
const Review = defineSchema(ARKIV_SCHEMAS.review, {
  seller: addr().indexed(),
  order_id: u256().indexed(),
  rating: u64().indexed(),
  created_at: u64().indexed(),
  reviewer_key: str().indexed(), // hex keccak(nullifier, seller), never the raw nullifier
  buyer_history: u64().indexed(),
  pay_tx: str(),
  text: bytes(),
  buyer_sig: bytes(),
});

const SMOKE_ORDER_ID = 999_000_001n; // clearly fake id for the smoke entity

const accessKey = need("ARKIV_ACCESS_KEY");
const attestor = accountOf("ATTESTOR_PK");
const newOwner = addrOf("TEST_BUYER_PK");
const chain = rabdi({ accessKey });
const transport = http(undefined, { retryCount: 0, timeout: 15_000 });
const reader = createPublicClient({ chain, transport, cacheTime: 0 });
const wallet = createWalletClient({ chain, transport, account: attestor, cacheTime: 0 });

const chainId = await reader.getChainId();
if (chainId !== 7794095) throw new Error(`Expected Rabdi 7794095, got ${chainId}`);
const bal = await reader.getBalance({ address: attestor.address });
console.log(`Rabdi ok. attestor=${attestor.address} balance=${formatEther(bal)} tGLM`);
if (bal === 0n) throw new Error("Attestor has no tGLM. Fund it at https://hub.arkiv.network/faucet");

const findMine = () =>
  reader
    .select({ $key: true, $owner: true, $creator: true, $creationFlags: true, rating: true, reviewer_key: true })
    .from(Review)
    .createdBy(attestor.address)
    .where(eq("order_id", u256(SMOKE_ORDER_ID)))
    .limit(5)
    .fetch();

// 1) Query first, so a re-run never creates a duplicate.
let page = await findMine();
let entityKey = page.entities[0]?.$key as `0x${string}` | undefined;

if (!entityKey) {
  const seller = attestor.address; // stand-in seller for the smoke entity
  const reviewerKey = keccak256(encodePacked(["bytes32", "address"], [keccak256(toHex("smoke-nullifier")), seller]));
  const gasPrice = await getGasPrice(reader);
  const res = await wallet.createEntity(
    Review,
    {
      seller: addr(seller),
      order_id: u256(SMOKE_ORDER_ID),
      rating: u64(5n),
      created_at: u64(BigInt(Math.floor(Date.now() / 1000))),
      reviewer_key: reviewerKey,
      buyer_history: u64(1n),
      pay_tx: "0x-smoke-test-no-payment",
      text: new TextEncoder().encode("PoP smoke test review (not a real order)"),
      buyer_sig: new Uint8Array(),
    },
    { expiration: ExpirationTime.fromHours(24), flags: { readonly: true, permissionlessExtension: false } },
    { gas: 1_000_000n, gasPrice },
  );
  entityKey = res.entityKey;
  console.log(`created entityKey=${res.entityKey} tx=${res.txHash} expiresAtBlock=${res.expiresAt}`);
  page = await findMine();
} else {
  console.log(`found existing smoke entity ${entityKey} (not creating again)`);
}

console.log("query createdBy(attestor) where order_id =", SMOKE_ORDER_ID.toString(), "->", page.entities.length, "row(s)");
const row = page.entities[0]!;
console.log({ key: row.$key, creator: row.$creator, owner: row.$owner, readonly: row.$creationFlags?.readonly });

// 2) Transfer ownership to the test buyer (only if the attestor still owns it).
if (row.$owner?.toLowerCase() === attestor.address.toLowerCase()) {
  const gasPrice = await getGasPrice(reader);
  const t = await wallet.changeOwnership({ entityKey: entityKey!, newOwner }, { gas: 1_000_000n, gasPrice });
  console.log("changeOwnership tx:", (t as { txHash?: string }).txHash ?? t);
}

// 3) Read back: $creator stays the attestor, $owner is now the buyer.
const after = await reader.getEntity(entityKey!, Review);
console.log("after transfer:", { key: entityKey, creator: after.$creator, owner: after.$owner, expectedOwner: newOwner });
if (after.$owner?.toLowerCase() !== newOwner.toLowerCase()) throw new Error("owner did not change");
if (after.$creator?.toLowerCase() !== attestor.address.toLowerCase()) throw new Error("creator changed?!");
console.log("SMOKE C PASS");
