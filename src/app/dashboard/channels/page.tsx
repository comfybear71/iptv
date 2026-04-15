"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildHotChannelsUrl,
  buildMyBunnyM3uUrls,
  buildWebPlayerUrl,
  DEFAULT_XTREME_HOST,
} from "@/lib/mybunny";
import { SubscriptionCredentials } from "@/types";

interface Subscription {
  _id: string;
  status: string;
  credentials?: SubscriptionCredentials;
}

interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

interface XtreamStream {
  stream_id: number;
  name: string;
  stream_icon: string;
  category_id: string;
  epg_channel_id: string | null;
}

interface StreamsResponse {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  streams: XtreamStream[];
}

export default function BrowseChannelsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);

  const [categories, setCategories] = useState<XtreamCategory[]>([]);
  const [enabledCategoryIds, setEnabledCategoryIds] = useState<string[]>([]);
  const [prefsDirty, setPrefsDirty] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [streamsData, setStreamsData] = useState<StreamsResponse | null>(null);
  const [streamsLoading, setStreamsLoading] = useState(false);
  const [streamsError, setStreamsError] = useState("");

  // -- Load subscription + categories + saved prefs on mount --
  useEffect(() => {
    (async () => {
      try {
        const [subsRes, catsRes, prefsRes] = await Promise.all([
          fetch("/api/subscriptions"),
          fetch("/api/channels/categories"),
          fetch("/api/me/channel-prefs"),
        ]);
        const subsData = await subsRes.json().catch(() => ({}));
        const catsData = await catsRes.json().catch(() => ({}));
        const prefsData = await prefsRes.json().catch(() => ({}));

        setSubs(subsData.subscriptions || []);
        if (Array.isArray(catsData.categories)) {
          setCategories(catsData.categories);
        }
        if (Array.isArray(prefsData.enabledCategoryIds)) {
          setEnabledCategoryIds(prefsData.enabledCategoryIds);
        }
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

  // -- Load streams when filters change --
  const loadStreams = useCallback(
    async (opts: { page: number; search: string; categoryIds: string[] }) => {
      setStreamsLoading(true);
      setStreamsError("");
      try {
        const params = new URLSearchParams();
        if (opts.categoryIds.length > 0) {
          params.set("category_ids", opts.categoryIds.join(","));
        }
        if (opts.search) params.set("search", opts.search);
        params.set("page", String(opts.page));

        const res = await fetch(`/api/channels/streams?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setStreamsData(data);
      } catch (err: any) {
        setStreamsError(err?.message || "Failed to load channels");
        setStreamsData(null);
      } finally {
        setStreamsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!hasCreds) return;
    loadStreams({ page, search, categoryIds: enabledCategoryIds });
  }, [hasCreds, page, search, enabledCategoryIds, loadStreams]);

  // -- Category toggle helpers --
  const toggleCategory = (id: string) => {
    setEnabledCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setPrefsDirty(true);
    setPage(1);
  };

  const clearCategories = () => {
    setEnabledCategoryIds([]);
    setPrefsDirty(true);
    setPage(1);
  };

  const savePrefs = async () => {
    setSavingPrefs(true);
    try {
      const res = await fetch("/api/me/channel-prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledCategoryIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (typeof data.playlistUrl === "string") {
        setPlaylistUrl(data.playlistUrl);
      }
      setPrefsDirty(false);
    } finally {
      setSavingPrefs(false);
    }
  };

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

  // -- Category grouping (by "kind" heuristic — name substring) --
  const groupedCategories = useMemo(() => {
    // Split into "Countries/Regions" vs "Other" heuristically — everything
    // with a flag emoji we detect by category_name length < 30 + capital-leading.
    // Simpler: just sort alphabetically and display as a flat grid.
    return [...categories].sort((a, b) =>
      a.category_name.localeCompare(b.category_name)
    );
  }, [categories]);

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
            Pick the categories you want and search across {" "}
            {categories.length > 0
              ? `${categories.length} categories`
              : "thousands of channels"}
            .
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
              sub="Every MyBunny channel (unfiltered)"
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

          {/* Category picker */}
          <section className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
                  My Channels
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {enabledCategoryIds.length === 0
                    ? "Showing all categories. Tap categories below to narrow down (e.g. US + Australia)."
                    : `Filtered to ${enabledCategoryIds.length} ${
                        enabledCategoryIds.length === 1
                          ? "category"
                          : "categories"
                      }.`}
                </p>
              </div>
              <div className="flex gap-2">
                {enabledCategoryIds.length > 0 && (
                  <button
                    onClick={clearCategories}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    Clear all
                  </button>
                )}
                {prefsDirty && (
                  <button
                    onClick={savePrefs}
                    disabled={savingPrefs}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {savingPrefs ? "Saving..." : "Save selection"}
                  </button>
                )}
              </div>
            </div>

            {categories.length === 0 ? (
              <div className="mt-4 text-sm text-slate-500">
                Loading categories…
              </div>
            ) : (
              <div className="mt-4 grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 md:grid-cols-3">
                {groupedCategories.map((cat) => {
                  const on = enabledCategoryIds.includes(cat.category_id);
                  return (
                    <button
                      key={cat.category_id}
                      onClick={() => toggleCategory(cat.category_id)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition ${
                        on
                          ? "border-emerald-500 bg-emerald-900/30 text-emerald-200"
                          : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <span className="truncate">{cat.category_name}</span>
                      <span
                        className={`ml-2 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border text-[10px] ${
                          on
                            ? "border-emerald-400 bg-emerald-500 text-slate-900"
                            : "border-slate-700"
                        }`}
                      >
                        {on ? "✓" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* My Playlist URL — built from saved categories */}
          <section className="mt-6 overflow-hidden rounded-2xl border border-emerald-800 bg-emerald-900/10 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
              My Playlist URL
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {enabledCategoryIds.length === 0
                ? "Currently includes every channel. Pick categories above to filter."
                : `Only channels in your ${enabledCategoryIds.length} selected ${
                    enabledCategoryIds.length === 1 ? "category" : "categories"
                  }. Updates automatically when you save changes.`}
              {prefsDirty && (
                <>
                  {" "}
                  <strong className="text-amber-300">
                    Save your selection first so the URL reflects it.
                  </strong>
                </>
              )}
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
                ▶ Watch Filtered
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

            <p className="mt-3 text-[11px] text-slate-500">
              Paste this URL into TiviMate / IPTV Smarters / OTT Navigator as
              an <strong>M3U playlist</strong>. It stays at the same URL even
              if you change your category selection later.
            </p>
          </section>

          {/* Search + Streams list */}
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
                  ? `${streamsData.total.toLocaleString()} matching channels · page ${streamsData.page} / ${streamsData.totalPages}`
                  : ""}
            </div>

            {streamsError && (
              <div className="mt-3 rounded-lg border border-red-800 bg-red-900/30 p-3 text-xs text-red-300">
                {streamsError}
              </div>
            )}

            {streamsData && streamsData.streams.length === 0 && !streamsLoading && (
              <div className="mt-6 text-center text-sm text-slate-500">
                No channels match those filters.
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
            <strong>💡 Tip:</strong> ComfyTV provides web previews via
            webplayer.online for quick checks. For full quality with EPG, use
            your M3U credentials in an IPTV app like TiviMate, IPTV Smarters,
            or OTT Navigator.
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
}: {
  stream: XtreamStream;
  host: string;
  username: string;
  password: string;
}) {
  const streamUrl = `${host.replace(/\/$/, "")}/live/${encodeURIComponent(
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
