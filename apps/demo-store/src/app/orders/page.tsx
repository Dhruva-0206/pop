import Link from "next/link";
import Orders from "./Orders";

export const metadata = { title: "My orders" };

export default function OrdersPage() {
  return (
    <div className="page stack">
      <h1>My orders</h1>
      <Orders />
      <p>
        <Link href="/">Back to the shop</Link>
      </p>
    </div>
  );
}
