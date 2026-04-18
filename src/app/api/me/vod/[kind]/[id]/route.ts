import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import {
  buildPerUserVodUrl,
  getMovieInfo,
  getSeriesInfo,
} from "@/lib/xtream-vod";
import { buildProxyStreamUrl } from "@/lib/stream-token";

export const revalidate = 0;
export const dynamic = "force-dynamic";

// GET /api/me/vod/movie/{streamId}
// GET /api/me/vod/episode/{episodeId}?seriesId=...
//
// Session-authenticated lookup that returns a playable URL for the in-site
// <video> element. Path shape mirrors the Xtream endpoints:
//   - `movie` → one-shot VOD (movies)
//   - `episode` → a specific series episode (the episodeId is the Xtream
//                 episode id, but we need to look up which series it
//                 belongs to via ?seriesId=)
//
// We fetch the upstream direct_source (with master creds), swap in the
// user's creds, then HMAC-sign through our DigitalOcean droplet proxy so
// the browser talks to stream.comfytv.xyz and never hits turbobunny
// directly — same pattern as live TV.
export async function GET(
  req: NextRequest,
  ctx: { params: { kind: string; id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const kind = ctx.params.kind;
  if (kind !== "movie" && kind !== "episode") {
    return NextResponse.json(
      { error: "kind must be 'movie' or 'episode'" },
      { status: 400 }
    );
  }

  const id = ctx.params.id;
  const seriesIdParam = req.nextUrl.searchParams.get("seriesId");

  // Resolve the user's Xtream credentials from their active subscription.
  const db = await getDb();
  const user = await db
    .collection("users")
    .findOne({ email: session.user.email });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const sub = await db
    .collection("subscriptions")
    .findOne(
      { userId: user._id.toString(), status: "active" },
      { sort: { createdAt: -1 } }
    );
  const creds = sub?.credentials;
  if (!creds?.xtremeUsername || !creds?.xtremePassword) {
    return NextResponse.json(
      { error: "No active subscription" },
      { status: 403 }
    );
  }

  // Pull the upstream URL from the Xtream API (cached in Redis).
  let upstreamDirect = "";
  let title = "";
  let poster = "";
  try {
    if (kind === "movie") {
      const info = await getMovieInfo(Number(id));
      upstreamDirect = info.movie_data?.direct_source || "";
      title = info.info?.name || info.movie_data?.name || `Movie ${id}`;
      poster = info.info?.movie_image || "";
    } else {
      if (!seriesIdParam) {
        return NextResponse.json(
          { error: "episode playback requires ?seriesId=" },
          { status: 400 }
        );
      }
      const seriesInfo = await getSeriesInfo(Number(seriesIdParam));
      let match: { title: string; poster: string; directSource: string } | null = null;
      for (const list of Object.values(seriesInfo.episodes || {})) {
        if (!Array.isArray(list)) continue;
        const ep = list.find((e) => String(e.id) === String(id));
        if (ep) {
          match = {
            title: ep.title,
            poster: ep.info?.movie_image || seriesInfo.info?.cover || "",
            directSource: ep.direct_source,
          };
          break;
        }
      }
      if (!match) {
        return NextResponse.json(
          { error: "Episode not found in series" },
          { status: 404 }
        );
      }
      upstreamDirect = match.directSource;
      title = match.title;
      poster = match.poster;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "upstream lookup failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (!upstreamDirect) {
    return NextResponse.json(
      { error: "No upstream direct_source" },
      { status: 502 }
    );
  }

  // Swap the master creds out of the direct_source for this user's.
  const userUpstream = buildPerUserVodUrl(
    upstreamDirect,
    creds.xtremeUsername,
    creds.xtremePassword
  );
  if (!userUpstream) {
    return NextResponse.json(
      { error: "upstream URL shape not recognised" },
      { status: 502 }
    );
  }

  // Sign a short-lived droplet-proxy URL — the browser will fetch this
  // instead of hitting turbobunny directly. Same mechanism as live TV.
  const proxyHost = process.env.STREAM_PROXY_HOST;
  const proxySecret = process.env.STREAM_PROXY_SECRET;
  const enableDroplet = process.env.ENABLE_DROPLET_PLAYER === "1";
  const proxyUrl =
    enableDroplet && proxyHost && proxySecret
      ? buildProxyStreamUrl({
          upstreamUrl: userUpstream,
          proxyHost,
          secret: proxySecret,
          // VOD tokens live longer than live TV (10 min) so a single
          // signed URL survives a full movie — browser will keep the
          // connection open once it starts playing.
          ttlSeconds: 600,
        })
      : null;

  return NextResponse.json({
    kind,
    id,
    title,
    poster,
    directSource: userUpstream, // raw URL for VLC copy / Open in VLC
    proxyUrl, // null when droplet not configured → VLC fallback
  });
}
