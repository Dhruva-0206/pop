import { Suspense } from "react";
import Verify from "./Verify";

export const metadata = { title: "Seller record · PoP" };

export default function Page() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md p-6 text-neutral-500">Loading…</main>}>
      <Verify />
    </Suspense>
  );
}
