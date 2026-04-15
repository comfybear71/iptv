"use client";

import { useCallback, useEffect, useState } from "react";
import {
  buildHotChannelsUrl,
  buildMyBunnyM3uUrls,
  buildWebPlayerUrl,
  DEFAULT_XTREME_HOST,
} from "@/lib/mybunny";
import { useFavorites } from "@/hooks/useFavorites";
import { SubscriptionCredentials } from "@/types";

interface Subscription {
  _id: string;
  status: string;
  credentials?: SubscriptionCredentials;
}

interface XtreamStream {
  stream_id: number;
  name: string;
  stream_icon: string;
  category_id: string;
  epg_channel_id: string | null;
  /** Direct playback URL from MyBunny's M3U — used AS-IS */
  url?: string;
}

interface StreamsResponse {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  streams: XtreamStream[];
}

export default function BrowseChannelsPage() {
  const { favorites, toggle: toggleFavorite } = useFavorites();

  const [subs, setSubs] = useState<Subscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [streamsData, setStreamsData] = useState<StreamsResponse | null>(null);
  const [streamsLoading, setStreamsLoading] = useState(false);
  const [streamsError, setStreamsError] = useState("");

  // Initial load: subscription + personal M3U URL
  useEffect(() => {
    (async () => {
      try {
        const [subsRes, prefsRes] = await Promise.all([
          fetch("/api/subscriptions"),
          fetch("/api/me/channel-prefs"),
        ]);
        const subsData = await subsRes.json().catch(() => ({}));
        const prefsData = await prefsRes.json().catch(() => ({}));
        setSubs(subsData.subscriptions || []);
        if (typeof prefsData.playlistUrl === "string") {
          setPlaylistUrl(prefsData.playlistUrl);
        }
      } finally {
        setSubsLoading(false);
      }
    })();
  }, []);

  const active = subs.find((s) => s.status === "active");
  const creds = active?.credentials;
  const host = creds?.xtremeHost || DEFAULT_XTREME_HOST;
  const hasCreds = !!(creds?.xtremeUsername && creds?.xtremePassword);

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

  // Load channels — no category filter, ever. Just search + pagination.
  const loadStreams = useCallback(
    async (opts: { page: number; search: string }) => {
      setStreamsLoading(true);
      setStreamsError("");
      try {
        const params = new URLSearchParams();
        if (opts.search) params.set("search", opts.search);
        params.set("page", String(opts.page));

        const res = await fetch(`/api/channels/streams?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setStreamsData(data);
      } catch (err: unknown) {
        setStreamsError(
          err instanceof Error ? err.message : "Failed to load channels"
        );
        setStreamsData(null);
      } finally {
        setStreamsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!hasCreds) return;
    loadStreams({ page, search });
  }, [hasCreds, page, search, loadStreams]);

  const copyPlaylistUrl = async () => {
    if (!playlistUrl) return;
    try {
      await navigator.clipboard.writeText(playlistUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600/20 text-2xl">
          📺
        </span>
        <div>
          <h1 className="text-2xl font-bold text-white">Browse Channels</h1>
          <p className="text-sm text-slate-400">
            All your channels in one place. Search, tap the heart to favourite,
            tap ▶ to watch.
          </p>
        </div>
      </div>

      {subsLoading ? (
        <div className="mt-8 text-center text-slate-400">Loading...</div>
      ) : !hasCreds ? (
        <div className="mt-6 rounded-2xl border border-amber-800 bg-amber-900/20 p-6 text-center">
          <h2 className="text-lg font-bold text-white">
            Subscribe to access channels
          </h2>
          <p className="mt-2 text-sm text-amber-200">
            Pick a plan and pay to get your credentials, then come back here to
            browse.
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
          {/* Quick-watch tiles */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QuickWatchCard
              icon="🔥"
              label="Hot Channels"
              sub="Most-watched right now"
              color="bg-orange-600/20 text-orange-400"
              webUrl={buildWebPlayerUrl(hotUrl)}
            />
            <QuickWatchCard
              icon="📡"
              label="Full Live TV"
              sub="Complete live playlist"
              color="bg-blue-600/20 text-blue-400"
              webUrl={buildWebPlayerUrl(m3uUrls.liveTV)}
            />
            <QuickWatchCard
              icon="🎬"
              label="Movies"
              sub="On-demand films"
              color="bg-red-600/20 text-red-400"
              browse="/dashboard/movies"
            />
            <QuickWatchCard
              icon="🎞️"
              label="TV Series"
              sub="On-demand shows"
              color="bg-cyan-600/20 text-cyan-400"
              browse="/dashboard/series"
            />
          </div>

          {/* My Playlist URL (reflects your ♥ favourites automatically) */}
          <section className="mt-6 overflow-hidden rounded-2xl border border-emerald-800 bg-emerald-900/10 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
              My Playlist URL
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Paste this into TiviMate / IPTV Smarters / OTT Navigator.
              Your ♥ favourites appear at the top under <strong>⭐ Favorites</strong>.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href={buildWebPlayerUrl(playlistUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white ${
                  playlistUrl
                    ? "bg-purple-600 hover:bg-purple-500"
                    : "cursor-not-allowed bg-slate-800 opacity-50"
                }`}
                onClick={(e) => {
                  if (!playlistUrl) e.preventDefault();
                }}
              >
                ▶ Watch
              </a>
              <button
                onClick={copyPlaylistUrl}
                disabled={!playlistUrl}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
              >
                {copied ? "✓ Copied" : "📋 Copy URL"}
              </button>
            </div>
            <code className="mt-2 block w-full overflow-hidden break-all rounded-md bg-slate-950 px-3 py-2 font-mono text-[11px] text-slate-400">
              {playlistUrl || "(loading…)"}
            </code>
          </section>

          {/* Search + Channels list */}
          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search channel name (e.g. CNN, Fox, Seven)"
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="mt-3 text-xs text-slate-500">
              {streamsLoading
                ? "Loading channels…"
                : streamsData
                  ? `${streamsData.total.toLocaleString()} channels · page ${streamsData.page} / ${streamsData.totalPages}`
                  : ""}
            </div>

            {streamsError && (
              <div className="mt-3 rounded-lg border border-red-800 bg-red-900/30 p-3 text-xs text-red-300">
                {streamsError}
              </div>
            )}

            {streamsData &&
              streamsData.streams.length === 0 &&
              !streamsLoading && (
                <div className="mt-6 text-center text-sm text-slate-500">
                  No channels match that search.
                </div>
              )}

            {streamsData && streamsData.streams.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {streamsData.streams.map((stream) => (
                  <ChannelCard
                    key={stream.stream_id}
                    stream={stream}
                    host={host}
                    username={creds!.xtremeUsername!}
                    password={creds!.xtremePassword!}
                    isFavorite={favorites.has(stream.stream_id)}
                    onToggleFavorite={() => toggleFavorite(stream.stream_id)}
                  />
                ))}
              </div>
            )}

            {streamsData && streamsData.totalPages > 1 && (
              <div className="mt-5 flex items-center justify-between text-xs">
                <button
                  disabled={page <= 1 || streamsLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                >
                  ← Prev
                </button>
                <span className="text-slate-500">
                  Page {page} of {streamsData.totalPages}
                </span>
                <button
                  disabled={page >= streamsData.totalPages || streamsLoading}
                  onClick={() =>
                    setPage((p) => Math.min(streamsData.totalPages, p + 1))
                  }
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            )}
          </section>

          {/* Footer note */}
          <div className="mt-6 rounded-xl border border-blue-800 bg-blue-900/20 p-4 text-xs text-slate-300">
            <strong>💡 Tip:</strong> Tap the ♥ on any channel to pin it. The
            full setup guide is under <strong>How to Watch</strong> in the side
            menu.
          </div>
        </>
      )}
    </div>
  );
}

