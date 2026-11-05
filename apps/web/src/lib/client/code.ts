"use client";

import { wordlist } from "@scure/bip39/wordlists/english.js";

/** 6 random BIP-39 words = 66 bits, generated in the browser. The words themselves are the secret. */
export function newDeliveryCode(): string {
  const r = new Uint16Array(6);
  crypto.getRandomValues(r); // 65536 is a multiple of 2048, so % 2048 is uniform
  return Array.from(r, (n) => wordlist[n % 2048]).join(" ");
}
