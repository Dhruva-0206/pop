import "server-only";
import { randomBytes } from "node:crypto";
import { keccak256, toHex, type Address } from "viem";
import { APP_NAME, EIP712_VERSION } from "@pop/shared";
import { deployment, net } from "./chain";
import { attestorAccount } from "./reviews";

export const HANDLE_RE = /^[a-z0-9._]{1,30}$/;
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,40}$/;

/** The code the seller puts in their Instagram bio (tier 1 = a staff member checks it is there). */
export const bioCodeFor = (handle: string, wallet: string) => `POP-${keccak256(toHex(`${handle.toLowerCase()}:${wallet.toLowerCase()}`)).slice(2, 8).toUpperCase()}`;

/** Attestor-signed Registration (EIP-712, same typed data as scripts/seed-seller.ts) that the seller submits to SellerRegistry. */
export async function signRegistration(seller: Address, handleHash: `0x${string}`) {
  const d = deployment();
  const nonce = BigInt(`0x${randomBytes(8).toString("hex")}`);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 24 * 3600);
  const sig = await attestorAccount().signTypedData({
    domain: { name: APP_NAME, version: EIP712_VERSION, chainId: net.chain.id, verifyingContract: d.registry },
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
    message: { seller, handleHash, handleTier: 1, nonce, deadline },
  });
  return { nonce: nonce.toString(), deadline: Number(deadline), sig };
}
