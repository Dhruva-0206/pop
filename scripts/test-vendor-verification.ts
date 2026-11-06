/**
 * Unit test for the vendor "one human, one shop" decision (apps/web/src/lib/vendor-rules.ts): verified, replay, banned,
 * plus the signal binding and the real UNIQUE constraint on the database table (fork schema only).
 * Usage: NETWORK_MODE=fork npx tsx scripts/test-vendor-verification.ts   (the in-memory cases need no database; the table case runs on fork only)
 */
import "./env"; // loads pop/.env (DATABASE_URL) for the database case
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { decideVendor, vendorSignal, VENDOR_MSG, type VendorStoreLike } from "../apps/web/src/lib/vendor-rules";

class Mem implements VendorStoreLike {
  rows = new Map<string, { handle: string; banned: boolean }>();
  async claimVendor(h: string, handle: string) {
    if (this.rows.has(h)) return false;
    this.rows.set(h, { handle: handle.toLowerCase(), banned: false });
    return true;
  }
  async vendorByNullifier(h: string) {
    return this.rows.get(h);
  }
  async markVendorBanned(handle: string) {
    let n = 0;
    for (const r of this.rows.values()) if (r.handle === handle && !r.banned) { r.banned = true; n++; }
    return n;
  }
}
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const registered = new Set<string>();
const chainBanned = new Set<string>();
const run = (store: VendorStoreLike, nullifier: string, handle: string) =>
  decideVendor({ store, nullifierHash: sha(nullifier), handle, handleRegistered: async (h) => registered.has(h), bannedOnChain: async (h) => chainBanned.has(h) });

let n = 0;
const ok = (name: string) => console.log(`PASS ${++n}. ${name}`);

const s = new Mem();
// 1) verified: a new person with a new handle
assert.deepEqual(await run(s, "alice-nullifier", "Alice.Shop"), { kind: "verified", resumed: false });
assert.equal(s.rows.get(sha("alice-nullifier"))?.handle, "alice.shop");
ok("verified: first proof claims the nullifier for the handle (stored lower case)");

// 1b) resume: same person, same handle, shop not registered yet (reload during onboarding)
assert.deepEqual(await run(s, "alice-nullifier", "alice.shop"), { kind: "verified", resumed: true });
ok("verified (resume): same person and same handle before the shop is registered is not a second shop");

// 2) replay: same person, another handle
assert.deepEqual(await run(s, "alice-nullifier", "alice.second"), { kind: "replay" });
ok(`replay: same person, a different handle -> "${VENDOR_MSG.replay}"`);
// 2b) replay: same person, same handle, but the shop already exists
registered.add("alice.shop");
assert.deepEqual(await run(s, "alice-nullifier", "alice.shop"), { kind: "replay" });
ok("replay: same person and handle once the shop is registered");

// 3) banned: the ban is on-chain; we mirror it and refuse any new handle
chainBanned.add("alice.shop");
assert.deepEqual(await run(s, "alice-nullifier", "alice.third"), { kind: "banned" });
assert.equal(s.rows.get(sha("alice-nullifier"))?.banned, true);
ok(`banned: the on-chain ban is mirrored into the row and a new handle is refused -> "${VENDOR_MSG.banned}"`);
assert.deepEqual(await run(s, "alice-nullifier", "alice.shop"), { kind: "banned" });
ok("banned stays banned for the old handle too");
chainBanned.clear();
assert.deepEqual(await run(s, "alice-nullifier", "alice.fourth"), { kind: "banned" });
ok("the database flag is sticky: still banned when the chain is not asked");

// 4) a different person is unaffected
assert.deepEqual(await run(s, "bob-nullifier", "bob.shop"), { kind: "verified", resumed: false });
ok("a different person is not affected by another person's ban");

// 5) race: two simultaneous first attempts, only one row
const r = new Mem();
await Promise.all([run(r, "carol", "carol.a"), run(r, "carol", "carol.a")]);
assert.equal(r.rows.size, 1);
ok("simultaneous first attempts create one row");

// 6) signal binding
assert.equal(vendorSignal("Shop.One"), vendorSignal("shop.one"));
assert.notEqual(vendorSignal("shop.one"), vendorSignal("shop.two"));
ok("signal is bound to the handle (a proof for one handle does not match another)");

// 7) the real table (fork schema only, never touches testnet data)
if ((process.env.NETWORK_MODE ?? "fork") === "fork") {
  const { createStore } = await import("../packages/shared/src/server/store");
  const store = createStore("fork");
  const h = sha(`unit-test-${Date.now()}`);
  assert.equal(await store.claimVendor(h, "unit.test"), true);
  assert.equal(await store.claimVendor(h, "unit.other"), false, "a second claim of the same nullifier must fail");
  const row = await store.vendorByNullifier(h);
  assert.equal(row?.handle, "unit.test");
  assert.equal(row?.nullifierHint, h.slice(0, 12));
  assert.equal(row?.banned, false);
  assert.equal(await store.markVendorBanned("unit.test"), 1);
  await store.releaseVendor(h); // banned rows are kept on purpose
  assert.equal((await store.vendorByNullifier(h))?.banned, true);
  ok("database: UNIQUE nullifier_hash, hint is the first 12 hex, the ban flag sticks and banned rows are never released");
} else {
  console.log("SKIP database case (NETWORK_MODE is not fork)");
}
console.log(`\n${n} checks passed`);
process.exit(0);
