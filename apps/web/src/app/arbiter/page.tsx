import { Suspense } from "react";
import Arbiter from "./Arbiter";

export const metadata = { title: "Arbiter and staff · PoP" };

export default function Page() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-2xl p-6 text-neutral-500">Loading…</main>}>
      <Arbiter />
    </Suspense>
  );
}
