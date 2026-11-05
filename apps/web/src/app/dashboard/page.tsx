import { Suspense } from "react";
import Dashboard from "./Dashboard";

export const metadata = { title: "Seller dashboard · PoP" };

export default function Page() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-2xl p-6 text-neutral-500">Loading…</main>}>
      <Dashboard />
    </Suspense>
  );
}
