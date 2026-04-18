"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  buildFilteredSeriesUrl,
  buildWebPlayerUrl,
  COLLECTION_SIZES,
  CollectionSize,
  DEFAULT_XTREME_HOST,
  SERIES_GENRES,
  VOD_YEARS,
} from "@/lib/mybunny";
import { SubscriptionCredentials } from "@/types";

interface Subscription {
  _id: string;
  status: string;
  credentials?: SubscriptionCredentials;
}

interface LatestSeries {
  seriesId: number;
  name: string;
  year: number | null;
  cover: string;
  rating: number;
  genre: string;
}

interface GridSeries {
  seriesId: number;
  name: string;
  year: number | null;
  cover: string | null;
  rating: number;
  genre: string;
}

interface SeriesGridResponse {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  series: GridSeries[];
}

export default function VodSeriesPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<string>("All");
  const [genre, setGenre] = useState<string>("All");
  const [size, setSize] = useState<CollectionSize>(2);

  const [latest, setLatest] = useState<LatestSeries[]>([]);
  const [latestLoading, setLatestLoading] = useState(true);

  const [gridPage, setGridPage] = useState(1);
  const [grid, setGrid] = useState<SeriesGridResponse | null>(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [gridError, setGridError] = useState("");

  useEffect(() => {
    fetch("/api/subscriptions")
      .then((r) => r.json())
      .then((d) => {
        setSubs(d.subscriptions || []);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/vod/series/latest?limit=12", {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data.series)) setLatest(data.series);
      } finally {
        setLatestLoading(false);
      }
    })();
  }, []);

  const loadGrid = useCallback(
    async (opts: { page: number; year: string; genre: string }) => {
      setGridLoading(true);
      setGridError("");
      try {
        const params = new URLSearchParams();
        params.set("page", String(opts.page));
        if (opts.year && opts.year !== "All") params.set("year", opts.year);
        if (opts.genre && opts.genre !== "All") params.set("genre", opts.genre);
        const res = await fetch(`/api/vod/series?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setGrid(data as SeriesGridResponse);
      } catch (err: unknown) {
        setGridError(err instanceof Error ? err.message : "Failed to load");
        setGrid(null);
      } finally {
        setGridLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadGrid({ page: gridPage, year, genre });
  }, [gridPage, year, genre, loadGrid]);

  useEffect(() => {
    setGridPage(1);
  }, [year, genre]);

  const active = subs.find((s) => s.status === "active");
  const creds = active?.credentials;
  const host = creds?.xtremeHost || DEFAULT_XTREME_HOST;
  const m3uUrl = buildFilteredSeriesUrl({
    host,
    username: creds?.xtremeUsername,
    password: creds?.xtremePassword,
    size,
    year,
    genre,
  });
  const webUrl = buildWebPlayerUrl(m3uUrl);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-400">
        Loading...
      </div>
    );
  }

  if (!creds || !creds.xtremeUsername || !creds.xtremePassword) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cyan-600/20 text-3xl">
          🔒
        </div>
        <h1 className="mt-4 text-xl font-bold text-white">
          Subscribe to access TV Series
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          You need an active subscription with provisioned credentials.
        </p>
        <a
          href="/dashboard/order"
          className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Order a Plan →
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600/20 text-2xl">
          🎞️
        </span>
        <div>
          <h1 className="text-2xl font-bold text-white">VOD Series</h1>
          <p className="text-sm text-slate-400">
            Browse the latest, filter by year or genre, click to watch — or copy
            the M3U URL for your TV app.
          </p>
        </div>
      </div>

      {/* Latest row */}
      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          🎞️ Latest Added
        </h2>
        {latestLoading ? (
          <div className="mt-3 text-xs text-slate-500">Loading latest…</div>
        ) : latest.length === 0 ? (
          <div className="mt-3 text-xs text-slate-500">No latest yet.</div>
        ) : (
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
            {latest.map((s) => (
              <div
                key={s.seriesId}
                className="w-36 flex-shrink-0 sm:w-40 lg:w-44"
              >
                <PosterCard
                  href={`/watch/series/${s.seriesId}`}
                  title={s.name}
                  year={s.year}
                  rating={s.rating}
                  poster={s.cover}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-4">
        <p className="mb-2 text-xs text-slate-400">
          Using TiviMate / IPTV Smarters / VLC? Copy this filtered M3U URL.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={webUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"
          >
            ▶ Watch (webplayer)
          </a>
          <CopyButton value={m3uUrl} />
        </div>
        <code className="mt-2 block w-full break-all font-mono text-[11px] text-slate-400">
          {m3uUrl}
        </code>
      </div>

      <div className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          📅 Filter by Year
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {VOD_YEARS.map((y) => (
            <Chip key={y} label={y} active={year === y} onClick={() => setYear(y)} />
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          🏷 Filter by Genre
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {SERIES_GENRES.map((g) => (
            <Chip
              key={g}
              label={g}
              active={genre === g}
              onClick={() => setGenre(g)}
            />
          ))}
        </div>
      </div>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            🔍 Results
          </h3>
          <div className="text-xs text-slate-500">
            {gridLoading
              ? "Loading…"
              : grid
                ? `${grid.total.toLocaleString()} series · page ${grid.page} / ${grid.totalPages}`
                : ""}
          </div>
        </div>

        {gridError && (
          <div className="mt-3 rounded-lg border border-red-800 bg-red-900/30 p-3 text-xs text-red-300">
            {gridError}
          </div>
        )}

        {grid && grid.series.length === 0 && !gridLoading && (
          <div className="mt-6 text-center text-sm text-slate-500">
            No series match these filters.
          </div>
        )}

        {grid && grid.series.length > 0 && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {grid.series.map((s) => (
                <PosterCard
                  key={s.seriesId}
                  href={`/watch/series/${s.seriesId}`}
                  title={s.name}
                  year={s.year}
                  rating={s.rating}
                  poster={s.cover}
                />
              ))}
            </div>

            {grid.totalPages > 1 && (
              <div className="mt-5 flex items-center justify-between text-xs">
                <button
                  disabled={grid.page <= 1 || gridLoading}
                  onClick={() => setGridPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                >
                  ← Prev
                </button>
                <span className="text-slate-500">
                  Page {grid.page} of {grid.totalPages}
                </span>
                <button
                  disabled={grid.page >= grid.totalPages || gridLoading}
                  onClick={() =>
                    setGridPage((p) => Math.min(grid.totalPages, p + 1))
                  }
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <div className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          📦 M3U Collection Size (for TiviMate export only)
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {COLLECTION_SIZES.map((s) => (
            <button
              key={s.value}
              onClick={() => setSize(s.value)}
              className={`rounded-xl border px-3 py-3 text-center transition ${
                size === s.value
                  ? "border-blue-500 bg-blue-900/30"
                  : "border-slate-800 bg-slate-900 hover:border-slate-700"
              }`}
            >
              <div className="text-sm font-bold text-white">{s.label}</div>
              <div className="mt-0.5 text-[11px] text-slate-400">
                {s.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PosterCard({
  href,
  title,
  year,
  rating,
  poster,
}: {
  href: string;
  title: string;
  year: number | null;
  rating: number;
  poster: string | null;
}) {
  return (
    <Link
      href={href}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 transition hover:border-slate-600"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-slate-950">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt={title}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl text-slate-700">
            🎞️
          </div>
        )}
        {rating > 0 && (
          <span className="absolute right-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur-sm">
            ⭐ {rating.toFixed(1)}
          </span>
        )}
      </div>
      <div className="p-2">
        <div className="truncate text-xs font-semibold text-white" title={title}>
          {title}
        </div>
        {year && <div className="text-[10px] text-slate-500">{year}</div>}
      </div>
    </Link>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        active
          ? "border-blue-500 bg-blue-600 text-white"
          : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600"
      }`}
    >
      {label}
    </button>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700"
    >
      {copied ? "✓ Copied" : "📋 Copy URL"}
    </button>
  );
}
