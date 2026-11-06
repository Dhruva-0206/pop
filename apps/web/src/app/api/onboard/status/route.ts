import { NextResponse, connection } from "next/server";
import { getAddress, isAddress } from "viem";
import { handleHash } from "@pop/shared";
import { store } from "@/lib/server/chain";

/** Onboarding status for a wallet. When approved it includes the attestor-signed Registration the wallet submits on-chain (it only registers THAT wallet and handle). */
export async function GET(req: Request) {
  await connection();
  const w = new URL(req.url).searchParams.get("wallet") ?? "";
  if (!isAddress(w)) return NextResponse.json({ error: "bad wallet" }, { status: 400 });
  const row = await store.onboardingByWallet(getAddress(w));
  const listings = await store.listingsBySeller(getAddress(w));
  const seller = await store.sellerByWallet(getAddress(w));
  if (!row && !seller) return NextResponse.json({ status: "none" });
  return NextResponse.json({
    status: row?.status ?? "approved",
    handle: row?.handle ?? seller?.handle,
    bioCode: row?.bioCode ?? seller?.bioCode,
    registration:
      row?.status === "approved" && row.regSig
        ? { seller: getAddress(w), handleHash: handleHash(row.handle), handleTier: 1, nonce: row.regNonce, deadline: row.regDeadline, signature: row.regSig }
        : undefined,
    listing: listings[0] ? { id: listings[0].id, title: listings[0].title } : undefined,
  });
}
