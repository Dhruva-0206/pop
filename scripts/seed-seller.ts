/**
 * Seeds the demo seller @meera.jewels on the current NETWORK_MODE:
 * 1) attestor signs a tier-1 (staff-checked bio code) Registration (EIP-712), seller submits registerSeller;
 * 2) seller signs an EIP-712 Offer for one listing; listing saved to the app store.
 * Idempotent: skips registration if already active. Usage: npx tsx scripts/seed-seller.ts
 */
import { getAddress, keccak256, toHex, zeroHash } from "viem";
import {
  APP_NAME,
  EIP712_VERSION,
  checkoutAbi,
  handleHash,
  listingIdHash,
  offerDomain,
  offerTypes,
  registryAbi,
  termsHash,
  type Terms,
} from "../packages/shared/src/index";
import { createFileStore } from "../packages/shared/src/server/store";
import { loadDeployment, mode, net, pub, walletOf } from "./chain";

const HANDLE = "meera.jewels";
const SLUG = "jhumka-01";
const dep = loadDeployment();
const store = createFileStore(mode);
const attestor = walletOf("ATTESTOR_PK");
const seller = walletOf("SELLER_PK");
const sellerAddr = seller.account.address;
const hHash = handleHash(HANDLE);

// ---- 1) registration (tier 1 = staff-checked bio code) ----
const bioCode = `POP-${keccak256(toHex(`${HANDLE}:${sellerAddr}`)).slice(2, 8).toUpperCase()}`;
const active = await pub.readContract({ address: dep.registry, abi: registryAbi, functionName: "isActive", args: [sellerAddr] });
if (!active) {
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
    message: { seller: sellerAddr, handleHash: hHash, handleTier: 1, nonce, deadline },
  });
  const tx = await seller.writeContract({
    address: dep.registry,
    abi: registryAbi,
    functionName: "registerSeller",
    args: [sellerAddr, hHash, 1, nonce, deadline, sig],
  });
  const rc = await pub.waitForTransactionReceipt({ hash: tx });
  console.log(`registerSeller ${rc.status} tx=${tx}`);
} else {
  console.log("seller already registered");
}
store.upsertSeller({ wallet: sellerAddr, handle: HANDLE, handleHash: hHash, handleTier: 1, bioCode, createdAt: new Date().toISOString() });

// ---- 2) one listing with a seller-signed Offer ----
const terms: Terms = {
  title: "Silver jhumkas (oxidised, handmade)",
  imageUrl: "/demo/jhumka.svg",
  priceInr: 899,
  shipWithinSec: 180, // demo: 3 min (production: 3 days)
  deliverWithinSec: 300, // demo: 5 min after shipping (production: 7 days)
  returnPolicy: "Report a problem within the window after delivery; arbiter decides refund/release/split.",
};
const price = 1_000_000n; // 1.00 test USDT at 6 decimals (read from chain: tokenDecimals)
if (dep.tokenDecimals !== 6) throw new Error(`Unexpected decimals ${dep.tokenDecimals}; adjust price`);
const offer = {
  seller: sellerAddr,
  listingId: listingIdHash(SLUG),
  termsHash: termsHash(terms),
  externalRef: zeroHash,
  price,
  shipWithin: terms.shipWithinSec,
  deliverWithin: terms.deliverWithinSec,
  maxUnits: 50,
  validUntil: BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 3600),
  version: 1n,
};
const offerSig = await seller.signTypedData({
  domain: offerDomain(net.chain.id, dep.checkout),
  types: offerTypes,
  primaryType: "Offer",
  message: offer,
});
// Sanity: the contract computes the same digest and recovers the seller.
const digest = await pub.readContract({ address: dep.checkout, abi: checkoutAbi, functionName: "offerDigest", args: [offer] });
console.log(`offer digest ${digest}`);

store.upsertListing({
  id: SLUG,
  sellerWallet: getAddress(sellerAddr),
  sellerHandle: HANDLE,
  title: terms.title,
  imageUrl: terms.imageUrl,
  priceUnits: price.toString(),
  priceInr: terms.priceInr,
  terms,
  termsHash: offer.termsHash,
  offer: {
    ...offer,
    price: offer.price.toString(),
    validUntil: offer.validUntil.toString(),
    version: offer.version.toString(),
  },
  offerSig,
  active: true,
  createdAt: new Date().toISOString(),
});
console.log({ mode, seller: sellerAddr, handle: HANDLE, tier: 1, bioCode, listing: `/p/${SLUG}` });
