/**
 * Read-only Arkiv query: lists every `pop_review_v1` entity created by our attestor, with creator, owner, readonly flag and expiry.
 * This is the same query /proof shows. It writes nothing.
 * Usage: npx tsx scripts/arkiv-query.ts [KEY_VAR]   (default ARKIV_ACCESS_KEY; for the Kurta store's own key pass KURTA_ARKIV_ACCESS_KEY,
 * which is read from apps/demo-store/.env.local)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { arkivReader, ReviewSchema } from "../packages/shared/src/server/arkiv";
import { addrOf, need } from "./env";

const keyVar = process.argv[2] ?? "ARKIV_ACCESS_KEY";
const key = keyVar === "KURTA_ARKIV_ACCESS_KEY" ? parse(readFileSync(resolve(import.meta.dirname, "..", "apps", "demo-store", ".env.local"), "utf8")).KURTA_ARKIV_ACCESS_KEY : need(keyVar);
if (!key) throw new Error(`${keyVar} is empty`);
const attestor = addrOf("ATTESTOR_PK");
const reader = arkivReader(key);
const block = await reader.getBlockNumber();
const page = await reader
  .select({ $key: true, $owner: true, $creator: true, $creationFlags: true, $expiresAt: true, seller: true, order_id: true, rating: true, created_at: true, reviewer_key: true, pay_tx: true })
  .from(ReviewSchema)
  .createdBy(attestor)
  .limit(100)
  .fetch();
console.log(`key variable: ${keyVar} (value not printed) | Arkiv Rabdi block ${block} | attestor ${attestor}`);
console.log(`entities created by the attestor: ${page.entities.length} (skipped by the SDK: ${page.skipped})`);
for (const e of page.entities) {
  const exp = e.$expiresAt as unknown;
  console.log(
    JSON.stringify({
      key: e.$key,
      creator: e.$creator,
      owner: e.$owner,
      readonly: Boolean(e.$creationFlags?.readonly),
      expiresAtBlock: exp === undefined ? null : String(exp),
      seller: String(e.seller.value),
      order_id: String(e.order_id.value),
      rating: Number(e.rating.value),
      kind: String(e.reviewer_key.value).startsWith("dev-") ? "DEV (no World proof)" : "regular",
      pay_tx: String(e.pay_tx.value),
    }),
  );
}
process.exit(0);
