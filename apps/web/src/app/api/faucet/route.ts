import { NextResponse, connection } from "next/server";
import { createHash } from "node:crypto";
import { erc20Abi, getAddress, isAddress, parseEther, parseUnits } from "viem";
import { z } from "zod";
import { deployment, net, pub, serverWallet, store } from "@/lib/server/chain";

const Body = z.object({ address: z.string().refine((a) => isAddress(a)) });
const GAS = parseEther("0.05");
const USDT = "2";
const DAILY_CAP = 200;

/** TEST MODE faucet: once per test wallet, capped per IP and per day. Real transfers from the faucet wallet. */
export async function POST(req: Request) {
  await connection();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const to = getAddress(parsed.data.address);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);
  if (store.faucetGrantFor(to)) return NextResponse.json({ ok: true, already: true });
  const today = store.faucetGrantsToday();
  if (today.length >= DAILY_CAP) return NextResponse.json({ error: "daily faucet cap reached" }, { status: 429 });
  if (!net.isLocalFork && today.filter((g) => g.ipHash === ipHash).length >= 5) {
    return NextResponse.json({ error: "too many test wallets from this network today" }, { status: 429 });
  }
  const d = deployment();
  const w = serverWallet("FAUCET_PK");
  // Record first so concurrent requests can't double-grant, then send.
  store.recordFaucetGrant({ address: to, ipHash });
  const gasTx = await w.sendTransaction({ to, value: GAS });
  await pub.waitForTransactionReceipt({ hash: gasTx });
  const usdtTx = await w.writeContract({
    address: d.token,
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, parseUnits(USDT, d.tokenDecimals)],
  });
  await pub.waitForTransactionReceipt({ hash: usdtTx });
  return NextResponse.json({ ok: true, gasTx, usdtTx, usdt: USDT });
}
