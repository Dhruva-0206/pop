/**
 * Seeds the demo merchant "Kurta Co." (handle kurta.co) on the current NETWORK_MODE:
 *  1) merchant API key + webhook secret: generated ONCE if POP_API_KEY / POP_WEBHOOK_SECRET are empty in pop/.env (written there and
 *     to apps/demo-store/.env.local; values are never printed);
 *  2) the merchant wallet (MERCHANT_PK) is registered as seller @kurta.co (attestor-signed, tier 1) and added to the app database;
 *  3) the merchant row (API key sha256, encrypted webhook secret, webhook URL, allowed return origin) is upserted.
 * Idempotent. The merchant wallet needs a little gas (fork-fund does it on the fork; on testnet send ~0.02 WBT first).
 * Usage: npx tsx scripts/seed-merchant.ts
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAddress, keccak256, toHex } from "viem";
import { APP_NAME, EIP712_VERSION, handleHash, registryAbi } from "../packages/shared/src/index";
import { encryptPII } from "../packages/shared/src/server/crypto";
import { createStore } from "../packages/shared/src/server/store";
import { loadDeployment, mode, net, pub, walletOf } from "./chain";
import { need, opt } from "./env";

const HANDLE = "kurta.co";
const ROOT_ENV = resolve(import.meta.dirname, "..", ".env");
const STORE_ENV = resolve(import.meta.dirname, "..", "apps", "demo-store", ".env.local");

/** Sets NAME=value in a dotenv file (replace the line or append). Never prints the value. */
function setVar(file: string, name: string, value: string) {
  const txt = existsSync(file) ? readFileSync(file, "utf8") : "";
  const nl = txt.includes("\r\n") ? "\r\n" : "\n";
  const re = new RegExp(`^${name}=.*$`, "m");
  const next = re.test(txt) ? txt.replace(re, `${name}=${value}`) : `${txt}${txt && !txt.endsWith("\n") ? nl : ""}${name}=${value}${nl}`;
  writeFileSync(file, next);
}

// ---- 1) credentials
let apiKey = opt("POP_API_KEY");
let secret = opt("POP_WEBHOOK_SECRET");
if (!apiKey) {
  apiKey = `pop_test_${randomBytes(24).toString("hex")}`;
  setVar(ROOT_ENV, "POP_API_KEY", apiKey);
  console.log("generated POP_API_KEY (written to .env, not printed)");
}
if (!secret) {
  secret = `whsec_${randomBytes(32).toString("hex")}`;
  setVar(ROOT_ENV, "POP_WEBHOOK_SECRET", secret);
  console.log("generated POP_WEBHOOK_SECRET (written to .env, not printed)");
}
const baseUrl = opt("POP_BASE_URL") ?? "http://localhost:3000";
const storeOrigin = opt("KURTA_ORIGIN") ?? "http://localhost:3001";
setVar(STORE_ENV, "POP_BASE_URL", baseUrl);
setVar(STORE_ENV, "POP_API_KEY", apiKey);
setVar(STORE_ENV, "POP_WEBHOOK_SECRET", secret);
setVar(STORE_ENV, "MERCHANT_PK", need("MERCHANT_PK"));
setVar(STORE_ENV, "DATABASE_URL", need("DATABASE_URL")); // the store may use the same Supabase project (its own schema kurta_<chainId>)
setVar(STORE_ENV, "POP_ATTESTOR_ADDRESS", opt("POP_ATTESTOR_ADDRESS") ?? "");
console.log(`demo store env written: apps/demo-store/.env.local (names: POP_BASE_URL, POP_API_KEY, POP_WEBHOOK_SECRET, MERCHANT_PK, DATABASE_URL, POP_ATTESTOR_ADDRESS). Add KURTA_ARKIV_ACCESS_KEY there (its own Arkiv key).`);

// ---- 2) register the merchant wallet as seller @kurta.co
const dep = loadDeployment();
const attestor = walletOf("ATTESTOR_PK");
const merchantWallet = walletOf("MERCHANT_PK");
const wallet = merchantWallet.account.address;
const hHash = handleHash(HANDLE);
const active = await pub.readContract({ address: dep.registry, abi: registryAbi, functionName: "isActive", args: [wallet] });
if (!active) {
  const gas = await pub.getBalance({ address: wallet });
  if (gas < 5_000_000_000_000_000n) throw new Error(`merchant wallet ${wallet} has too little gas (${gas} wei); send ~0.02 WBT first`);
  const nonce = BigInt(Date.now());
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const sig = await attestor.signTypedData({
    domain: { name: APP_NAME, version: EIP712_VERSION, chainId: net.chain.id, verifyingContract: dep.registry },
    types: {
      Registration: [
        { name: "seller", type: "address" },
        { name: "handleHash", type: "bytes32" },
        { name: "handleTier", type: "uint8" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint64" },
      ],
    },
    primaryType: "Registration",
    message: { seller: wallet, handleHash: hHash, handleTier: 1, nonce, deadline },
  });
  const tx = await merchantWallet.writeContract({ address: dep.registry, abi: registryAbi, functionName: "registerSeller", args: [wallet, hHash, 1, nonce, deadline, sig] });
  const rc = await pub.waitForTransactionReceipt({ hash: tx });
  console.log(`registerSeller @${HANDLE} ${rc.status} tx=${tx}`);
} else {
  console.log(`@${HANDLE} already registered`);
}

// ---- 3) database rows
const store = createStore(mode);
const bioCode = `POP-${keccak256(toHex(`${HANDLE}:${wallet}`)).slice(2, 8).toUpperCase()}`;
await store.upsertSeller({ wallet, handle: HANDLE, handleHash: hHash, handleTier: 1, bioCode, createdAt: new Date().toISOString() });
const id = await store.upsertMerchant({
  name: "Kurta Co.",
  sellerWallet: getAddress(wallet),
  apiKeyHash: createHash("sha256").update(apiKey).digest("hex"),
  webhookUrl: opt("KURTA_WEBHOOK_URL") ?? `${storeOrigin}/api/pop/webhook`,
  webhookSecretEnc: encryptPII(secret, need("ADDRESS_ENC_KEY")),
  allowedReturnOrigin: storeOrigin,
});
console.log({ mode, merchantId: id, seller: wallet, handle: HANDLE, webhook: opt("KURTA_WEBHOOK_URL") ?? `${storeOrigin}/api/pop/webhook`, returnOrigin: storeOrigin });
