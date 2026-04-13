"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PLANS } from "@/types";

interface OrderData {
  _id: string;
  plan: string;
  amount: number;
  currency: string;
  txHash: string;
  status: string;
  createdAt: string;
}

interface SubscriptionData {
  _id: string;
  plan: string;
  connections: number;
  status: string;
  startDate: string;
  endDate: string;
  credentials?: {
    m3uUrl: string;
    username: string;
    password: string;
  };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      Promise.all([
        fetch("/api/orders").then((r) => r.json()),
        fetch("/api/subscriptions").then((r) => r.json()),
      ]).then(([ordersData, subsData]) => {
        setOrders(ordersData.orders || []);
        setSubscriptions(subsData.subscriptions || []);
        setLoading(false);
      });
    }
  }, [session]);

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!session) return null;

  const activeSubs = subscriptions.filter((s) => s.status === "active");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>
      <p className="mt-1 text-slate-400">
        Welcome back, {session.user?.name}
      </p>

      {/* Active Subscriptions */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-white">
          Active Subscriptions
        </h2>
        {activeSubs.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center">
            <p className="text-slate-400">No active subscriptions yet.</p>
            <button
              onClick={() => router.push("/subscribe")}
              className="mt-3 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              Get Started
            </button>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {activeSubs.map((sub) => {
              const planInfo = PLANS.find((p) => p.id === sub.plan);
              return (
                <div
                  key={sub._id}
                  className="rounded-xl border border-slate-800 bg-slate-900/50 p-6"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white">
                      {planInfo?.name || sub.plan} Plan
                    </h3>
                    <span className="rounded-full bg-green-900/50 px-2.5 py-0.5 text-xs font-medium text-green-400">
                      Active
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    {sub.connections} connection{sub.connections > 1 ? "s" : ""}
                    {" | "}
                    Expires{" "}
                    {new Date(sub.endDate).toLocaleDateString()}
                  </p>

                  {sub.credentials && (
                    <div className="mt-4 space-y-2 rounded-lg bg-slate-800/50 p-4">
                      <h4 className="text-sm font-medium text-white">
                        Streaming Credentials
                      </h4>
                      <div>
                        <label className="text-xs text-slate-500">
                          M3U URL
                        </label>
                        <div className="mt-0.5 break-all rounded bg-slate-900 px-3 py-1.5 text-xs text-slate-300 font-mono">
                          {sub.credentials.m3uUrl}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-500">
                            Username
                          </label>
                          <div className="mt-0.5 rounded bg-slate-900 px-3 py-1.5 text-xs text-slate-300 font-mono">
                            {sub.credentials.username}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">
                            Password
                          </label>
                          <div className="mt-0.5 rounded bg-slate-900 px-3 py-1.5 text-xs text-slate-300 font-mono">
                            {sub.credentials.password}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Order History */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-white">Payment History</h2>
        {orders.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No orders yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Plan</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">TX Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td className="py-3 pr-4 text-slate-300">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 pr-4 capitalize text-white">
                      {order.plan}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {order.amount} {order.currency}
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
                    <td className="py-3 font-mono text-xs text-slate-500">
                      {order.txHash.slice(0, 16)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
