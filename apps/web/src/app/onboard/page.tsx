import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui";
import Onboard from "./Onboard";

export const metadata = { title: "Become a protected seller · PoP" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Onboard />
    </Suspense>
  );
}
