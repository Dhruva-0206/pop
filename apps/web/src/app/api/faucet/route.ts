import { NextResponse, connection } from "next/server";
import { createHash } from "node:crypto";
import { erc20Abi, getAddress, isAddress, parseEther, parseUnits } from "viem";
import { z } from "zod";
import { deployment, net, pub, serverWallet, store } from "@/lib/server/chain";

const Body = z.object({ address: z.string().refine((a) => isAddress(a)) });
const GAS = parseEther("0.05");
const USDT = "2";
const DAILY_CAP = Number(process.env.FAUCET_DAILY_CAP ?? 200); // global, all callers
const PER_IP_CAP = 5;

/**
 * Client IP for rate limiting. The leftmost x-forwarded-for entry is client-supplied and spoofable, so it is NOT used.
 * Prefer headers set by the platform edge; otherwise take the RIGHTMOST x-forwarded-for entry (appended by our nearest proxy).
 * The per-IP limit is a speed bump; the global daily cap and the wallet-balance guard are the real protection.
 */
function clientIp(req: Request): string {
  const h = req.headers;
  const edge = h.get("x-vercel-forwarded-for") ?? h.get("x-real-ip");
  if (edge) return edge.split(",")[0].trim();
  const xff = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return xff?.[xff.length - 1] ?? "local";
}

/** TEST MODE faucet: once per test wallet, capped per IP and per day, refuses when the faucet wallet runs low. */
export async function POST(req: Request) {
  await connection();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const to = getAddress(parsed.data.address);
  const ipHash = createHash("sha256").update(clientIp(req)).digest("hex").slice(0, 16);
  if (store.faucetGrantFor(to)) return NextResponse.json({ ok: true, already: true });
  const today = store.faucetGrantsToday();
  if (today.length >= DAILY_CAP) return NextResponse.json({ error: "daily faucet cap reached" }, { status: 429 });
  if (!net.isLocalFork && today.filter((g) => g.ipHash === ipHash).length >= PER_IP_CAP) {
    return NextResponse.json({ error: "too many test wallets from this network today" }, { status: 429 });
  }
  const d = deployment();
  const w = serverWallet("FAUCET_PK");

  // Low-balance guard: keep a reserve so the faucet wallet can still pay its own gas and never drains to zero.
  const usdtAmount = parseUnits(USDT, d.tokenDecimals);
  const [gasBal, usdtBal] = await Promise.all([
    pub.getBalance({ address: w.account.address }),
    pub.readContract({ address: d.token, abi: erc20Abi, functionName: "balanceOf", args: [w.account.address] }),
  ]);
  if (gasBal < GAS + parseEther("0.05") || usdtBal < usdtAmount) {
    return NextResponse.json({ error: "test faucet is low on funds, ask the team" }, { status: 503 });
  }

  // Record first so concurrent requests can't double-grant; roll back if the transfers fail.
  store.recordFaucetGrant({ address: to, ipHash });
  try {
    const gasTx = await w.sendTransaction({ to, value: GAS });
    await pub.waitForTransactionReceipt({ hash: gasTx });
    const usdtTx = await w.writeContract({
      address: d.token,
      abi: erc20Abi,
      functionName: "transfer",
      args: [to, usdtAmount],
    });
    await pub.waitForTransactionReceipt({ hash: usdtTx });
    return NextResponse.json({ ok: true, gasTx, usdtTx, usdt: USDT });
  } catch {
    store.removeFaucetGrant(to);
    return NextResponse.json({ error: "faucet transfer failed, try again" }, { status: 502 });
  }
}
