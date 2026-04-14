"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PLANS, SubscriptionCredentials } from "@/types";
import {
  buildMyBunnyM3uUrls,
  buildWebPlayerUrl,
  DEFAULT_XTREME_HOST,
} from "@/lib/mybunny";

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
  credentials?: SubscriptionCredentials;
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
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-slate-400">
          Welcome back, {session.user?.name}
        </p>
      </div>

      <BalanceCard />

      {/* Active Subscriptions */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-white">
          My Subscriptions
        </h2>
        {activeSubs.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
            <p className="text-slate-400">No active subscriptions yet.</p>
            <button
              onClick={() => router.push("/subscribe")}
              className="mt-4 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Get Started
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            {activeSubs.map((sub) => (
              <SubscriptionCard key={sub._id} sub={sub} />
            ))}
          </div>
        )}
      </div>

      {/* Order History */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-white">Payment History</h2>
        {orders.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No orders yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/30">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Plan</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">TX</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td className="p-3 text-slate-300">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 capitalize text-white">
                      {order.plan}
                    </td>
                    <td className="p-3 text-slate-300">
                      {order.amount} {order.currency}
                    </td>
                    <td className="p-3">
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
                    <td className="p-3 font-mono text-xs text-slate-500">
                      {order.txHash.slice(0, 12)}...
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

/* -------- Sleek subscription card -------- */

function SubscriptionCard({ sub }: { sub: SubscriptionData }) {
  const planInfo = PLANS.find((p) => p.id === sub.plan);
  const planName = planInfo?.name || sub.plan;
  const devices = sub.connections;

  const endDate = new Date(sub.endDate);
  const now = new Date();
  const daysLeft = Math.ceil(
    (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  const isExpiringSoon = daysLeft <= 7 && daysLeft > 0;
  const isExpired = daysLeft <= 0;

  const planColors: Record<string, string> = {
    lite: "from-slate-700 to-slate-800",
    family: "from-blue-800 to-indigo-900",
    premium: "from-purple-800 to-fuchsia-900",
    titan: "from-amber-700 via-orange-800 to-red-900",
  };
  const gradient = planColors[sub.plan] || planColors.lite;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 shadow-xl">
      {/* Hero */}
      <div
        className={`relative bg-gradient-to-br ${gradient} px-6 py-5`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
              {planName} Plan
            </p>
            <h3 className="mt-1 text-2xl font-bold text-white">
              {devices} {devices === 1 ? "Device" : "Devices"}
            </h3>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-white/70">
              {isExpired ? "Expired" : "Renews / Expires"}
            </p>
            <p className="mt-1 text-lg font-semibold text-white">
              {endDate.toLocaleDateString()}
            </p>
            <p
              className={`text-xs font-medium ${
                isExpired
                  ? "text-red-300"
                  : isExpiringSoon
                    ? "text-amber-200"
                    : "text-white/70"
              }`}
            >
              {isExpired
                ? "Subscription expired"
                : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
            </p>
          </div>
        </div>

        {/* Status pill */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-300 ring-1 ring-green-400/40">
            ● Active
          </span>
          {devices === 1 && (
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200 ring-1 ring-amber-400/40">
              Single-device plan
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5">
        {devices === 1 && (
          <div className="mb-5 rounded-xl border border-amber-800 bg-amber-900/20 p-3 text-xs text-amber-200">
            ⚠️ This plan supports <strong>1 device at a time</strong>.
            Streaming on a second device will disconnect the first.
            <br />
            Need more devices? Upgrade to{" "}
            <a href="/pricing" className="underline">
              Family (2), Premium (3), or Titan (4)
            </a>
            .
          </div>
        )}

        {sub.credentials ? (
          <CredentialsSection creds={sub.credentials} />
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5 text-center">
            <p className="text-sm text-slate-400">
              Credentials being provisioned. You&apos;ll receive an email once
              ready.
            </p>
          </div>
        )}

        <SetupGuide />
      </div>
    </div>
  );
}

/* -------- Credentials section with copy buttons -------- */

function CredentialsSection({ creds }: { creds: SubscriptionCredentials }) {
  const host = creds.xtremeHost || DEFAULT_XTREME_HOST;
  const urls = buildMyBunnyM3uUrls(
    host,
    creds.xtremeUsername,
    creds.xtremePassword,
    creds.collectionSize || 2
  );

  const hasCreds = !!(creds.xtremeUsername && creds.xtremePassword);
  if (!hasCreds) return null;

  return (
    <div className="space-y-6">
      {/* Xtreme API */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          🔑 Xtreme API
        </h4>
        <p className="mt-1 text-xs text-slate-500">
          Use in IPTV Smarters, TiviMate, OTT Navigator, Smart IPTV.
        </p>
        <div className="mt-3 space-y-2">
          <CopyRow label="Host / Portal URL" value={host} />
          <CopyRow label="Username" value={creds.xtremeUsername || ""} />
          <CopyRow label="Password" value={creds.xtremePassword || ""} />
        </div>
      </div>

      {/* M3U URLs */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          📺 M3U Playlists
        </h4>
        <p className="mt-1 text-xs text-slate-500">
          Paste a URL into any IPTV app, or watch in-browser.
        </p>
        <div className="mt-3 space-y-2">
          <M3URow
            icon="🔥"
            label="Hot Channels"
            url={urls.hotChannels}
            accent="text-orange-400"
          />
          <M3URow
            icon="📡"
            label="Live TV"
            url={urls.liveTV}
            accent="text-blue-400"
          />
          <M3URow
            icon="🎬"
            label="Movies"
            url={urls.movies}
            accent="text-red-400"
          />
          <M3URow
            icon="📺"
            label="Series"
            url={urls.series}
            accent="text-cyan-400"
          />
        </div>
      </div>

      {creds.channelName && (
        <p className="text-xs text-slate-500">
          Your custom channel name:{" "}
          <span className="font-mono text-slate-300">{creds.channelName}</span>
        </p>
      )}
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="break-all font-mono text-xs text-slate-200">{value}</p>
      </div>
      <button
        onClick={copy}
        className="flex-shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
      >
        {copied ? "✓ Copied" : "Copy"}
      </button>
    </div>
  );
}

function M3URow({
  icon,
  label,
  url,
  accent,
}: {
  icon: string;
  label: string;
  url: string;
  accent: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  const web = buildWebPlayerUrl(url);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className={`text-sm font-semibold ${accent}`}>{label}</span>
      </div>
      <p className="mt-1 break-all font-mono text-[11px] text-slate-400">
        {url}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          onClick={copy}
          className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500"
        >
          {copied ? "✓ Copied" : "Copy URL"}
        </button>
        <a
          href={web}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-purple-600 px-3 py-1 text-xs font-semibold text-white hover:bg-purple-500"
        >
          ▶ Watch in Browser
        </a>
      </div>
    </div>
  );
}

function SetupGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/50">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-white">
          📱 How to watch (app setup)
        </span>
        <span className="text-slate-400">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-800 px-4 py-4 text-xs text-slate-300">
          <div>
            <p className="font-semibold text-white">IPTV Smarters / TiviMate</p>
            <ol className="ml-4 mt-1 list-decimal space-y-1 text-slate-400">
              <li>Install the app on your device</li>
              <li>Add a new playlist / source → choose &quot;Xtreme API&quot;</li>
              <li>
                Paste the <strong>Host</strong>, <strong>Username</strong>, and{" "}
                <strong>Password</strong> from above
              </li>
              <li>Save → channels, movies, and series load automatically</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold text-white">Any M3U player</p>
            <p className="mt-1 text-slate-400">
              Copy any M3U URL above and paste it into your player&apos;s
              &quot;Add M3U URL&quot; field.
            </p>
          </div>
          <div>
            <p className="font-semibold text-white">Watch in Browser</p>
            <p className="mt-1 text-slate-400">
              No app needed — click the purple &quot;Watch in Browser&quot;
              button on any category.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------- Balance card -------- */

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
