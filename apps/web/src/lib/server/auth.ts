import "server-only";
import { cookies } from "next/headers";
import { signSession, verifySession } from "@pop/shared/server/crypto";
import { sessionSecret } from "./chain";

const TTL = 8 * 3600 * 1000;

export async function setSession(name: "pop_seller" | "pop_courier", payload: object) {
  const jar = await cookies();
  jar.set(name, signSession({ ...payload, exp: Date.now() + TTL }, sessionSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL / 1000,
  });
}

export async function getSession<T>(name: "pop_seller" | "pop_courier"): Promise<T | null> {
  const jar = await cookies();
  return verifySession<T>(jar.get(name)?.value, sessionSecret());
}
