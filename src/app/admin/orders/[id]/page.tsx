"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import { PLANS } from "@/types";

interface OrderData {
  _id: string;
  userId: string;
  userEmail: string;
  userName: string;
  plan: string;
  amount: number;
  currency: string;
  txHash: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [m3uUrl, setM3uUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/orders/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setOrder(data.order || null);
        setLoading(false);
      });
  }, [params.id]);

  const handleConfirm = async () => {
    await fetch(`/api/admin/orders/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    setOrder((prev) => (prev ? { ...prev, status: "confirmed" } : null));
  };

  const handleProvision = async () => {
    if (!m3uUrl || !username || !password) return;
    setSaving(true);
    await fetch(`/api/admin/orders/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "provisioned",
        credentials: { m3uUrl, username, password },
      }),
    });
    setOrder((prev) => (prev ? { ...prev, status: "provisioned" } : null));
    setSaved(true);
    setSaving(false);
  };

  return (
    <AdminGuard>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <button
          onClick={() => router.push("/admin/orders")}
          className="text-sm text-slate-400 hover:text-white"
        >
          &larr; Back to Orders
        </button>

        {loading ? (
          <div className="mt-8 text-slate-400">Loading...</div>
        ) : !order ? (
          <div className="mt-8 text-slate-400">Order not found.</div>
        ) : (
          <>
            <h1 className="mt-4 text-2xl font-bold text-white">
              Order Detail
            </h1>

            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Customer" value={order.userName} />
                <Field label="Email" value={order.userEmail} />
                <Field
                  label="Plan"
                  value={
                    PLANS.find((p) => p.id === order.plan)?.name || order.plan
                  }
                />
                <Field
                  label="Amount"
                  value={`${order.amount} ${order.currency}`}
                />
                <Field
                  label="Date"
                  value={new Date(order.createdAt).toLocaleString()}
                />
                <div>
                  <span className="text-xs text-slate-500">Status</span>
                  <div className="mt-1">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        order.status === "provisioned"
                          ? "bg-green-900/50 text-green-400"
                          : order.status === "confirmed"
                            ? "bg-blue-900/50 text-blue-400"
                            : "bg-yellow-900/50 text-yellow-400"
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <span className="text-xs text-slate-500">Transaction Hash</span>
                <div className="mt-1 break-all rounded bg-slate-800 px-3 py-2 font-mono text-xs text-slate-300">
                  {order.txHash}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 space-y-4">
              {order.status === "pending" && (
                <button
                  onClick={handleConfirm}
                  className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-500"
                >
                  Mark as Confirmed
                </button>
              )}

              {(order.status === "confirmed" || order.status === "pending") &&
                !saved && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
                    <h3 className="font-semibold text-white">
                      Provision Credentials
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Enter the streaming credentials to send to the customer.
                    </p>
                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="text-sm text-slate-300">
                          M3U URL
                        </label>
                        <input
                          type="text"
                          value={m3uUrl}
                          onChange={(e) => setM3uUrl(e.target.value)}
                          placeholder="http://..."
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="text-sm text-slate-300">
                            Username
                          </label>
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-slate-300">
                            Password
                          </label>
                          <input
                            type="text"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleProvision}
                        disabled={!m3uUrl || !username || !password || saving}
                        className="rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
                      >
                        {saving
                          ? "Provisioning..."
                          : "Provision & Email Customer"}
                      </button>
                    </div>
                  </div>
                )}

              {saved && (
                <div className="rounded-xl border border-green-800 bg-green-900/20 p-6 text-center">
                  <p className="font-semibold text-green-400">
                    Credentials saved and email sent to {order.userEmail}!
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminGuard>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-slate-500">{label}</span>
      <p className="mt-0.5 text-sm text-white">{value}</p>
    </div>
  );
}
