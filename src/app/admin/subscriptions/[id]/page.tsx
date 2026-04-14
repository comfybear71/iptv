"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import { PLANS, SubscriptionCredentials } from "@/types";
import {
  buildMyBunnyM3uUrls,
  COLLECTION_SIZES,
  CollectionSize,
  DEFAULT_XTREME_HOST,
} from "@/lib/mybunny";

interface SubData {
  _id: string;
  userId: string;
  userEmail: string;
  plan: string;
  connections: number;
  status: string;
  startDate: string;
  endDate: string;
  credentials?: SubscriptionCredentials;
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

  const [xtremeHost, setXtremeHost] = useState(DEFAULT_XTREME_HOST);
  const [xtremeUsername, setXtremeUsername] = useState("");
  const [xtremePassword, setXtremePassword] = useState("");
  const [collectionSize, setCollectionSize] = useState<CollectionSize>(2);
  const [channelName, setChannelName] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    const res = await fetch(`/api/admin/subscriptions/${params.id}`);
    const data = await res.json();
    if (data.subscription) {
      setSub(data.subscription);
      const c: SubscriptionCredentials = data.subscription.credentials || {};
      setXtremeHost(c.xtremeHost || DEFAULT_XTREME_HOST);
      setXtremeUsername(c.xtremeUsername || "");
      setXtremePassword(c.xtremePassword || "");
      setCollectionSize((c.collectionSize as CollectionSize) || 2);
      setChannelName(c.channelName || "");
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

  const saveCredentials = () => {
    const credentials: SubscriptionCredentials = {
      xtremeHost: xtremeHost.trim() || DEFAULT_XTREME_HOST,
      xtremeUsername: xtremeUsername.trim(),
      xtremePassword: xtremePassword.trim(),
      collectionSize,
      channelName: channelName.trim(),
    };
    patch({ credentials }, "Credentials updated");
  };

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

  const previewUrls = buildMyBunnyM3uUrls(
    xtremeHost,
    xtremeUsername,
    xtremePassword,
    collectionSize
  );

  const hasCreds = !!(xtremeUsername && xtremePassword);

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
                <Field label="Customer" value={sub.userEmail} />
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
                <Field label="Order ID" value={sub.orderId} />
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
              <h3 className="text-sm font-semibold text-white">
                MyBunny.TV Credentials
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Only Xtreme host, username, and password are needed. All M3U
                URLs and web player links are computed from these.
              </p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Host</label>
                  <input
                    type="text"
                    value={xtremeHost}
                    onChange={(e) => setXtremeHost(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-400">
                      Xtreme Username
                    </label>
                    <input
                      type="text"
                      value={xtremeUsername}
                      onChange={(e) => setXtremeUsername(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">
                      Xtreme Password
                    </label>
                    <input
                      type="text"
                      value={xtremePassword}
                      onChange={(e) => setXtremePassword(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-white"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-400">
                      VOD Size
                    </label>
                    <select
                      value={collectionSize}
                      onChange={(e) =>
                        setCollectionSize(
                          Number(e.target.value) as CollectionSize
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                    >
                      {COLLECTION_SIZES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label} — {s.description}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">
                      Channel name
                    </label>
                    <input
                      type="text"
                      value={channelName}
                      onChange={(e) => setChannelName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>

                {hasCreds && (
                  <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Preview
                    </p>
                    <div className="mt-2 space-y-1 font-mono text-[11px] text-slate-400">
                      <div className="truncate">
                        <span className="text-orange-400">Hot:</span>{" "}
                        {previewUrls.hotChannels}
                      </div>
                      <div className="truncate">
                        <span className="text-blue-400">Live:</span>{" "}
                        {previewUrls.liveTV}
                      </div>
                      <div className="truncate">
                        <span className="text-red-400">Movies:</span>{" "}
                        {previewUrls.movies}
                      </div>
                      <div className="truncate">
                        <span className="text-cyan-400">Series:</span>{" "}
                        {previewUrls.series}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={saveCredentials}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                  >
                    Save Credentials
                  </button>
                  {hasCreds && (
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
