import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui";
import OrderView from "./OrderView";

export const metadata = { title: "Your order" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OrderView />
    </Suspense>
  );
}
