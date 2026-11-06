import { connection } from "next/server";
import { zeroAddress, type Address } from "viem";
import { checkoutAbi, chunkedLogs, handleHash, registryAbi } from "@pop/shared";
import { deployment, pub } from "@/lib/server/chain";

const HANDLE_RE = /^[a-z0-9._]{1,30}$/;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function svg(bg: string, line1: string, line2: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="62" role="img" aria-label="${esc(line1)}: ${esc(line2)}">
<rect width="280" height="62" rx="10" fill="${bg}"/>
<text x="14" y="25" fill="#ffffff" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="700">${esc(line1)}</text>
<text x="14" y="46" fill="#e8f5ee" font-family="Arial,Helvetica,sans-serif" font-size="12">${esc(line2)}</text>
</svg>`;
}
const reply = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=60", "x-content-type-options": "nosniff" } });

/**
 * Embeddable "Protected by PoP" badge for a seller: live counters straight from the contracts (completed / total protected orders).
 * Unknown or banned handles get a red badge. Text only comes from our own data (handle is regex-checked and escaped).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ handle: string }> }) {
  await connection();
  const handle = decodeURIComponent((await ctx.params).handle).trim().toLowerCase().replace(/\.svg$/, "").replace(/^@/, "");
  if (!HANDLE_RE.test(handle)) return reply(svg("#9b1c1c", "Not a registered seller", "PoP"), 404);
  try {
    const d = deployment();
    const owner = (await pub.readContract({ address: d.registry, abi: registryAbi, functionName: "handleOwner", args: [handleHash(handle)] })) as Address;
    const active = owner !== zeroAddress && (await pub.readContract({ address: d.registry, abi: registryAbi, functionName: "isActive", args: [owner] }));
    if (!active) return reply(svg("#9b1c1c", "Not a registered seller", `@${handle} is unknown or banned on PoP`), 404);
    const completed = await pub.readContract({ address: d.checkout, abi: checkoutAbi, functionName: "completed", args: [owner] });
    const tip = await pub.getBlockNumber({ cacheTime: 0 });
    const funded = await chunkedLogs(BigInt(d.deployBlock), tip, (fromBlock, toBlock) =>
      pub.getContractEvents({ address: d.checkout, abi: checkoutAbi, eventName: "OrderFunded", args: { seller: owner }, fromBlock, toBlock }),
    );
    return reply(svg("#0b6b3a", "Protected by PoP", `@${handle} · ${completed.toString()} of ${funded.length} protected orders completed`));
  } catch {
    return reply(svg("#52525b", "PoP", "badge temporarily unavailable"), 503);
  }
}
