import { Suspense } from "react";
import Checkout from "./Checkout";

export const metadata = { title: "Checkout · PoP" };

// Cache Components: the static shell prerenders; the live checkout streams in at request time.
export default function Page() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md p-6 text-neutral-500">Loading…</main>}>
      <Checkout />
    </Suspense>
  );
}
