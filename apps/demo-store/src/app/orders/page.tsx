import Link from "next/link";
import Orders from "./Orders";

export default function OrdersPage() {
  return (
    <main className="mx-auto max-w-xl space-y-4 p-6">
      <div className="rounded bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">TEST MODE · test USDT has no value</div>
      <h1 className="text-2xl font-bold">Kurta Co. · my orders</h1>
      <Orders />
      <Link href="/" className="text-sm underline">
        Back to the store
      </Link>
    </main>
  );
}
