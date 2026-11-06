import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui";
import Dashboard from "./Dashboard";

export const metadata = { title: "Seller dashboard" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton wide />}>
      <Dashboard />
    </Suspense>
  );
}
