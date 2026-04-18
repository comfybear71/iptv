"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface MovieDetail {
  streamId: number;
  name: string;
  year: number | null;
  poster: string;
  backdrops: string[];
  plot: string;
  cast: string;
  director: string;
  genre: string;
  rating: number;
  durationSecs: number;
  tmdbId: string | null;
  containerExt: string;
  directSource: string;
}

interface PlaybackResponse {
  kind: string;
  id: string;
  title: string;
  poster: string;
  directSource: string;
  proxyUrl: string | null;
}

/**
 * VOD movie player — native <video> element through the droplet proxy.
 *
 * Movies are MP4, so the browser plays them natively once we give it a
 * same-origin (proxied) URL. No mpegts.js / hls.js needed.
 *
 * Flow on mount:
 *   1. Fetch full movie metadata from /api/vod/movies/[id] (for title,
 *      plot, poster, rating — cached server-side in Redis).
 *   2. Fetch a signed playback URL from /api/me/vod/movie/[id] (session-
 *      authed; returns a proxy URL on stream.comfytv.xyz or falls back
 *      to the raw upstream for VLC).
 *   3. Set <video src> to the proxy URL.
 */
export default function WatchMoviePage({
  params,
}: {
  params: { id: string };
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [detail, setDetail] = useState<MovieDetail | null>(null);
  const [playback, setPlayback] = useState<PlaybackResponse | null>(null);
  const [error, setError] = useState("");
  const [isBuffering, setIsBuffering] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [detailRes, playbackRes] = await Promise.all([
          fetch(`/api/vod/movies/${params.id}`, { cache: "no-store" }),
          fetch(`/api/me/vod/movie/${params.id}`, { cache: "no-store" }),
        ]);
        const detailData = await detailRes.json().catch(() => ({}));
        const playbackData = await playbackRes.json().catch(() => ({}));
        if (!detailRes.ok) throw new Error(detailData.error || `HTTP ${detailRes.status}`);
        if (!playbackRes.ok) throw new Error(playbackData.error || `HTTP ${playbackRes.status}`);
        setDetail(detailData as MovieDetail);
        setPlayback(playbackData as PlaybackResponse);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load movie");
      }
    })();
  }, [params.id]);

  // Buffering overlay — same pattern as live TV /watch page.
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/dashboard/movies"
            className="text-xs text-slate-400 hover:text-white"
          >
            ← Back to Movies
          </Link>
          <h1 className="mt-1 truncate text-xl font-bold text-white">
            {detail?.name || (error ? "Playback error" : "Loading…")}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {detail?.year && <span>{detail.year}</span>}
            {detail?.genre && <span>· {detail.genre}</span>}
            {detail?.rating && detail.rating > 0 && (
              <span>· ⭐ {detail.rating.toFixed(1)}</span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-black">
        <video
          ref={videoRef}
          src={playUrl || undefined}
          controls
          playsInline
          autoPlay
          poster={detail?.poster || undefined}
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

      {!playUrl && rawUrl && (
        <div className="rounded-lg border border-amber-800 bg-amber-900/30 p-3 text-xs text-amber-200">
          In-site playback is disabled — the droplet proxy isn&apos;t configured.
          Copy the stream URL or open it in VLC.
        </div>
      )}

      {detail?.plot && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
            Plot
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

      {rawUrl && (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
            Also available
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            If in-site playback stalls, open in VLC or paste the URL into your
            IPTV app.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => copyUrl(rawUrl, "stream")}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              {copyStatus === "stream" ? "✓ Copied" : "📋 Copy stream URL"}
            </button>
            <a
              href={rawUrl}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              Open in VLC
            </a>
          </div>
          <code className="mt-3 block w-full overflow-hidden break-all rounded-md bg-slate-950 px-3 py-2 font-mono text-[11px] text-slate-400">
            {rawUrl}
          </code>
        </div>
      )}
    </div>
  );
}
