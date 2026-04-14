"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import { PLANS } from "@/types";

interface SubData {
  _id: string;
  userId: string;
  userEmail: string;
  plan: string;
  connections: number;
  status: string;
  startDate: string;
  endDate: string;
  credentials?: { m3uUrl: string; username: string; password: string };
  orderId: string;
  notes?: string;
  lastRenewedAt?: string;
  createdAt: string;
}

export default function AdminSubscriptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [sub, setSub] = useState<SubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [m3uUrl, setM3uUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    const res = await fetch(`/api/admin/subscriptions/${params.id}`);
    const data = await res.json();
    if (data.subscription) {
      setSub(data.subscription);
      setM3uUrl(data.subscription.credentials?.m3uUrl || "");
      setUsername(data.subscription.credentials?.username || "");
      setPassword(data.subscription.credentials?.password || "");
      setNotes(data.subscription.notes || "");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [params.id]);

  const patch = async (body: any, message: string) => {
    setMsg("Saving...");
    const res = await fetch(`/api/admin/subscriptions/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json();
      setMsg(d.error || "Failed");
    } else {
      setMsg(message);
      load();
    }
    setTimeout(() => setMsg(""), 3000);
  };

  const saveCredentials = () =>
    patch(
      { credentials: { m3uUrl, username, password } },
      "Credentials updated"
    );
  const extendBy = (months: number) =>
    patch({ extendMonths: months }, `Extended by ${months} month(s)`);
  const cancel = () => patch({ status: "cancelled" }, "Subscription cancelled");
  const expire = () => patch({ status: "expired" }, "Marked as expired");
  const reactivate = () => patch({ status: "active" }, "Reactivated");
  const saveNotes = () => patch({ notes }, "Notes saved");

  const resendEmail = async () => {
    setMsg("Sending...");
    const res = await fetch(
      `/api/admin/subscriptions/${params.id}/resend-email`,
      { method: "POST" }
    );
    if (!res.ok) {
      const d = await res.json();
      setMsg(d.error || "Failed");
    } else {
      setMsg("Credentials email sent");
    }
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <AdminGuard>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <button
          onClick={() => router.push("/admin/subscriptions")}
          className="text-sm text-slate-400 hover:text-white"
        >
          &larr; Back to Subscriptions
        </button>

        {loading ? (
          <div className="mt-8 text-slate-400">Loading...</div>
        ) : !sub ? (
          <div className="mt-8 text-slate-400">Subscription not found.</div>
        ) : (
          <>
            <h1 className="mt-4 text-2xl font-bold text-white">
              Subscription Detail
            </h1>

            {msg && (
              <div className="mt-4 rounded-lg border border-blue-800 bg-blue-900/30 px-4 py-2 text-sm text-blue-300">
                {msg}
              </div>
            )}

            {/* Summary */}
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Customer"
                  value={sub.userEmail}
                />
                <Field
                  label="Plan"
                  value={
                    PLANS.find((p) => p.id === sub.plan)?.name || sub.plan
                  }
                />
                <Field
                  label="Connections"
                  value={String(sub.connections)}
                />
                <div>
                  <span className="text-xs text-slate-500">Status</span>
                  <div className="mt-1">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        sub.status === "active"
                          ? "bg-green-900/50 text-green-400"
                          : sub.status === "cancelled"
                            ? "bg-red-900/50 text-red-400"
                            : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {sub.status}
                    </span>
                  </div>
                </div>
                <Field
                  label="Start"
                  value={new Date(sub.startDate).toLocaleDateString()}
                />
                <Field
                  label="End"
                  value={new Date(sub.endDate).toLocaleDateString()}
                />
                <Field
                  label="Order ID"
                  value={sub.orderId}
                />
                {sub.lastRenewedAt && (
                  <Field
                    label="Last renewed"
                    value={new Date(sub.lastRenewedAt).toLocaleString()}
                  />
                )}
              </div>
            </div>

            {/* Extend + status actions */}
            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <h3 className="text-sm font-semibold text-white">
                Extend / Status
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => extendBy(1)}
                  className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs text-white hover:bg-blue-600"
                >
                  + 1 Month
                </button>
                <button
                  onClick={() => extendBy(3)}
                  className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs text-white hover:bg-blue-600"
                >
                  + 3 Months
                </button>
                <button
                  onClick={() => extendBy(6)}
                  className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs text-white hover:bg-blue-600"
                >
                  + 6 Months
                </button>
                <button
                  onClick={() => extendBy(12)}
                  className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs text-white hover:bg-blue-600"
                >
                  + 12 Months
                </button>
                {sub.status !== "active" && (
                  <button
                    onClick={reactivate}
                    className="rounded-lg bg-green-700 px-3 py-1.5 text-xs text-white hover:bg-green-600"
                  >
                    Reactivate
                  </button>
                )}
                {sub.status === "active" && (
                  <button
                    onClick={expire}
                    className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-white hover:bg-slate-600"
                  >
                    Mark expired
                  </button>
                )}
                <button
                  onClick={cancel}
                  className="rounded-lg bg-red-700 px-3 py-1.5 text-xs text-white hover:bg-red-600"
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* Credentials */}
            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <h3 className="text-sm font-semibold text-white">Credentials</h3>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-xs text-slate-400">M3U URL</label>
                  <input
                    type="text"
                    value={m3uUrl}
                    onChange={(e) => setM3uUrl(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-400">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Password</label>
                    <input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveCredentials}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                  >
                    Save Credentials
                  </button>
                  {sub.credentials && (
                    <button
                      onClick={resendEmail}
                      className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
                    >
                      Resend to Customer
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <h3 className="text-sm font-semibold text-white">Notes</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500"
                placeholder="Internal notes (not visible to customer)"
              />
              <button
                onClick={saveNotes}
                className="mt-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
              >
                Save Notes
              </button>
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
      <p className="mt-0.5 text-sm text-white break-all">{value}</p>
    </div>
  );
}
