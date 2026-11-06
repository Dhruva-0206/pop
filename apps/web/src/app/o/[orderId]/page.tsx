import { Suspense } from "react";
import { ReceiptSkeleton } from "@/components/ui";
import OrderView from "./OrderView";

export const metadata = { title: "Your order" };

export default function Page() {
  return (
    <Suspense fallback={<ReceiptSkeleton />}>
      <OrderView />
    </Suspense>
  );
}
