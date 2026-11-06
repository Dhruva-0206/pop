import { NextResponse, connection } from "next/server";
import { getAddress, isAddress } from "viem";
import { z } from "zod";
import { handleHash, registryAbi } from "@pop/shared";
import { deployment, pub, serverWallet, store } from "@/lib/server/chain";
import { onboardRequestMessage } from "@/lib/messages";
import { signRegistration } from "@/lib/server/onboarding";
import { autoApproveOn } from "@/lib/server/vendor";

// One transaction plus its receipt on Whitechain Sepolia (about 5 s), with headroom.
export const maxDuration = 60;

const Body = z.object({
  wallet: z.string().refine((a) => isAddress(a)),
  /** The wallet's signature over onboardRequestMessage(handle, wallet), the same message used to open the request. */
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

/**
 * DEMO MODE ONLY (ONBOARD_DEMO_AUTOAPPROVE=yes and NETWORK_MODE=testnet): skips the staff check of the bio code.
 * It approves the vendor's pending request and registers the seller on-chain. Who does what:
 *  - SellerRegistry.registerSeller can be sent by anyone; the attestor's signature is the authority (contracts unchanged).
 *  - the attestor signs the registration here, and PoP's test faucet wallet (a server key) pays the network fee, so the vendor needs no test funds;
 *  - the seller is registered at handle tier 0 ("not checked"), never tier 1 ("checked by PoP staff"), because nobody checked.
 * The vendor must already have passed the World ID check (a pending request only exists after it) and must sign this call.
 */
export async function POST(req: Request) {
  await connection();
  if (!autoApproveOn()) return NextResponse.json({ error: "demo auto-approve is not switched on" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const wallet = getAddress(parsed.data.wallet);

  const row = await store.onboardingByWallet(wallet);
  if (!row) return NextResponse.json({ error: "no onboarding request for this wallet" }, { status: 404 });
  const ok = await pub.verifyMessage({ address: wallet, message: onboardRequestMessage(row.handle, wallet), signature: parsed.data.signature as `0x${string}` }).catch(() => false);
  if (!ok) return NextResponse.json({ error: "the request must be signed by the wallet" }, { status: 403 });

  const d = deployment();
  const active = await pub.readContract({ address: d.registry, abi: registryAbi, functionName: "isActive", args: [wallet] });
  if (active) return NextResponse.json({ ok: true, alreadyRegistered: true });

  const hh = handleHash(row.handle);
  const reg = await signRegistration(wallet, hh, 0);
  if (row.status === "pending" && !(await store.decideOnboarding(row.id, true, reg))) {
    // someone decided it a moment ago; carry on with the registration only if it ended up approved
    const again = await store.onboardingById(row.id);
    if (again?.status !== "approved") return NextResponse.json({ error: "this request was not approved" }, { status: 409 });
  }

  const relayer = serverWallet("FAUCET_PK");
  try {
    const tx = await relayer.writeContract({
      address: d.registry,
      abi: registryAbi,
      functionName: "registerSeller",
      args: [wallet, hh, 0, BigInt(reg.nonce), BigInt(reg.deadline), reg.sig],
      account: relayer.account,
      chain: relayer.chain,
    });
    const rc = await pub.waitForTransactionReceipt({ hash: tx });
    if (rc.status !== "success") return NextResponse.json({ error: "the registration transaction failed" }, { status: 502 });
    return NextResponse.json({ ok: true, tx });
  } catch (e) {
    console.error("[onboard/auto] registerSeller failed:", e instanceof Error ? e.message.split("\n")[0] : e);
    return NextResponse.json({ error: "the registration could not be sent, try again" }, { status: 502 });
  }
}
