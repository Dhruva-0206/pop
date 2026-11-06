import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui";
import Checkout from "./Checkout";

export const metadata = { title: "Checkout · PoP" };

// Cache Components: the static shell prerenders; the live checkout streams in at request time.
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Checkout />
    </Suspense>
  );
}
