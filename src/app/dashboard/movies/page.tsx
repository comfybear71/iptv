"use client";

import { useEffect, useState } from "react";
import {
  buildFilteredMoviesUrl,
  buildWebPlayerUrl,
  COLLECTION_SIZES,
  CollectionSize,
  DEFAULT_XTREME_HOST,
  MOVIE_GENRES,
  VOD_YEARS,
} from "@/lib/mybunny";
import { SubscriptionCredentials } from "@/types";

interface Subscription {
  _id: string;
  status: string;
  credentials?: SubscriptionCredentials;
}

export default function VodMoviesPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<string>("All");
  const [genre, setGenre] = useState<string>("All");
  const [size, setSize] = useState<CollectionSize>(2);

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
  const url = buildFilteredMoviesUrl({
    host,
    username: creds?.xtremeUsername,
    password: creds?.xtremePassword,
    size,
    year,
    genre,
  });
  const webUrl = buildWebPlayerUrl(url);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-400">
        Loading...
      </div>
    );
  }

  if (!creds || !creds.xtremeUsername || !creds.xtremePassword) {
    return <NoSubGate kind="Movies" />;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600/20 text-2xl">
          🎬
        </span>
        <div>
          <h1 className="text-2xl font-bold text-white">VOD Movies</h1>
          <p className="text-sm text-slate-400">
            Filter by year and genre, then watch in browser or copy the M3U URL
            to your IPTV app.
          </p>
        </div>
      </div>

      {/* URL bar (live-updates with filter changes) */}
      <div className="mt-6 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={webUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"
          >
            ▶ Watch
          </a>
          <CopyButton value={url} />
        </div>
        <code className="mt-2 block w-full break-all font-mono text-[11px] text-slate-400">
          {url}
        </code>
      </div>

      {/* Stats strip */}
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Total Movies" value="14,160" icon="🎬" />
        <Stat label="With Metadata" value="12,946" icon="🏷️" />
        <Stat label="Avg Rating" value="6.3" icon="⭐" />
        <Stat
          label="Selected Size"
          value={COLLECTION_SIZES.find((s) => s.value === size)?.label || ""}
          icon="📦"
        />
      </div>

      {/* Year filter */}
      <div className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          📅 Filter by Year
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {VOD_YEARS.map((y) => (
            <FilterChip
              key={y}
              label={y}
              active={year === y}
              onClick={() => setYear(y)}
            />
          ))}
        </div>
      </div>

      {/* Genre filter */}
      <div className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          🏷 Filter by Genre
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {MOVIE_GENRES.map((g) => (
            <FilterChip
              key={g}
              label={g}
              active={genre === g}
              onClick={() => setGenre(g)}
            />
          ))}
        </div>
      </div>

      {/* Collection size */}
      <div className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          📦 Collection Size
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

      <p className="mt-6 text-center text-xs text-slate-500">
        Movie metadata (titles, posters, ratings) is browseable in your IPTV
        app once you connect with the M3U URL above.
      </p>
    </div>
  );
}

function FilterChip({
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

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
      <div className="flex items-center gap-2 text-2xl">{icon}</div>
      <div className="mt-1 text-lg font-bold text-white">{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
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

function NoSubGate({ kind }: { kind: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-600/20 text-3xl">
        🔒
      </div>
      <h1 className="mt-4 text-xl font-bold text-white">
        Subscribe to access {kind}
      </h1>
      <p className="mt-2 text-sm text-slate-400">
        You need an active subscription with provisioned credentials to browse
        VOD content.
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
