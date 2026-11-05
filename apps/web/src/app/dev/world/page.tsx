import WorldTest from "./WorldTest";

export const metadata = { title: "World review test (dev)" };

export default function Page() {
  return (
    <main className="mx-auto max-w-xl space-y-4 p-6">
      <div className="rounded bg-amber-100 px-3 py-1 text-xs font-bold">TEST MODE · developer smoke test</div>
      <h1 className="text-xl font-semibold">World ID review check</h1>
      <p className="text-sm text-neutral-600">
        Opens World ID for the action &quot;review&quot;. Use simulator.worldcoin.org with the staging environment.
      </p>
      <WorldTest />
    </main>
  );
}
