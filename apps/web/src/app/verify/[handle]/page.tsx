import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui";
import Verify from "./Verify";

export const metadata = { title: "Seller record · PoP" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Verify />
    </Suspense>
  );
}
