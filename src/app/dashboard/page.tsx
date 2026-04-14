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
    xtremeHost?: string;
    xtremeUsername?: string;
    xtremePassword?: string;
    m3uUrlLiveTV?: string;
    m3uUrlMovies?: string;
    m3uUrlSeries?: string;
    m3uUrlAll?: string;
    channelName?: string;
    webPlayerUrl?: string;
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

      {/* Balance */}
      <BalanceCard />

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
          <div className="mt-4 space-y-6">
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

                  {sub.credentials && <CredentialsCard creds={sub.credentials} />}
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

interface CredsShape {
  xtremeHost?: string;
  xtremeUsername?: string;
  xtremePassword?: string;
  m3uUrlLiveTV?: string;
  m3uUrlMovies?: string;
  m3uUrlSeries?: string;
  m3uUrlAll?: string;
  channelName?: string;
  webPlayerUrl?: string;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <label className="text-xs text-slate-500">{label}</label>
        <div className="mt-0.5 break-all rounded bg-slate-900 px-3 py-1.5 font-mono text-xs text-slate-200">
          {value}
        </div>
      </div>
      <button
        onClick={copy}
        className="mt-5 flex-shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
      >
        {copied ? "✓" : "Copy"}
      </button>
    </div>
  );
}

function CredentialsCard({ creds }: { creds: CredsShape }) {
  const hasXtreme =
    creds.xtremeHost || creds.xtremeUsername || creds.xtremePassword;
  const hasM3u =
    creds.m3uUrlAll ||
    creds.m3uUrlLiveTV ||
    creds.m3uUrlMovies ||
    creds.m3uUrlSeries;

  return (
    <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <h4 className="text-sm font-semibold text-white">
        Your Streaming Credentials
      </h4>

      {creds.channelName && (
        <div className="mt-3">
          <CopyField label="Channel name" value={creds.channelName} />
        </div>
      )}

      {hasXtreme && (
        <div className="mt-5 border-t border-slate-800 pt-4">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Xtreme API (IPTV Smarters / TiviMate / OTT Nav)
          </h5>
          <div className="mt-3 space-y-3">
            {creds.xtremeHost && (
              <CopyField label="Host / Portal URL" value={creds.xtremeHost} />
            )}
            {creds.xtremeUsername && (
              <CopyField label="Username" value={creds.xtremeUsername} />
            )}
            {creds.xtremePassword && (
              <CopyField label="Password" value={creds.xtremePassword} />
            )}
          </div>
        </div>
      )}

      {hasM3u && (
        <div className="mt-5 border-t border-slate-800 pt-4">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            M3U Playlists
          </h5>
          <div className="mt-3 space-y-3">
            {creds.m3uUrlAll && (
              <CopyField label="All channels" value={creds.m3uUrlAll} />
            )}
            {creds.m3uUrlLiveTV && (
              <CopyField label="Live TV" value={creds.m3uUrlLiveTV} />
            )}
            {creds.m3uUrlMovies && (
              <CopyField label="Movies" value={creds.m3uUrlMovies} />
            )}
            {creds.m3uUrlSeries && (
              <CopyField label="Series" value={creds.m3uUrlSeries} />
            )}
          </div>
        </div>
      )}

      {creds.webPlayerUrl && (
        <div className="mt-5 border-t border-slate-800 pt-4">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Watch in Browser
          </h5>
          <a
            href={creds.webPlayerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500"
          >
            Open Web Player →
          </a>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500">
        These credentials are always available here in your dashboard. Bookmark
        this page.
      </p>
    </div>
  );
}

function BalanceCard() {
  const [bal, setBal] = useState<{
    balanceSOL: number;
    balanceBUDJU: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setBal({
            balanceSOL: data.user.balanceSOL || 0,
            balanceBUDJU: data.user.balanceBUDJU || 0,
          });
        }
      });
  }, []);

  if (!bal || (bal.balanceSOL === 0 && bal.balanceBUDJU === 0)) return null;

  return (
    <div className="mt-6 rounded-xl border border-blue-800 bg-blue-900/20 p-4">
      <p className="text-xs uppercase tracking-wide text-blue-400">
        Your ComfyTV Balance
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <span className="text-xl font-bold text-white">
          {bal.balanceSOL.toFixed(4)} SOL
        </span>
        <span className="text-xl font-bold text-white">
          {bal.balanceBUDJU.toFixed(2)} BUDJU
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Use your balance to subscribe instantly — no waiting for tx confirmation.
      </p>
    </div>
  );
}
