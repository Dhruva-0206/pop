import { NextResponse, connection } from "next/server";
import { getAddress, isAddress, zeroAddress } from "viem";
import { z } from "zod";
import { handleHash, registryAbi } from "@pop/shared";
import { deployment, pub, store } from "@/lib/server/chain";
import { onboardRequestMessage } from "@/lib/messages";
import { HANDLE_RE, bioCodeFor } from "@/lib/server/onboarding";

const MAX_PENDING = 200;
const Body = z.object({
  handle: z.string().trim().toLowerCase().transform((s) => s.replace(/^@/, "")),
  wallet: z.string().refine((a) => isAddress(a)),
  /** The wallet's signature over onboardRequestMessage(handle, wallet): the requester controls the wallet. */
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

/** Step 1 of /onboard: the seller asks for a bio code. Nothing is registered until staff confirm the code and the seller submits the registration. */
export async function POST(req: Request) {
  await connection();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !HANDLE_RE.test(parsed.data.handle)) return NextResponse.json({ error: "bad request: handle must be 1-30 of a-z 0-9 . _" }, { status: 400 });
  const { handle, signature } = parsed.data;
  const wallet = getAddress(parsed.data.wallet);

  const ok = await pub.verifyMessage({ address: wallet, message: onboardRequestMessage(handle, wallet), signature: signature as `0x${string}` }).catch(() => false);
  if (!ok) return NextResponse.json({ error: "the request must be signed by the wallet" }, { status: 403 });

  const d = deployment();
  const hHash = handleHash(handle);
  const [owner, active, bannedH, bannedW] = await Promise.all([
    pub.readContract({ address: d.registry, abi: registryAbi, functionName: "handleOwner", args: [hHash] }),
    pub.readContract({ address: d.registry, abi: registryAbi, functionName: "isActive", args: [wallet] }),
    pub.readContract({ address: d.registry, abi: registryAbi, functionName: "bannedHandle", args: [hHash] }),
    pub.readContract({ address: d.registry, abi: registryAbi, functionName: "bannedWallet", args: [wallet] }),
  ]);
  if (bannedH || bannedW) return NextResponse.json({ error: "this handle or wallet is banned" }, { status: 403 });
  if (owner !== zeroAddress || active || (await store.sellerByHandle(handle))) return NextResponse.json({ error: "this handle or wallet is already registered" }, { status: 409 });

  if ((await store.pendingOnboarding()).length >= MAX_PENDING) return NextResponse.json({ error: "too many pending requests, try later" }, { status: 429 });
  const row = await store.createOnboarding(handle, wallet, bioCodeFor(handle, wallet));
  if (!row) {
    const mine = await store.onboardingByWallet(wallet);
    if (mine && mine.handle === handle) return NextResponse.json({ id: mine.id, status: mine.status, bioCode: mine.bioCode, existing: true });
    return NextResponse.json({ error: "this handle or wallet already has an onboarding request" }, { status: 409 });
  }
  return NextResponse.json({ id: row.id, status: row.status, bioCode: row.bioCode }, { status: 201 });
}
