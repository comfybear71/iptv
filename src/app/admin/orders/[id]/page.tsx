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
  desiredChannelName?: string;
  discountPct?: number;
  originalPriceUsd?: number;
  discountedPriceUsd?: number;
  walletAddress?: string;
  budjuBalanceAtPayment?: number;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_XTREME_HOST = "https://mybunny.tv";

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Credential fields
  const [xtremeHost, setXtremeHost] = useState(DEFAULT_XTREME_HOST);
  const [xtremeUsername, setXtremeUsername] = useState("");
  const [xtremePassword, setXtremePassword] = useState("");
  const [m3uUrlLiveTV, setM3uUrlLiveTV] = useState("");
  const [m3uUrlMovies, setM3uUrlMovies] = useState("");
  const [m3uUrlSeries, setM3uUrlSeries] = useState("");
  const [m3uUrlAll, setM3uUrlAll] = useState("");
  const [channelName, setChannelName] = useState("");
  const [webPlayerUrl, setWebPlayerUrl] = useState("");

  useEffect(() => {
    fetch(`/api/admin/orders/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setOrder(data.order || null);
        // Prefill channel name + Xtreme username with desired channel name
        if (data.order?.desiredChannelName) {
          setChannelName(data.order.desiredChannelName);
          setXtremeUsername(data.order.desiredChannelName);
        }
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
    const credentials = {
      xtremeHost: xtremeHost.trim(),
      xtremeUsername: xtremeUsername.trim(),
      xtremePassword: xtremePassword.trim(),
      m3uUrlLiveTV: m3uUrlLiveTV.trim(),
      m3uUrlMovies: m3uUrlMovies.trim(),
      m3uUrlSeries: m3uUrlSeries.trim(),
      m3uUrlAll: m3uUrlAll.trim(),
      channelName: channelName.trim(),
      webPlayerUrl: webPlayerUrl.trim(),
    };

    // Require at least one credential field
    const hasAnything = Object.values(credentials).some((v) => v);
    if (!hasAnything) {
      setError("Fill in at least one credential field before provisioning");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "provisioned",
          credentials,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to provision");
      }
      setOrder((prev) => (prev ? { ...prev, status: "provisioned" } : null));
      setSaved(true);
    } catch (err: any) {
      setError(err?.message || "Failed");
    } finally {
      setSaving(false);
    }
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

              {/* Customer's requested channel name */}
              {order.desiredChannelName && (
                <div className="mt-4 rounded-lg border border-blue-800 bg-blue-900/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-blue-400">
                    Customer&apos;s Requested Channel Name
                  </p>
                  <p className="mt-1 font-mono text-sm text-white">
                    {order.desiredChannelName}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Use this as their Xtreme username in MyBunny.TV if
                    available.
                  </p>
                </div>
              )}

              {/* Discount info */}
              {order.discountPct !== undefined && order.discountPct > 0 && (
                <div className="mt-4 rounded-lg border border-green-800 bg-green-900/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-green-400">
                    BUDJU Holder Discount Applied
                  </p>
                  <p className="mt-1 text-sm text-white">
                    {order.discountPct}% off — was $
                    {order.originalPriceUsd?.toFixed(2)}, paid $
                    {order.discountedPriceUsd?.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    BUDJU at payment:{" "}
                    {order.budjuBalanceAtPayment?.toLocaleString()}
                  </p>
                </div>
              )}

              {/* Wallet + tx */}
              {order.walletAddress && (
                <div className="mt-4">
                  <span className="text-xs text-slate-500">
                    Payer Wallet
                  </span>
                  <div className="mt-1 break-all rounded bg-slate-800 px-3 py-2 font-mono text-xs text-slate-300">
                    {order.walletAddress}
                  </div>
                </div>
              )}
              <div className="mt-4">
                <span className="text-xs text-slate-500">
                  Transaction Hash
                </span>
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
                      Provision MyBunny.TV Credentials
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Fill in the credentials MyBunny.TV provided. All fields
                      are optional except you need at least one.
                    </p>

                    {/* Xtreme API section */}
                    <div className="mt-5 border-t border-slate-800 pt-4">
                      <h4 className="text-sm font-semibold text-white">
                        Xtreme API (Primary)
                      </h4>
                      <p className="mt-1 text-xs text-slate-500">
                        Most apps (IPTV Smarters, TiviMate, etc.) use these.
                      </p>
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="text-xs text-slate-400">
                            Host / Server URL
                          </label>
                          <input
                            type="text"
                            value={xtremeHost}
                            onChange={(e) => setXtremeHost(e.target.value)}
                            placeholder="https://mybunny.tv"
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="text-xs text-slate-400">
                              Username
                            </label>
                            <input
                              type="text"
                              value={xtremeUsername}
                              onChange={(e) =>
                                setXtremeUsername(e.target.value)
                              }
                              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400">
                              Password
                            </label>
                            <input
                              type="text"
                              value={xtremePassword}
                              onChange={(e) =>
                                setXtremePassword(e.target.value)
                              }
                              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* M3U section */}
                    <div className="mt-5 border-t border-slate-800 pt-4">
                      <h4 className="text-sm font-semibold text-white">
                        M3U Playlists
                      </h4>
                      <p className="mt-1 text-xs text-slate-500">
                        Separate URLs for TV / Movies / Series (plus an
                        optional combined playlist).
                      </p>
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="text-xs text-slate-400">
                            Live TV M3U
                          </label>
                          <input
                            type="text"
                            value={m3uUrlLiveTV}
                            onChange={(e) => setM3uUrlLiveTV(e.target.value)}
                            placeholder="http://..."
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400">
                            Movies M3U
                          </label>
                          <input
                            type="text"
                            value={m3uUrlMovies}
                            onChange={(e) => setM3uUrlMovies(e.target.value)}
                            placeholder="http://..."
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400">
                            Series M3U
                          </label>
                          <input
                            type="text"
                            value={m3uUrlSeries}
                            onChange={(e) => setM3uUrlSeries(e.target.value)}
                            placeholder="http://..."
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400">
                            All-in-one M3U (optional)
                          </label>
                          <input
                            type="text"
                            value={m3uUrlAll}
                            onChange={(e) => setM3uUrlAll(e.target.value)}
                            placeholder="http://..."
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* User preferences + web */}
                    <div className="mt-5 border-t border-slate-800 pt-4">
                      <h4 className="text-sm font-semibold text-white">
                        Display + Web Player
                      </h4>
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="text-xs text-slate-400">
                            Channel name (shown to customer)
                          </label>
                          <input
                            type="text"
                            value={channelName}
                            onChange={(e) => setChannelName(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400">
                            Web Player URL (watch in browser)
                          </label>
                          <input
                            type="text"
                            value={webPlayerUrl}
                            onChange={(e) => setWebPlayerUrl(e.target.value)}
                            placeholder="https://player.mybunny.tv/..."
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                          />
                        </div>
                      </div>
                    </div>

                    {error && (
                      <p className="mt-4 text-sm text-red-400">{error}</p>
                    )}

                    <button
                      onClick={handleProvision}
                      disabled={saving}
                      className="mt-5 rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
                    >
                      {saving
                        ? "Provisioning..."
                        : "Provision & Email Customer"}
                    </button>
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
