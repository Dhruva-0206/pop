import WorldTest from "./WorldTest";

export const metadata = { title: "World review test (dev)" };

export default function Page() {
  return (
    <div className="page stack">
      <div className="rounded-control bg-warn-soft px-3 py-1 text-xs font-bold">TEST MODE · developer smoke test</div>
      <h1 className="text-xl font-semibold">World ID review check</h1>
      <p className="text-sm text-muted">
        Opens World ID with the seller&apos;s review action (one action per seller). Use simulator.worldcoin.org with the staging environment.
      </p>
      <WorldTest />
    </div>
  );
}
