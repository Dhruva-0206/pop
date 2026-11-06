import { Suspense } from "react";
import Onboard from "./Onboard";

export const metadata = { title: "Become a protected seller · PoP" };

export default function Page() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md p-6 text-neutral-500">Loading…</main>}>
      <Onboard />
    </Suspense>
  );
}
