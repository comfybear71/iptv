"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildWebPlayerUrl, DEFAULT_XTREME_HOST } from "@/lib/mybunny";
import {
  SPORTS,
  SportDef,
  filterStreamsForSport,
  StreamForFilter,
  CategoryForFilter,
} from "@/lib/sports";
import { SubscriptionCredentials } from "@/types";

interface Subscription {
  _id: string;
  status: string;
  credentials?: SubscriptionCredentials;
}

export default function SportsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);

  const [categories, setCategories] = useState<CategoryForFilter[]>([]);
  const [allStreams, setAllStreams] = useState<StreamForFilter[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");

  const [activeSport, setActiveSport] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Initial load — subscription + categories
  useEffect(() => {
    (async () => {
      try {
        const [subsRes, catsRes] = await Promise.all([
          fetch("/api/subscriptions"),
          fetch("/api/channels/categories"),
        ]);
        const subsData = await subsRes.json().catch(() => ({}));
        const catsData = await catsRes.json().catch(() => ({}));
        setSubs(subsData.subscriptions || []);
        if (Array.isArray(catsData.categories)) {
          setCategories(catsData.categories);
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

  // Lazy-load ALL streams once when a sport is first picked. The /api/channels/streams
  // endpoint is paginated — we ask for a huge page so we get the full set in one call.
  // 22k channels × ~200 bytes JSON ≈ 4-5MB, loads in a few seconds, then filtering is instant.
  const loadAllStreams = useCallback(async () => {
    if (allStreams.length > 0 || !hasCreds) return;
    setDataLoading(true);
    setDataError("");
    try {
      // Paginate through until we've got everything. 80 per page default.
      let page = 1;
      const collected: StreamForFilter[] = [];
      while (true) {
        const res = await fetch(`/api/channels/streams?page=${page}`);
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        collected.push(...(data.streams || []));
        if (page >= data.totalPages || data.streams.length === 0) break;
        page += 1;
        // Safety guard — bail out if panel is somehow returning >300 pages (~24k)
        if (page > 400) break;
      }
      setAllStreams(collected);
    } catch (err: any) {
      setDataError(err?.message || "Failed to load channels");
    } finally {
      setDataLoading(false);
    }
  }, [hasCreds, allStreams.length]);

  // Matches for the active sport
  const sportDef: SportDef | null = useMemo(
    () => SPORTS.find((s) => s.id === activeSport) || null,
    [activeSport]
  );

  const matches = useMemo(() => {
    if (!sportDef || allStreams.length === 0) return [];
    const full = filterStreamsForSport(sportDef, allStreams, categories);
    if (!search.trim()) return full;
    const q = search.trim().toLowerCase();
    return full.filter((s) => s.name.toLowerCase().includes(q));
  }, [sportDef, allStreams, categories, search]);

  const pickSport = (id: string) => {
    setActiveSport(id);
    setSearch("");
    loadAllStreams(); // fire once; cached after
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600/20 text-2xl">
          🏆
        </span>
        <div>
          <h1 className="text-2xl font-bold text-white">Sports</h1>
          <p className="text-sm text-slate-400">
            Pick a sport to see the channels that carry it.
          </p>
        </div>
      </div>

      {subsLoading ? (
        <div className="mt-8 text-center text-slate-400">Loading...</div>
      ) : !hasCreds ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-amber-800 bg-amber-900/20 p-6 text-center">
          <h2 className="text-lg font-bold text-white">
            Subscribe first to watch sports
          </h2>
          <p className="mt-2 text-sm text-amber-200">
            Pick a plan and we&apos;ll unlock the sports channel browser.
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
          {/* Sport tiles */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {SPORTS.map((sport) => {
              const on = activeSport === sport.id;
              return (
                <button
                  key={sport.id}
                  onClick={() => pickSport(sport.id)}
                  className={`overflow-hidden rounded-2xl border p-4 text-left transition ${
                    on
                      ? "border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/40"
                      : "border-slate-800 bg-slate-900 hover:border-slate-700"
                  }`}
                >
                  <div
                    className={`mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-2xl text-white ${sport.accent}`}
                  >
                    {sport.emoji}
                  </div>
                  <div className="text-sm font-bold text-white">
                    {sport.label}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {sport.blurb}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Match list */}
          {sportDef && (
            <section className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white">
                    {sportDef.emoji} {sportDef.label} channels
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {dataLoading
                      ? "Loading channel list…"
                      : `${matches.length.toLocaleString()} channels found`}
                  </p>
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search these results…"
                  className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {dataError && (
                <div className="mt-4 rounded-lg border border-red-800 bg-red-900/30 p-3 text-xs text-red-300">
                  {dataError}
                </div>
              )}

              {!dataLoading && matches.length === 0 && !dataError && (
                <div className="mt-6 text-center text-sm text-slate-500">
                  No channels matched. Try a different sport or check back
                  during broadcast hours (PPV channels often light up only
                  around event time).
                </div>
              )}

              {matches.length > 0 && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {matches.slice(0, 150).map((stream) => (
                    <ChannelTile
                      key={stream.stream_id}
                      stream={stream}
                      host={host}
                      username={creds!.xtremeUsername!}
                      password={creds!.xtremePassword!}
                    />
                  ))}
                </div>
              )}

              {matches.length > 150 && (
                <div className="mt-4 text-center text-[11px] text-slate-500">
                  Showing the first 150 matches. Use search to narrow down.
                </div>
              )}
            </section>
          )}

          {!sportDef && (
            <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/50 p-5 text-xs text-slate-400">
              👆 Tap a sport above to see the channels that carry it.
              First-time load of the channel list takes a few seconds —
              after that switching sports is instant.
            </div>
          )}

          {/* Phase 2 teaser */}
          <div className="mt-8 rounded-xl border border-blue-800 bg-blue-900/20 p-4 text-xs text-slate-300">
            <strong>🗓️ Upcoming events calendar — coming soon.</strong> We&apos;ll
            add a live schedule of AFL fixtures, UFC PPVs, and Premier League
            games so you can plan ahead. For now, this page shows every
            channel that carries the sport.
          </div>
        </>
      )}
    </div>
  );
}

function ChannelTile({
  stream,
  host,
  username,
  password,
}: {
  stream: StreamForFilter;
  host: string;
  username: string;
  password: string;
}) {
  const streamUrl = `${host.replace(/\/$/, "")}/live/${encodeURIComponent(
    username
  )}/${encodeURIComponent(password)}/${stream.stream_id}.m3u8`;
  const playerUrl = buildWebPlayerUrl(streamUrl);

  return (
    <div className="flex items-center gap-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3">
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
          <span className="text-xl">🏆</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">
          {stream.name}
        </div>
        {stream.epg_channel_id && (
          <div className="truncate text-[10px] text-slate-500">
            {stream.epg_channel_id}
          </div>
        )}
      </div>
      <a
        href={playerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
      >
        ▶
      </a>
    </div>
  );
}
