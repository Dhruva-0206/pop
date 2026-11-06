import { NextResponse, connection } from "next/server";
import { getAddress, isAddress, zeroAddress } from "viem";
import { z } from "zod";
import { handleHash, registryAbi } from "@pop/shared";
import { deployment, pub, store } from "@/lib/server/chain";
import { onboardRequestMessage } from "@/lib/messages";
import { HANDLE_RE, bioCodeFor } from "@/lib/server/onboarding";
import { checkVendorProof } from "@/lib/server/vendor";

const MAX_PENDING = 200;
const Body = z.object({
  handle: z.string().trim().toLowerCase().transform((s) => s.replace(/^@/, "")),
  wallet: z.string().refine((a) => isAddress(a)),
  /** The wallet's signature over onboardRequestMessage(handle, wallet): the requester controls the wallet. */
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  /** World ID proof for this handle (signal bound to the handle). One human, one shop. */
  idkitResult: z.unknown().optional(),
  /** Local development servers only (POP_DEV_SKIP_WORLD=1); refused everywhere else. */
  skipWorld: z.boolean().optional(),
});

/**
 * Steps 1 and 2 of /onboard: the vendor gives a handle and proves with World ID that they are one unique person (one human, one shop);
 * only then do they get a bio code. Nothing is registered here: with staff approval a team member checks the bio first, and in demo
 * mode (ONBOARD_DEMO_AUTOAPPROVE, testnet only) /api/onboard/auto skips that check.
 */
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

  // One human, one shop. A refused person never gets a bio code.
  const vp = await checkVendorProof({ handle, idkitResult: parsed.data.idkitResult, skipWorld: parsed.data.skipWorld });
  if (!vp.ok) return NextResponse.json({ ok: false, error: vp.error }, { status: vp.status });

  const row = await store.createOnboarding(handle, wallet, bioCodeFor(handle, wallet));
  if (!row) {
    const mine = await store.onboardingByWallet(wallet);
    if (mine && mine.handle === handle) return NextResponse.json({ id: mine.id, status: mine.status, bioCode: mine.bioCode, existing: true });
    if (!vp.resumed) await store.releaseVendor(vp.hash); // no request was created, so do not keep this person's claim
    return NextResponse.json({ error: "this handle or wallet already has an onboarding request" }, { status: 409 });
  }
  return NextResponse.json({ id: row.id, status: row.status, bioCode: row.bioCode }, { status: 201 });
}
