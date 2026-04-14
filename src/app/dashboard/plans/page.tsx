"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PLANS, SubscriptionCredentials } from "@/types";
import {
  buildMyBunnyM3uUrls,
  buildWebPlayerUrl,
  DEFAULT_XTREME_HOST,
} from "@/lib/mybunny";

interface Subscription {
  _id: string;
  plan: string;
  connections: number;
  status: "active" | "expired" | "cancelled";
  startDate: string;
  endDate: string;
  credentials?: SubscriptionCredentials;
}

export default function MyPlansPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/subscriptions")
      .then((r) => r.json())
      .then((d) => {
        setSubs(d.subscriptions || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold text-white">My Plans</h1>
        <Link
          href="/dashboard/order"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          + Order New Plan
        </Link>
      </div>

      {loading ? (
        <div className="mt-10 text-center text-slate-400">Loading...</div>
      ) : subs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {subs.map((sub) => (
            <PlanCard key={sub._id} sub={sub} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/30 p-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-600/20 text-3xl">
        📺
      </div>
      <h2 className="mt-4 text-xl font-bold text-white">
        Ready to start streaming?
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        Pick a plan, pay with crypto, and get instant access to thousands of
        channels.
      </p>
      <Link
        href="/dashboard/order"
        className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
      >
        Choose a Plan
      </Link>
    </div>
  );
}

function PlanCard({ sub }: { sub: Subscription }) {
  const planInfo = PLANS.find((p) => p.id === sub.plan);
  const planName = planInfo?.name || sub.plan;
  const endDate = new Date(sub.endDate);
  const now = new Date();
  const daysLeft = Math.ceil(
    (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  const isExpired = sub.status === "expired" || daysLeft <= 0;
  const isCancelled = sub.status === "cancelled";

  const headerColor = {
    lite: "from-emerald-600 to-teal-700",
    family: "from-blue-600 to-indigo-700",
    premium: "from-purple-600 to-fuchsia-700",
    titan: "from-amber-600 via-orange-700 to-red-700",
  }[sub.plan as "lite" | "family" | "premium" | "titan"] ||
  "from-slate-700 to-slate-800";

  const credsHost = sub.credentials?.xtremeHost || DEFAULT_XTREME_HOST;
  const credsUser = sub.credentials?.xtremeUsername;
  const credsPass = sub.credentials?.xtremePassword;
  const hasCreds = !!(credsUser && credsPass);

  const m3uUrls = buildMyBunnyM3uUrls(
    credsHost,
    credsUser,
    credsPass,
    sub.credentials?.collectionSize || 2
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
      {/* Header */}
      <div
        className={`relative bg-gradient-to-br ${headerColor} px-5 py-4 ${isExpired || isCancelled ? "opacity-60" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📺</span>
              <h3 className="text-xl font-bold text-white">{planName}</h3>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  isCancelled
                    ? "bg-red-300"
                    : isExpired
                      ? "bg-slate-400"
                      : "bg-green-300"
                }`}
              />
              <span className="text-xs font-semibold uppercase tracking-wide text-white/90">
                {isCancelled ? "Cancelled" : isExpired ? "Expired" : "Active"}
              </span>
            </div>
          </div>
          <div className="rounded-lg bg-white/15 px-3 py-2 text-right backdrop-blur-sm">
            <div className="text-[10px] uppercase tracking-widest text-white/70">
              {isExpired ? "Expired" : "Expires"}
            </div>
            <div className="text-sm font-semibold text-white">
              {endDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            <div className="text-[10px] text-white/70">
              {isExpired ? "Renew" : `${daysLeft}d left`}
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-sm text-white/90">
          <span>🖥️</span>
          {sub.connections} {sub.connections === 1 ? "device" : "devices"}
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {isExpired ? (
          <Link
            href={`/dashboard/order?plan=${sub.plan}`}
            className="block w-full rounded-lg bg-red-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-red-500"
          >
            ⏱ Renew Plan
          </Link>
        ) : (
          <Link
            href={`/dashboard/order?plan=${sub.plan}`}
            className="block w-full rounded-lg border border-slate-700 px-4 py-2 text-center text-sm text-slate-200 hover:border-slate-600 hover:bg-slate-800"
          >
            ⏱ Extend Plan
          </Link>
        )}

        {hasCreds && (
          <>
            <CollapsibleCredentials
              host={credsHost}
              username={credsUser!}
              password={credsPass!}
            />

            <div className="mt-4 space-y-2">
              <ContentRow
                icon="🔥"
                color="text-orange-400"
                label="Hot Channels"
                browseHref="/dashboard/channels"
                watchUrl={buildWebPlayerUrl(m3uUrls.hotChannels)}
              />
              <ContentRow
                icon="📡"
                color="text-blue-400"
                label="Live Channels"
                browseHref="/dashboard/channels"
                watchUrl={buildWebPlayerUrl(m3uUrls.liveTV)}
              />
              <ContentRow
                icon="🎬"
                color="text-red-400"
                label="VOD Movies"
                browseHref="/dashboard/movies"
                watchUrl={buildWebPlayerUrl(m3uUrls.movies)}
              />
              <ContentRow
                icon="🎞️"
                color="text-cyan-400"
                label="TV Series"
                browseHref="/dashboard/series"
                watchUrl={buildWebPlayerUrl(m3uUrls.series)}
              />
            </div>
          </>
        )}

        {!hasCreds && !isExpired && (
          <div className="mt-4 rounded-lg border border-amber-800 bg-amber-900/20 p-3 text-center text-xs text-amber-300">
            Credentials being provisioned. You&apos;ll receive an email shortly.
          </div>
        )}
      </div>
    </div>
  );
}

function CollapsibleCredentials({
  host,
  username,
  password,
}: {
  host: string;
  username: string;
  password: string;
}) {
  const [open, setOpen] = useState(true);
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
          🔓 Login Credentials
        </span>
        <span className="text-slate-500">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-slate-800 px-3 py-3">
          <CopyRow label="Host" value={host} />
          <CopyRow label="Username" value={username} mono />
          <CopyRow
            label="Password"
            value={showPass ? password : "•".repeat(password.length)}
            mono
            extra={
              <button
                onClick={() => setShowPass(!showPass)}
                className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                title={showPass ? "Hide" : "Show"}
              >
                {showPass ? "🙈" : "👁"}
              </button>
            }
            copyValue={password}
          />
        </div>
      )}
    </div>
  );
}

function CopyRow({
  label,
  value,
  mono,
  extra,
  copyValue,
}: {
  label: string;
  value: string;
  mono?: boolean;
  extra?: React.ReactNode;
  copyValue?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyValue || value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-[90px] items-center gap-1 text-xs text-slate-400">
        {label === "Host" && "🌐"}
        {label === "Username" && "👤"}
        {label === "Password" && "🔑"}
        {label}
      </div>
      <div
        className={`min-w-0 flex-1 truncate text-xs text-slate-200 ${mono ? "font-mono" : ""}`}
      >
        {value}
      </div>
      {extra}
      <button
        onClick={copy}
        className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-blue-400"
        title="Copy"
      >
        {copied ? "✓" : "📋"}
      </button>
    </div>
  );
}

function ContentRow({
  icon,
  color,
  label,
  browseHref,
  watchUrl,
}: {
  icon: string;
  color: string;
  label: string;
  browseHref: string;
  watchUrl: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
      <div className={`text-xs font-semibold ${color}`}>
        {icon} {label}
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <Link
          href={browseHref}
          className="rounded-md bg-slate-800 px-2 py-1.5 text-center text-xs font-medium text-slate-200 hover:bg-slate-700"
        >
          Browse
        </Link>
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-slate-700 px-2 py-1.5 text-center text-xs font-medium text-slate-200 hover:bg-slate-800"
        >
          ▶ Watch
        </a>
      </div>
    </div>
  );
}
