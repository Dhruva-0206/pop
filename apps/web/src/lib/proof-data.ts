/**
 * Static evidence shown on /proof: facts recorded when they happened (testnet 1874 and Arkiv Rabdi). Everything LIVE
 * (contract state, orders, Arkiv entities, the World log) is read at request time in lib/server/proof.ts.
 * Keep in sync with docs/evidence.md.
 */
export const EXPLORER = "https://explorer.testnet.whitechain.io";

export type Tx = { label: string; hash: string; note?: string };
export const STATIC_TXS: { group: string; txs: Tx[] }[] = [
  {
    group: "Test USDT",
    txs: [{ label: "WBT swapped to the specified test USDT on YetiTrade", hash: "0x382599b2410c59a0c6515b83cd7d4dc131854317f2ace32b996978f18ed5d54d", note: "block 12327812" }],
  },
  {
    group: "Deployment (Whitechain Sepolia 1874, block 12330545)",
    txs: [
      { label: "SellerRegistry deploy", hash: "0xf0196821f93bcdeb21d27b2bb631a0ae200bd2f44eab2b14b0848bae22f5dfa8" },
      { label: "PoPCheckout deploy", hash: "0x179e2cfdd423a5356cd4c4dd2bf55115501f5bce37a6801aefff49e4c9e1d4ed" },
      { label: "registerSeller @meera.jewels", hash: "0x12ae0d7b36bca517774049c2cf325c09a75b20752e01e28fa882d3bee167e7fd" },
      { label: "registerSeller @kurta.co", hash: "0xc1094b7eee5bc018754b261fe4cbbc9a010dee23b7bc537e6e7d971e8463c399" },
    ],
  },
  {
    group: "Order #1: paid, shipped, delivered with the buyer's code, released",
    txs: [
      { label: "approve", hash: "0xe141283596ae47e153b40181a07e1c6ef24e08591647d88ee49cf71e83564aaa" },
      { label: "pay", hash: "0xa59f9067bf1d58c716809efe520a0666e4aacbca2dfea4a52b0ad8a79caa5da3" },
      { label: "markShipped", hash: "0xfec133f3fcbe5a39ab27af5d4d7883ab034833013abdc2201df68ee973baff65" },
      { label: "confirmDelivery (courier, buyer's 6 words)", hash: "0x2df7522a98d718c38bf7771f48447eb13d2e6fe3e5ba8fb076afbf8968a8c3de" },
      { label: "finalize after the dispute window", hash: "0x38708e796235108faede33d124e92e9777478041de13bec3a1322393e8c51290" },
      { label: "seller withdraw (0.99 USDT)", hash: "0xee21a18433c0a018c24d749faddc6f19f7c58322b55a3c987fe52bddc9b5306a" },
    ],
  },
  {
    group: "Order #2: never shipped, refunded (reason 1)",
    txs: [
      { label: "pay", hash: "0x924b43d9454d01c9a9c3ab7116e1f5499f2a8f8f9bc743b0c3ce303fa4b0bb50" },
      { label: "finalize by a third party after ship-by", hash: "0xa9d9489ed3094a5497b3ff6982abf3ec7b5ddad3559423a6d3ad696aa28f0278" },
      { label: "buyer withdraw (1.00 USDT)", hash: "0xea25db67fa057553cd95c6915ac60fa04fab48e78b56d1be4fc28dacb403008e" },
    ],
  },
  {
    group: "Kurta Co. through Pay with PoP: order #3 released, order #4 refunded",
    txs: [
      { label: "#3 pay", hash: "0x7bdbd73f594d9bbf0a54f1bf9312e0473fa3622a87deb27c6c0f317e7ef40120" },
      { label: "#3 markShipped", hash: "0x2498e50030094ac4a14fbf073eb49c364459067a7198bb98763740e5234d2316" },
      { label: "#3 confirmDelivery", hash: "0x0862f7183450a4ecfa6c790269b2efa022e9bbef8e509cc7152e38c82edabc20" },
      { label: "#3 finalize → released", hash: "0xe924962b6eb53b871b60867d9f81f2c056cdc04606eb27744688db12ac3163d0" },
      { label: "#4 pay", hash: "0x840d363c7da00e546c7524c26067c906622def0047490bcea41176191f02917e" },
      { label: "#4 finalize → refunded", hash: "0xdfc9bb74441678acd4a5e73c8edb8b5f09c136eb8fa72c8ba7196acd9b84157b" },
    ],
  },
];

/** Smoke C: the first review entity, created by the attestor on Arkiv Rabdi (chain 7794095) and handed to the buyer. */
export const ARKIV_SMOKE = {
  chainId: 7794095,
  entityKey: "0x731d721cf6b3b621983f30bc21ee2a1ee1f6e40917e3113203a5e9b6cee6f620",
  createTx: { hash: "0xcb2da0660b9328b2705ba0fae2736fdd787899e446f4c825eeb6223fb31d0e63", block: 265818 },
  transferTx: { hash: "0x0d7ec9768699fe503c72fa762b3f80b1b89bb7b6fa979b9e6f81e72b4ad6ce5e", block: 265821 },
};

/** Test counts as of the last full run. Re-run the commands to reproduce. */
export const TEST_COUNTS = {
  asOf: "Fri 6 Nov 2026",
  forge: "58 passed, 0 failed: 6 registry + 5 arbiter-timeout + 18 force-refund/self-purchase + 28 checkout, plus 1 invariant suite with 6 invariants (64 runs, 2048 calls)",
  forgeCmd: "cd contracts && forge test -vv   (Git Bash)",
  e2eFork: "scripts/e2e-fork.ts on a local fork",
  e2eMerchant: "scripts/e2e-merchant.ts: fork and testnet",
  e2eCmd: "npx tsx scripts/e2e-fork.ts   ·   npx tsx scripts/e2e-merchant.ts",
};
