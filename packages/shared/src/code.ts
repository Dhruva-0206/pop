import { encodePacked, keccak256, toBytes, toHex, type Address, type Hex } from "viem";

/** Normalise a 6-word delivery code: lowercase, single spaces. The words ARE the secret. */
export function normaliseCode(words: string): string {
  return words.trim().toLowerCase().split(/\s+/).join(" ");
}

/** Same as the contract: keccak256(abi.encodePacked(block.chainid, address(this), code)). */
export function deliveryCodeHash(chainId: number, checkout: Address, words: string): Hex {
  return keccak256(encodePacked(["uint256", "address", "bytes"], [BigInt(chainId), checkout, toHex(toBytes(normaliseCode(words)))]));
}

export const codeBytes = (words: string): Hex => toHex(toBytes(normaliseCode(words)));
