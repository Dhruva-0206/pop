import { NextResponse, connection } from "next/server";
import { zeroAddress, type Address } from "viem";
import { checkoutAbi, chunkedLogs, handleHash, registryAbi, ORDER_STATES } from "@pop/shared";
import { readSellerReviews } from "@pop/shared/server/arkiv";
import { deployment, pub } from "@/lib/server/chain";
import { arkivAccessKey, attestorAddress } from "@/lib/server/reviews";

const HANDLE_RE = /^[a-z0-9._]{1,30}$/;
const MAX_ORDERS_FOR_BREAKDOWN = 200;

/**
 * Public seller record: contract truth (registry + checkout counters + order outcomes) combined with Arkiv reviews.
 * Arkiv rows are trusted only if `$creator` is the attestor AND readonly (enforced in readSellerReviews).
 * Unknown or banned handles return 404 with `registered: false`; the page renders them red.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ handle: string }> }) {
  await connection();
  const handle = decodeURIComponent((await ctx.params).handle).trim().toLowerCase().replace(/^@/, "");
  if (!HANDLE_RE.test(handle)) return NextResponse.json({ registered: false, handle, reason: "unknown" }, { status: 404 });

  const d = deployment();
  const hHash = handleHash(handle);
  const owner = (await pub.readContract({ address: d.registry, abi: registryAbi, functionName: "handleOwner", args: [hHash] })) as Address;
  if (owner === zeroAddress) return NextResponse.json({ registered: false, handle, reason: "unknown" }, { status: 404 });

  const [active, bannedWallet, bannedHandle, sellerRec, completed, lostDisputes] = await Promise.all([
    pub.readContract({ address: d.registry, abi: registryAbi, functionName: "isActive", args: [owner] }),
    pub.readContract({ address: d.registry, abi: registryAbi, functionName: "bannedWallet", args: [owner] }),
    pub.readContract({ address: d.registry, abi: registryAbi, functionName: "bannedHandle", args: [hHash] }),
    pub.readContract({ address: d.registry, abi: registryAbi, functionName: "sellers", args: [owner] }),
    pub.readContract({ address: d.checkout, abi: checkoutAbi, functionName: "completed", args: [owner] }),
    pub.readContract({ address: d.checkout, abi: checkoutAbi, functionName: "lostDisputes", args: [owner] }),
  ]);
  if (!active) {
    return NextResponse.json(
      { registered: false, handle, reason: bannedWallet || bannedHandle ? "banned" : "unknown" },
      { status: 404 },
    );
  }

  // Denominator: every protected order ever paid to this seller (OrderFunded events, indexed by seller).
  const latest = await pub.getBlockNumber({ cacheTime: 0 });
  const funded = await chunkedLogs(BigInt(d.deployBlock), latest, (fromBlock, toBlock) =>
    pub.getContractEvents({ address: d.checkout, abi: checkoutAbi, eventName: "OrderFunded", args: { seller: owner }, fromBlock, toBlock }),
  );
  const total = funded.length;
  let breakdown: { released: number; refunded: number; split: number; open: number } | null = null;
  if (total <= MAX_ORDERS_FOR_BREAKDOWN) {
    const states = await Promise.all(
      funded.map(async (e) => {
        const o = await pub.readContract({ address: d.checkout, abi: checkoutAbi, functionName: "getOrder", args: [e.args.orderId!] });
        return ORDER_STATES[o.state];
      }),
    );
    breakdown = {
      released: states.filter((s) => s === "Released").length,
      refunded: states.filter((s) => s === "Refunded").length,
      split: states.filter((s) => s === "Split").length,
      open: states.filter((s) => !["Released", "Refunded", "Split", "None"].includes(s)).length,
    };
  }

  // Reviews from Arkiv: attestor-created + readonly only. If Arkiv is unreachable the page still shows contract truth.
  let ignoredUnmatched = 0;
  let reviews: {
    verified: { count: number; average: number | null; items: unknown[] };
    dev: { count: number; items: unknown[] };
    ignoredNotReadonly: number;
    ignoredUnmatched?: number;
    error?: string;
  };
  try {
    const all = await readSellerReviews(arkivAccessKey(), attestorAddress(), owner);
    const ignoredNotReadonly = all.ignoredNotReadonly;
    // A review counts only if its payment tx is a real OrderFunded for this seller on THIS contract. Order ids restart
    // on every deployment, so entities from another deployment (or a fork) must not inflate this seller's record.
    const fundedTx = new Set(funded.map((e) => e.transactionHash.toLowerCase()));
    const rows = all.rows.filter((r) => fundedTx.has(r.payTx.toLowerCase()));
    ignoredUnmatched = all.rows.length - rows.length;
    const verified = rows.filter((r) => !r.dev);
    const dev = rows.filter((r) => r.dev);
    reviews = {
      verified: {
        count: verified.length,
        average: verified.length ? verified.reduce((s, r) => s + r.rating, 0) / verified.length : null,
        items: verified.slice(0, 20),
      },
      dev: { count: dev.length, items: dev.slice(0, 5) },
      ignoredNotReadonly,
      ignoredUnmatched,
    };
  } catch {
    reviews = { verified: { count: 0, average: null, items: [] }, dev: { count: 0, items: [] }, ignoredNotReadonly: 0, error: "Reviews are temporarily unavailable." };
  }

  return NextResponse.json({
    registered: true,
    handle,
    wallet: owner,
    handleTier: Number(sellerRec[1]),
    counters: {
      totalOrders: total,
      completed: completed.toString(),
      lostDisputes: lostDisputes.toString(),
      breakdown,
    },
    reviews,
    attestor: attestorAddress(),
  });
}
