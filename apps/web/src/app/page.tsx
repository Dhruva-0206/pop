import Link from "next/link";
import { APP_NAME, APP_TAGLINE } from "@pop/shared";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col justify-center gap-4 p-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
        {APP_NAME}: {APP_TAGLINE}
      </p>
      <h1 className="text-3xl font-bold">If it doesn&apos;t arrive, you get your money back. Automatically.</h1>
      <p className="text-neutral-600">Prepaid orders from Instagram and WhatsApp sellers, as safe as cash on delivery.</p>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white" href="/p/jhumka-01">
          Try a checkout
        </Link>
        <Link className="rounded-lg border px-4 py-2" href="/dashboard">
          I sell on Instagram
        </Link>
        <Link className="rounded-lg border px-4 py-2" href="/courier">
          Simulated courier
        </Link>
      </div>
      <p className="text-xs text-neutral-400">Work in progress · ETHGlobal Mumbai 2026 · test network only</p>
    </main>
  );
}
