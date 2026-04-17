"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface StreamInfo {
  streamId: number;
  name: string;
  tvgName: string | null;
  tvgLogo: string | null;
  group: string | null;
  /** Raw upstream IPTV URL (direct provider URL, playable in VLC / TiviMate) */
  streamUrl: string;
  /** HMAC-signed proxy URL on the droplet. Null if the droplet isn't set up. */
  proxyUrl: string | null;
}

// Public HLS test stream — loaded when ?test=1 is on the URL so we can verify
// the <video> + player wiring independently of our provider's stream shape.
const TEST_HLS = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

type PlaybackMode =
  | { kind: "loading" }
  | { kind: "test-hls"; url: string }
  | { kind: "mpegts"; url: string }
  | { kind: "no-proxy"; streamUrl: string }
  | { kind: "error"; message: string };

export default function WatchPage({
  params,
}: {
  params: { streamId: string };
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [info, setInfo] = useState<StreamInfo | null>(null);
  const [mode, setMode] = useState<PlaybackMode>({ kind: "loading" });
  const [playerError, setPlayerError] = useState("");
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // Resolve stream info + decide playback mode.
  useEffect(() => {
    const search =
      typeof window !== "undefined" ? window.location.search : "";
    const isTest = /[?&]test=1\b/.test(search);

    if (isTest) {
      setInfo({
        streamId: 0,
        name: "HLS test stream (Mux)",
        tvgName: null,
        tvgLogo: null,
        group: "Diagnostics",
        streamUrl: TEST_HLS,
        proxyUrl: null,
      });
      setMode({ kind: "test-hls", url: TEST_HLS });
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/me/stream/${params.streamId}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        const payload = data as StreamInfo;
        setInfo(payload);
        if (payload.proxyUrl) {
          setMode({ kind: "mpegts", url: payload.proxyUrl });
        } else {
          setMode({ kind: "no-proxy", streamUrl: payload.streamUrl });
        }
      } catch (err: unknown) {
        setMode({
          kind: "error",
          message: err instanceof Error ? err.message : "Failed to load stream",
        });
      }
    })();
  }, [params.streamId]);

  // Attach the right player based on the current mode.
  useEffect(() => {
    if (mode.kind !== "mpegts" && mode.kind !== "test-hls") return;
    const video = videoRef.current;
    if (!video) return;

    let destroy: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      if (mode.kind === "test-hls") {
        // Prefer native HLS on Safari/iOS.
        const canNative = video.canPlayType("application/vnd.apple.mpegurl");
        if (canNative) {
          video.src = mode.url;
          try {
            await video.play();
          } catch {
            // autoplay blocked — user taps play
          }
          return;
        }
        const mod = await import("hls.js");
        if (cancelled) return;
        const Hls = mod.default;
        if (!Hls.isSupported()) {
          setPlayerError("hls.js is not supported in this browser.");
          return;
        }
        const hls = new Hls({ maxBufferLength: 30 });
        destroy = () => hls.destroy();
        hls.loadSource(mode.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_ev, data) => {
          if (data.fatal) {
            setPlayerError(`${data.type}: ${data.details || "playback error"}`);
          }
        });
        return;
      }

      // mpegts mode — real channel via droplet proxy.
      if (mode.kind === "mpegts") {
        const mod = await import("mpegts.js");
        if (cancelled) return;
        const mpegts = mod.default;
        if (!mpegts.getFeatureList().mseLivePlayback) {
          setPlayerError(
            "This browser doesn't support live MPEG-TS over MSE. Use VLC or the personal M3U URL below."
          );
          return;
        }
        const player = mpegts.createPlayer(
          {
            type: "mpegts",
            isLive: true,
            url: mode.url,
          },
          {
            enableWorker: false,
            lazyLoad: false,
            // Don't aggressively chase the live edge — prioritise smooth
            // playback over sub-second latency. Viewers don't care about
            // being 5 s behind live; they care about stutter.
            liveBufferLatencyChasing: false,
            // Bigger initial buffer → smoother startup on first play.
            stashInitialSize: 384,
            // Release already-played buffers so long sessions don't eat RAM.
            autoCleanupSourceBuffer: true,
          }
        );
        destroy = () => {
          try {
            player.pause();
            player.unload();
            player.detachMediaElement();
            player.destroy();
          } catch {}
        };
        player.attachMediaElement(video);
        player.load();
        // mpegts.js types say play() returns void | Promise<void> — guard it.
        const playResult = player.play() as unknown;
        if (
          playResult &&
          typeof (playResult as Promise<void>).catch === "function"
        ) {
          (playResult as Promise<void>).catch(() => {});
        }
        player.on(mpegts.Events.ERROR, (type: string, details: string) => {
          setPlayerError(`${type}: ${details}`);
        });
      }
    })();

    return () => {
      cancelled = true;
      if (destroy) destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [mode]);

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
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {info?.tvgLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={info.tvgLogo}
              alt=""
              className="h-10 w-10 flex-shrink-0 rounded-lg bg-slate-900 object-contain p-1"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-purple-600/20 text-2xl">
              📺
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-white">
              {info?.name ||
                (mode.kind === "error" ? "Playback error" : "Loading…")}
            </h1>
            {info?.group && (
              <p className="truncate text-xs text-slate-400">{info.group}</p>
            )}
          </div>
        </div>
        <Link
          href="/dashboard/channels"
          className="flex-shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
        >
          ← Back
        </Link>
      </div>

      {mode.kind === "test-hls" && (
        <div className="rounded-lg border border-blue-800 bg-blue-900/30 p-3 text-xs text-blue-200">
          Test mode: streaming a public HLS test file. If this plays, the
          player scaffolding is healthy.
        </div>
      )}

      {mode.kind === "error" && (
        <div className="rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {mode.message}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-black">
        <video
          ref={videoRef}
          controls
          playsInline
          autoPlay
          className="block aspect-video w-full bg-black"
        />
      </div>

      {playerError && (
        <div className="rounded-lg border border-amber-800 bg-amber-900/30 p-3 text-xs text-amber-200">
          Player reported: <code className="font-mono">{playerError}</code>. If
          playback doesn&apos;t start, try a different channel or open this
          stream in VLC using the link below.
        </div>
      )}

      {/* Fallback block: always show VLC / personal-M3U option, useful when
          the browser can't decode (iOS Safari) or the droplet isn't set up. */}
      {info && mode.kind !== "test-hls" && (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
            Also available
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {mode.kind === "no-proxy"
              ? "In-site playback is disabled on this deployment. Use VLC or your IPTV app instead."
              : "If in-site playback stalls, copy this URL into VLC, TiviMate or IPTV Smarters."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => copyUrl(info.streamUrl, "stream")}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              {copyStatus === "stream" ? "✓ Copied" : "📋 Copy stream URL"}
            </button>
            <a
              href={info.streamUrl}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              Open in VLC
            </a>
            <Link
              href="/dashboard/how-to-watch"
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              Setup guide →
            </Link>
          </div>
          <code className="mt-3 block w-full overflow-hidden break-all rounded-md bg-slate-950 px-3 py-2 font-mono text-[11px] text-slate-400">
            {info.streamUrl}
          </code>
        </div>
      )}

      <p className="text-xs text-slate-500">
        {mode.kind === "mpegts"
          ? "Streaming inside ComfyTV via mpegts.js through our proxy. For the best experience on TV, use the personal M3U URL with TiviMate / IPTV Smarters."
          : "Personal M3U URL on Browse Channels plays every channel in VLC, TiviMate, IPTV Smarters and OTT Navigator."}
      </p>
    </div>
  );
}
