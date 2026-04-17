"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface StreamInfo {
  streamId: number;
  name: string;
  tvgName: string | null;
  tvgLogo: string | null;
  group: string | null;
  streamUrl: string;
}

export default function WatchPage({
  params,
}: {
  params: { streamId: string };
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [info, setInfo] = useState<StreamInfo | null>(null);
  const [error, setError] = useState("");
  const [playerError, setPlayerError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/me/stream/${params.streamId}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setInfo(data as StreamInfo);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load stream");
      }
    })();
  }, [params.streamId]);

  // Attach hls.js (or native HLS on Safari/iOS) to the <video> once we have
  // the stream URL. Dynamically import hls.js so it only loads in-browser.
  useEffect(() => {
    if (!info?.streamUrl || !videoRef.current) return;
    const video = videoRef.current;
    const url = info.streamUrl;

    let hlsInstance: { destroy: () => void } | null = null;
    let cancelled = false;

    (async () => {
      const canNative = video.canPlayType("application/vnd.apple.mpegurl");
      if (canNative) {
        video.src = url;
        try {
          await video.play();
        } catch {
          // autoplay blocked; user will tap play
        }
        return;
      }

      try {
        const mod = await import("hls.js");
        if (cancelled) return;
        const Hls = mod.default;
        if (!Hls.isSupported()) {
          video.src = url;
          return;
        }
        const hls = new Hls({
          maxBufferLength: 30,
          lowLatencyMode: false,
        });
        hlsInstance = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {
            // autoplay blocked; user will tap play
          });
        });
        hls.on(Hls.Events.ERROR, (_ev, data) => {
          if (data.fatal) {
            setPlayerError(
              `${data.type}: ${data.details || "playback error"}`
            );
          }
        });
      } catch (err: unknown) {
        setPlayerError(
          err instanceof Error ? err.message : "Player failed to load"
        );
      }
    })();

    return () => {
      cancelled = true;
      if (hlsInstance) {
        hlsInstance.destroy();
      }
      video.removeAttribute("src");
      video.load();
    };
  }, [info?.streamUrl]);

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
              {info?.name || (error ? "Playback error" : "Loading…")}
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

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
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
          Player reported: <code>{playerError}</code>. If playback doesn&apos;t
          start, try a different channel or open in VLC (the stream URL is
          compatible with every IPTV app).
        </div>
      )}

      <p className="text-xs text-slate-500">
        Streaming inside ComfyTV via hls.js. For the best experience on TV,
        use the personal M3U URL on the Browse Channels page with TiviMate /
        IPTV Smarters.
      </p>
    </div>
  );
}
