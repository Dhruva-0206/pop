import { NextResponse, connection } from "next/server";
import { checkoutAbi, registryAbi, termsHash, type Terms } from "@pop/shared";
import { deployment, pub, store } from "@/lib/server/chain";

/** Listing + signed Offer + live seller standing from the contracts. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await ctx.params;
  const l = await store.listing(id);
  if (!l || !l.active) return NextResponse.json({ error: "not found" }, { status: 404 });
  const d = deployment();
  const seller = l.sellerWallet as `0x${string}`;
  const [active, completed, lostDisputes, s] = await Promise.all([
    pub.readContract({ address: d.registry, abi: registryAbi, functionName: "isActive", args: [seller] }),
    pub.readContract({ address: d.checkout, abi: checkoutAbi, functionName: "completed", args: [seller] }),
    pub.readContract({ address: d.checkout, abi: checkoutAbi, functionName: "lostDisputes", args: [seller] }),
    pub.readContract({ address: d.registry, abi: registryAbi, functionName: "sellers", args: [seller] }),
  ]);
  return NextResponse.json({
    listing: l,
    termsHashMatches: termsHash(l.terms as Terms) === l.termsHash,
    sellerStanding: {
      active,
      handleTier: Number(s[1]),
      completed: completed.toString(),
      lostDisputes: lostDisputes.toString(),
    },
  });
}
