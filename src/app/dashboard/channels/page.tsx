"use client";

import { useEffect, useState } from "react";
import {
  buildHotChannelsUrl,
  buildMyBunnyM3uUrls,
  buildWebPlayerUrl,
  CHANNEL_CATEGORIES,
  DEFAULT_XTREME_HOST,
} from "@/lib/mybunny";
import { SubscriptionCredentials } from "@/types";

interface Subscription {
  _id: string;
  status: string;
  credentials?: SubscriptionCredentials;
}

export default function BrowseChannelsPage() {
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

  const active = subs.find((s) => s.status === "active");
  const creds = active?.credentials;
  const host = creds?.xtremeHost || DEFAULT_XTREME_HOST;
  const hasCreds = !!(creds?.xtremeUsername && creds?.xtremePassword);

  const totalChannels = CHANNEL_CATEGORIES.reduce((s, c) => s + c.count, 0);

  const m3uUrls = buildMyBunnyM3uUrls(
    host,
    creds?.xtremeUsername,
    creds?.xtremePassword,
    creds?.collectionSize || 2
  );
  const hotUrl = buildHotChannelsUrl(
    host,
    creds?.xtremeUsername,
    creds?.xtremePassword
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600/20 text-2xl">
          📺
        </span>
        <div>
          <h1 className="text-2xl font-bold text-white">Browse Channels</h1>
          <p className="text-sm text-slate-400">
            {totalChannels.toLocaleString()}+ live channels available across{" "}
            {CHANNEL_CATEGORIES.length} categories
          </p>
        </div>
      </div>

      {!hasCreds ? (
        <div className="mt-6 rounded-2xl border border-amber-800 bg-amber-900/20 p-6 text-center">
          <h2 className="text-lg font-bold text-white">
            Subscribe to access channels
          </h2>
          <p className="mt-2 text-sm text-amber-200">
            Pick a plan and pay to get your Xtreme credentials, then come back
            here to start streaming.
          </p>
          <a
            href="/dashboard/order"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Order a Plan →
          </a>
        </div>
      ) : (
        <>
          {/* Quick-watch buttons */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <WatchCard
              icon="🔥"
              label="Hot Channels"
              sub="Most-watched right now"
              color="bg-orange-600/20 text-orange-400"
              webUrl={buildWebPlayerUrl(hotUrl)}
            />
            <WatchCard
              icon="📡"
              label="Live TV"
              sub="All live channels"
              color="bg-blue-600/20 text-blue-400"
              webUrl={buildWebPlayerUrl(m3uUrls.liveTV)}
            />
            <WatchCard
              icon="🎬"
              label="Movies"
              sub="On-demand films"
              color="bg-red-600/20 text-red-400"
              webUrl={buildWebPlayerUrl(m3uUrls.movies)}
              browse="/dashboard/movies"
            />
            <WatchCard
              icon="🎞️"
              label="TV Series"
              sub="On-demand shows"
              color="bg-cyan-600/20 text-cyan-400"
              webUrl={buildWebPlayerUrl(m3uUrls.series)}
              browse="/dashboard/series"
            />
          </div>

          {/* Helpful note */}
          <div className="mt-6 rounded-xl border border-blue-800 bg-blue-900/20 p-4 text-sm text-slate-300">
            <p>
              <strong>📱 Pick channels in your IPTV app.</strong> ComfyTV
              gives you the M3U credentials — the actual channel browser lives
              inside your IPTV Smarters / TiviMate / OTT Navigator app.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Categories below are a preview. The full live list with on/off
              toggles is in MyBunny&apos;s portal:
            </p>
            <a
              href="https://mybunny.tv"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
            >
              Open MyBunny Portal →
            </a>
          </div>

          {/* Categories list */}
          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
              Categories
            </h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {CHANNEL_CATEGORIES.map((cat) => (
                <div
                  key={cat.name}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{cat.flag || "📺"}</span>
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {cat.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {cat.count.toLocaleString()} channels
                      </div>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                    Live
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function WatchCard({
  icon,
  label,
  sub,
  color,
  webUrl,
  browse,
}: {
  icon: string;
  label: string;
  sub: string;
  color: string;
  webUrl: string;
  browse?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${color}`}
      >
        {icon}
      </div>
      <h3 className="mt-3 text-sm font-bold text-white">{label}</h3>
      <p className="text-[11px] text-slate-500">{sub}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {browse ? (
          <a
            href={browse}
            className="rounded-md bg-slate-800 px-2 py-1.5 text-center text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            Browse
          </a>
        ) : (
          <a
            href={webUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-purple-600 px-2 py-1.5 text-center text-xs font-medium text-white hover:bg-purple-500"
          >
            ▶ Watch
          </a>
        )}
        <a
          href={webUrl}
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
