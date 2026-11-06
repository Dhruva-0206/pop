import "server-only";
import { createHash, createHmac } from "node:crypto";
import type { MerchantRow } from "@pop/shared/server/store";
import { store } from "./chain";

export const hashApiKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** Merchant behind `Authorization: Bearer <api key>`, or undefined. The key itself is never stored, only its sha256. */
export async function authMerchant(req: Request): Promise<MerchantRow | undefined> {
  const m = /^Bearer\s+(\S{16,200})$/.exec(req.headers.get("authorization") ?? "");
  if (!m) return undefined;
  return store.merchantByKeyHash(hashApiKey(m[1]));
}

/** `PoP-Signature` value: t=<unix>,v1=<hex hmac-sha256 over "t.body">. Mirrored by PoP.verifyWebhook in @pop/checkout-sdk. */
export function signWebhook(secret: string, t: number, body: string): string {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}
