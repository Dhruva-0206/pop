import { Suspense } from "react";
import Courier from "./Courier";

export const metadata = { title: "SIMULATED COURIER · PoP" };

export default function Page() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-2xl p-6 text-neutral-500">Loading…</main>}>
      <Courier />
    </Suspense>
  );
}
