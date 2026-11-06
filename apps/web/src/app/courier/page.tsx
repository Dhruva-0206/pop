import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui";
import Courier from "./Courier";

export const metadata = { title: "Courier desk" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton wide />}>
      <Courier />
    </Suspense>
  );
}