function QuickWatchCard({
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
  webUrl?: string;
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
      <div className="mt-3">
        {browse ? (
          <a
            href={browse}
            className="block rounded-md bg-purple-600 px-2 py-1.5 text-center text-xs font-medium text-white hover:bg-purple-500"
          >
            Browse
          </a>
        ) : webUrl ? (
          <a
            href={webUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-md bg-purple-600 px-2 py-1.5 text-center text-xs font-medium text-white hover:bg-purple-500"
          >
            ▶ Watch
          </a>
        ) : null}
      </div>
    </div>
  );
}

function ChannelCard({
  stream,
  host,
  username,
  password,
  isFavorite,
  onToggleFavorite,
}: {
  stream: XtreamStream;
  host: string;
  username: string;
  password: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const streamUrl =
    stream.url ||
    `${host.replace(/\/$/, "")}/live/${encodeURIComponent(
      username
    )}/${encodeURIComponent(password)}/${stream.stream_id}.m3u8`;
  const playerUrl = buildWebPlayerUrl(streamUrl);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-900">
        {stream.stream_icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={stream.stream_icon}
            alt={stream.name}
            className="h-full w-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <span className="text-xl">📺</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">
          {stream.name}
        </div>
        {stream.epg_channel_id && (
          <div className="truncate text-[10px] text-slate-500">
            EPG: {stream.epg_channel_id}
          </div>
        )}
      </div>
      <button
        onClick={onToggleFavorite}
        title={isFavorite ? "Remove from favourites" : "Add to favourites"}
        className={`flex-shrink-0 rounded-md px-2 py-1.5 text-base leading-none transition ${
          isFavorite
            ? "bg-rose-600/20 text-rose-400 hover:bg-rose-600/30"
            : "bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-rose-400"
        }`}
      >
        {isFavorite ? "♥" : "♡"}
      </button>
      <a
        href={playerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500"
      >
        ▶
      </a>
    </div>
  );
}
