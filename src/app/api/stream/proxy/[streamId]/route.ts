import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import {
  buildPerUserStreamUrl,
  CatalogChannel,
  CHANNELS_COLLECTION,
} from "@/lib/channel-catalog";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

// GET /api/stream/proxy/{streamId}                 → initial playlist / stream
// GET /api/stream/proxy/{streamId}?u=<encoded-url> → specific segment / sub-playlist
//
// Server-side proxy that gives the in-site hls.js player a same-origin,
// CORS-friendly stream. Browsers block direct fetches to turbobunny because
// of CORS + TLS-cert-on-IP + possible hotlink filtering; this proxy sidesteps
// all three by fetching upstream from the Vercel node (not the browser).
//
// SSRF protection: the `u` URL's host must match the channel's streamHost
// (stored in the master catalog when refreshed). So users can't point this
// at arbitrary hosts.

const UPSTREAM_HEADERS: Record<string, string> = {
  // Spoof a common IPTV-app UA so providers that hotlink-block browsers still
  // serve content. Safe for our use case: users are authenticated and the
  // stream URL already contains their personal credentials.
  "User-Agent": "VLC/3.0.20 LibVLC/3.0.20",
  Accept: "*/*",
};

function isPlaylistContentType(ct: string | null): boolean {
  if (!ct) return false;
  const c = ct.toLowerCase();
  return (
    c.includes("mpegurl") ||
    c.includes("x-mpegurl") ||
    c.includes("vnd.apple.mpegurl")
  );
}

function rewritePlaylist(
  body: string,
  baseUrl: string,
  streamId: number,
  origin: string
): string {
  // Rewrite every URL line in the playlist to point back at this proxy so
  // hls.js fetches segments through us too. Also resolve relative URLs
  // against the playlist base so absolute targets end up in our proxy.
  const base = new URL(baseUrl);
  return body
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;
      let absolute: string;
      try {
        absolute = new URL(trimmed, base).toString();
      } catch {
        return line;
      }
      const proxied = `${origin}/api/stream/proxy/${streamId}?u=${encodeURIComponent(
        absolute
      )}`;
      return proxied;
    })
    .join("\n");
}

export async function GET(
  req: NextRequest,
  ctx: { params: { streamId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const streamId = Number(ctx.params.streamId);
  if (!Number.isFinite(streamId) || streamId <= 0) {
    return new NextResponse("Invalid stream id", { status: 400 });
  }

  const db = await getDb();
  const user = await db
    .collection("users")
    .findOne({ email: session.user.email });
  if (!user) {
    return new NextResponse("User not found", { status: 404 });
  }

  const sub = await db
    .collection("subscriptions")
    .findOne(
      { userId: user._id.toString(), status: "active" },
      { sort: { createdAt: -1 } }
    );
  const creds = sub?.credentials;
  if (!creds?.xtremeUsername || !creds?.xtremePassword) {
    return new NextResponse("No active subscription", { status: 403 });
  }

  const channel = (await db
    .collection<CatalogChannel>(CHANNELS_COLLECTION)
    .findOne(
      { streamId },
      {
        projection: {
          _id: 0,
          streamId: 1,
          streamHost: 1,
          urlScheme: 1,
        },
      }
    )) as CatalogChannel | null;
  if (!channel) {
    return new NextResponse("Channel not found", { status: 404 });
  }

  const baseStreamUrl = buildPerUserStreamUrl(
    channel,
    creds.xtremeUsername,
    creds.xtremePassword
  );

  // Figure out the upstream URL for this particular request.
  const explicit = req.nextUrl.searchParams.get("u");
  let upstreamUrl: string;
  if (explicit) {
    try {
      const parsed = new URL(explicit);
      // SSRF guard: the host must match the channel's registered streamHost.
      if (parsed.host !== channel.streamHost) {
        return new NextResponse("Forbidden host", { status: 403 });
      }
      upstreamUrl = parsed.toString();
    } catch {
      return new NextResponse("Invalid upstream url", { status: 400 });
    }
  } else {
    upstreamUrl = baseStreamUrl;
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: UPSTREAM_HEADERS,
      // Follow redirects so the final content-type reflects the real stream.
      redirect: "follow",
      cache: "no-store",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "upstream fetch failed";
    return new NextResponse(`Upstream fetch error: ${msg}`, { status: 502 });
  }

  if (!upstream.ok) {
    return new NextResponse(
      `Upstream HTTP ${upstream.status}`,
      { status: 502 }
    );
  }

  const contentType =
    upstream.headers.get("content-type") ||
    (upstreamUrl.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "");

  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "no-store",
  };

  // Playlist → rewrite URLs and return as text.
  // Detect both by content-type AND by URL extension, because some servers
  // return octet-stream for .m3u8.
  const looksLikePlaylist =
    isPlaylistContentType(contentType) ||
    /\.m3u8?(\?|$)/i.test(upstreamUrl);

  if (looksLikePlaylist) {
    const text = await upstream.text();
    // Only rewrite if the body actually looks like an M3U (first non-empty
    // line starts with #EXTM3U). Otherwise pipe it through as bytes.
    const firstLine = text.trimStart().split(/\r?\n/, 1)[0] || "";
    if (firstLine.startsWith("#EXTM3U")) {
      const origin = req.nextUrl.origin;
      const rewritten = rewritePlaylist(text, upstreamUrl, streamId, origin);
      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
        },
      });
    }
    // Fall through — serve as bytes.
    return new NextResponse(text, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType || "application/octet-stream",
      },
    });
  }

  // Binary segment / direct stream — pipe through.
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": contentType || "application/octet-stream",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    },
  });
}
