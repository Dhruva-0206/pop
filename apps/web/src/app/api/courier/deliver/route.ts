import { NextResponse, connection } from "next/server";
import { BaseError, ContractFunctionRevertedError } from "viem";
import { z } from "zod";
import { checkoutAbi, codeBytes } from "@pop/shared";
import { courierSession } from "@/lib/server/courier";
import { deployment, pub, serverWallet, store } from "@/lib/server/chain";

const Body = z.object({ orderId: z.string().regex(/^\d+$/), code: z.string().min(3).max(200) });

/**
 * Courier submits the buyer's code at the door: confirmDelivery(orderId, code).
 * Anyone could submit it; we use the courier wallet for gas. The contract checks the code, not us.
 */
export async function POST(req: Request) {
  await connection();
  if (!(await courierSession())) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const d = deployment();
  const w = serverWallet("COURIER_PK");
  const args = [BigInt(parsed.data.orderId), codeBytes(parsed.data.code)] as const;
  try {
    await pub.simulateContract({ address: d.checkout, abi: checkoutAbi, functionName: "confirmDelivery", args, account: w.account });
  } catch (e) {
    const rev = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null;
    const name = rev instanceof ContractFunctionRevertedError ? rev.data?.errorName : undefined;
    const msg = name === "BadCode" ? "That code doesn't match this order." : name === "BadState" ? "Order isn't out for delivery." : "Rejected by the contract.";
    return NextResponse.json({ ok: false, error: msg, reason: name }, { status: 400 });
  }
  const tx = await w.writeContract({ address: d.checkout, abi: checkoutAbi, functionName: "confirmDelivery", args });
  const rc = await pub.waitForTransactionReceipt({ hash: tx });
  if (rc.status === "success") store.patchOrder(parsed.data.orderId, { courierStatus: "Delivered (code accepted)" });
  return NextResponse.json({ ok: rc.status === "success", tx });
}
