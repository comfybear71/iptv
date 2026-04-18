"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Episode {
  id: string;
  episodeNum: number;
  title: string;
  plot: string;
  poster: string;
  containerExt: string;
  durationSecs: number;
}

interface Season {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  cover: string;
  overview: string;
}

interface SeriesDetail {
  seriesId: number;
  name: string;
  cover: string;
  plot: string;
  cast: string;
  director: string;
  genre: string;
  year: number | null;
  rating: number;
  youtubeTrailer: string;
  seasons: Season[];
  episodesBySeason: Record<string, Episode[]>;
}

interface PlaybackResponse {
  kind: string;
  id: string;
  title: string;
  poster: string;
  directSource: string;
  proxyUrl: string | null;
}

export default function WatchSeriesPage({
  params,
}: {
  params: { id: string };
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [detail, setDetail] = useState<SeriesDetail | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [playback, setPlayback] = useState<PlaybackResponse | null>(null);
  const [error, setError] = useState("");
  const [playbackError, setPlaybackError] = useState("");
  const [isBuffering, setIsBuffering] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // Load series metadata once.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/vod/series/${params.id}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        const payload = data as SeriesDetail;
        setDetail(payload);
        if (payload.seasons.length > 0) {
          setSelectedSeason(payload.seasons[0].seasonNumber);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load series");
      }
    })();
  }, [params.id]);

  // Load playback URL for selected episode.
  useEffect(() => {
    if (!selectedEpisodeId) return;
    setPlaybackError("");
    setPlayback(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/me/vod/episode/${selectedEpisodeId}?seriesId=${params.id}`,
          { cache: "no-store" }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setPlayback(data as PlaybackResponse);
      } catch (err: unknown) {
        setPlaybackError(
          err instanceof Error ? err.message : "Failed to load episode"
        );
      }
    })();
  }, [selectedEpisodeId, params.id]);

  // Buffering overlay listeners — same pattern as movie + live TV.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onWaiting = () => setIsBuffering(true);
    const onStalled = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onCanPlay = () => setIsBuffering(false);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("stalled", onStalled);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", onCanPlay);
    return () => {
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("stalled", onStalled);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("canplay", onCanPlay);
    };
  }, [playback]);

  const playUrl = playback?.proxyUrl || null;
  const rawUrl = playback?.directSource || "";
  const seasonEpisodes =
    selectedSeason != null
      ? detail?.episodesBySeason[String(selectedSeason)] || []
      : [];

  const copyUrl = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus(label);
      setTimeout(() => setCopyStatus(null), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
      <div className="min-w-0">
        <Link
          href="/dashboard/series"
          className="text-xs text-slate-400 hover:text-white"
        >
          ← Back to Series
        </Link>
        <h1 className="mt-1 truncate text-xl font-bold text-white">
          {detail?.name || (error ? "Error" : "Loading…")}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          {detail?.year && <span>{detail.year}</span>}
          {detail?.genre && <span>· {detail.genre}</span>}
          {detail?.rating && detail.rating > 0 && (
            <span>· ⭐ {detail.rating.toFixed(1)}</span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Player — only rendered once an episode is picked */}
      {selectedEpisodeId && (
        <>
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-black">
            <video
              ref={videoRef}
              src={playUrl || undefined}
              controls
              playsInline
              autoPlay
              poster={playback?.poster || detail?.cover || undefined}
              className="block aspect-video w-full bg-black"
            />
            {isBuffering && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="flex items-center gap-3 rounded-xl bg-black/70 px-4 py-2.5 text-sm text-white backdrop-blur-sm">
                  <span className="block h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-white" />
                  Buffering…
                </div>
              </div>
            )}
          </div>
          {playbackError && (
            <div className="rounded-lg border border-red-800 bg-red-900/30 p-3 text-xs text-red-300">
              {playbackError}
            </div>
          )}
          {!playUrl && rawUrl && (
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => copyUrl(rawUrl, "episode")}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                >
                  {copyStatus === "episode" ? "✓ Copied" : "📋 Copy URL"}
                </button>
                <a
                  href={rawUrl}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                >
                  Open in VLC
                </a>
              </div>
            </div>
          )}
        </>
      )}

      {/* Series info + plot */}
      {detail?.plot && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
            About
          </h2>
          <p className="mt-2 text-sm text-slate-200">{detail.plot}</p>
          {(detail.cast || detail.director) && (
            <dl className="mt-4 grid gap-2 text-xs">
              {detail.director && (
                <div className="flex gap-2">
                  <dt className="w-20 text-slate-500">Director</dt>
                  <dd className="flex-1 text-slate-200">{detail.director}</dd>
                </div>
              )}
              {detail.cast && (
                <div className="flex gap-2">
                  <dt className="w-20 text-slate-500">Cast</dt>
                  <dd className="flex-1 text-slate-200">{detail.cast}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      )}

      {/* Season picker */}
      {detail && detail.seasons.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {detail.seasons.map((s) => (
            <button
              key={s.seasonNumber}
              onClick={() => setSelectedSeason(s.seasonNumber)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                selectedSeason === s.seasonNumber
                  ? "bg-blue-600 text-white"
                  : "border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {s.name} ({s.episodeCount} ep)
            </button>
          ))}
        </div>
      )}

      {/* Episode list */}
      {seasonEpisodes.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <ul className="divide-y divide-slate-800">
            {seasonEpisodes.map((ep) => (
              <li
                key={ep.id}
                className={`flex cursor-pointer items-center gap-3 px-4 py-3 text-sm transition hover:bg-slate-800 ${
                  selectedEpisodeId === ep.id ? "bg-slate-800" : ""
                }`}
                onClick={() => setSelectedEpisodeId(ep.id)}
              >
                <span className="flex-shrink-0 rounded-md bg-slate-950 px-2 py-1 font-mono text-[11px] text-slate-400">
                  E{String(ep.episodeNum).padStart(2, "0")}
                </span>
                <span className="flex-1 truncate text-slate-200">
                  {ep.title}
                </span>
                {selectedEpisodeId === ep.id && (
                  <span className="text-[10px] uppercase tracking-widest text-emerald-400">
                    ▶ Now playing
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
