import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui";
import Arbiter from "./Arbiter";

export const metadata = { title: "Arbiter and staff · PoP" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton wide />}>
      <Arbiter />
    </Suspense>
  );
}
