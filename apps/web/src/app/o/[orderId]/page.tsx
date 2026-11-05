import { Suspense } from "react";
import OrderView from "./OrderView";

export const metadata = { title: "Your order · PoP" };

export default function Page() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md p-6 text-neutral-500">Loading…</main>}>
      <OrderView />
    </Suspense>
  );
}
