import "server-only";
import { timingSafeEqual } from "node:crypto";
import { getSession } from "./auth";

export function passcodeOk(input: string): boolean {
  const want = process.env.COURIER_PASSCODE?.trim();
  if (!want) return false;
  const a = Buffer.from(input.trim());
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function courierSession() {
  return getSession<{ role: "courier" }>("pop_courier");
}
