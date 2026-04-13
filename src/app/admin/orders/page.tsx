"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";

interface OrderData {
  _id: string;
  userEmail: string;
  userName: string;
  plan: string;
  amount: number;
  currency: string;
  txHash: string;
  status: string;
  createdAt: string;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/admin/orders")
      .then((r) => r.json())
      .then((data) => {
        setOrders(data.orders || []);
        setLoading(false);
      });
  }, []);

  const updateStatus = async (orderId: string, status: string) => {
    await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setOrders((prev) =>
      prev.map((o) => (o._id === orderId ? { ...o, status } : o))
    );
  };

  const filtered =
    filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <AdminGuard>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Orders</h1>
          <div className="flex gap-2">
            {["all", "pending", "confirmed", "provisioned"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
                  filter === f
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="mt-8 text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 text-slate-400">No orders found.</div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Customer</th>
                  <th className="pb-3 pr-4">Plan</th>
                  <th className="pb-3 pr-4">Amount</th>
                  <th className="pb-3 pr-4">TX Hash</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map((order) => (
                  <tr key={order._id}>
                    <td className="py-3 pr-4 text-slate-300">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="text-white">{order.userName}</div>
                      <div className="text-xs text-slate-500">
                        {order.userEmail}
                      </div>
                    </td>
                    <td className="py-3 pr-4 capitalize text-white">
                      {order.plan}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {order.amount} {order.currency}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-500">
                      {order.txHash.slice(0, 12)}...
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          order.status === "provisioned"
                            ? "bg-green-900/50 text-green-400"
                            : order.status === "confirmed"
                              ? "bg-blue-900/50 text-blue-400"
                              : "bg-yellow-900/50 text-yellow-400"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        {order.status === "pending" && (
                          <button
                            onClick={() =>
                              updateStatus(order._id, "confirmed")
                            }
                            className="rounded bg-blue-700 px-2 py-1 text-xs text-white hover:bg-blue-600"
                          >
                            Confirm
                          </button>
                        )}
                        <Link
                          href={`/admin/orders/${order._id}`}
                          className="rounded bg-slate-700 px-2 py-1 text-xs text-white hover:bg-slate-600"
                        >
                          Details
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
