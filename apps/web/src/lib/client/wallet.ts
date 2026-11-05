"use client";

import { createWalletClient, http, type Hex, type WalletClient } from "viem";
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { chainOf, type AppConfig } from "./config";

/**
 * TEST MODE wallet: a throwaway key kept in this browser's localStorage, per network mode and role.
 * Testnet only. Never used for real funds.
 */
export type Role = "buyer" | "seller";
const keyName = (c: AppConfig, role: Role) => `pop:testwallet:${c.mode}:${c.chainId}:${role}`;

export function getTestAccount(c: AppConfig, role: Role, create = true): PrivateKeyAccount | null {
  let pk = localStorage.getItem(keyName(c, role)) as Hex | null;
  if (!pk && create) {
    pk = generatePrivateKey();
    localStorage.setItem(keyName(c, role), pk);
  }
  return pk ? privateKeyToAccount(pk) : null;
}

/** Operator-only (dashboard): import a test key into this browser. */
export function importTestKey(c: AppConfig, role: Role, pk: string) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk.trim())) throw new Error("Not a private key");
  localStorage.setItem(keyName(c, role), pk.trim());
}

export function forgetTestKey(c: AppConfig, role: Role) {
  localStorage.removeItem(keyName(c, role));
}

export function walletOf(c: AppConfig, account: PrivateKeyAccount): WalletClient {
  return createWalletClient({ chain: chainOf(c), transport: http(c.rpcUrl), account });
}

/** Delivery codes are kept only in this browser (and on the buyer's screenshot). */
const codeKey = (c: AppConfig, orderId: string) => `pop:order:${c.mode}:${c.chainId}:${orderId}:code`;
export const saveCode = (c: AppConfig, orderId: string, words: string) => localStorage.setItem(codeKey(c, orderId), words);
export const loadCode = (c: AppConfig, orderId: string) => localStorage.getItem(codeKey(c, orderId));
