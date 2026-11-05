import { NextResponse, connection } from "next/server";
import { BaseError, ContractFunctionRevertedError } from "viem";
import { z } from "zod";
import { checkoutAbi } from "@pop/shared";
import { courierSession } from "@/lib/server/courier";
import { deployment, pub, serverWallet, store } from "@/lib/server/chain";

const Body = z.object({ orderId: z.string().regex(/^\d+$/) });

/** "Handover refused": the courier role's ONLY power. Shipped -> Disputed, before deliver-by. No money moves. */
export async function POST(req: Request) {
  await connection();
  if (!(await courierSession())) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const d = deployment();
  const w = serverWallet("COURIER_PK");
  const args = [BigInt(parsed.data.orderId)] as const;
  try {
    await pub.simulateContract({ address: d.checkout, abi: checkoutAbi, functionName: "reportHandoverRefused", args, account: w.account });
  } catch (e) {
    const rev = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null;
    const name = rev instanceof ContractFunctionRevertedError ? rev.data?.errorName : undefined;
    return NextResponse.json({ ok: false, error: `Rejected by the contract (${name ?? "unknown"})` }, { status: 400 });
  }
  const tx = await w.writeContract({ address: d.checkout, abi: checkoutAbi, functionName: "reportHandoverRefused", args });
  const rc = await pub.waitForTransactionReceipt({ hash: tx });
  if (rc.status === "success") store.patchOrder(parsed.data.orderId, { courierStatus: "Handover refused (sent to arbiter)" });
  return NextResponse.json({ ok: rc.status === "success", tx });
}
