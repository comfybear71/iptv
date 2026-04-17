import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import {
  buildPerUserStreamUrl,
  CatalogChannel,
  CHANNELS_COLLECTION,
} from "@/lib/channel-catalog";
import { buildProxyStreamUrl } from "@/lib/stream-token";

export const revalidate = 0;
export const dynamic = "force-dynamic";

// GET /api/me/stream/{streamId}
//
// Session-authenticated lookup for the in-site player. Returns a short-lived
// HMAC-signed proxy URL (playable inline via mpegts.js through the droplet
// proxy) plus the raw upstream URL as a fallback for VLC / copy-to-IPTV-app.
//
// The droplet-proxy path is gated by env var ENABLE_DROPLET_PLAYER=1 +
// STREAM_PROXY_HOST + STREAM_PROXY_SECRET. If those aren't set the client
// falls back to the "open in VLC / use the personal M3U" UX.
export async function GET(
  _req: NextRequest,
  ctx: { params: { streamId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const streamId = Number(ctx.params.streamId);
  if (!Number.isFinite(streamId) || streamId <= 0) {
    return NextResponse.json({ error: "Invalid stream id" }, { status: 400 });
  }

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

  const channel = (await db
    .collection<CatalogChannel>(CHANNELS_COLLECTION)
    .findOne(
      { streamId },
      {
        projection: {
          _id: 0,
          streamId: 1,
          name: 1,
          tvgName: 1,
          tvgLogo: 1,
          group: 1,
          streamHost: 1,
          urlScheme: 1,
        },
      }
    )) as CatalogChannel | null;

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const upstreamUrl = buildPerUserStreamUrl(
    channel,
    creds.xtremeUsername,
    creds.xtremePassword
  );

  // If the droplet proxy is wired up, mint a signed URL the browser can
  // fetch directly via mpegts.js. Otherwise the client has no in-browser
  // playback path and will show VLC / M3U fallbacks.
  const enableDroplet = process.env.ENABLE_DROPLET_PLAYER === "1";
  const proxyHost = process.env.STREAM_PROXY_HOST;
  const proxySecret = process.env.STREAM_PROXY_SECRET;
  const proxyUrl =
    enableDroplet && proxyHost && proxySecret
      ? buildProxyStreamUrl({
          upstreamUrl,
          proxyHost,
          secret: proxySecret,
          ttlSeconds: 60,
        })
      : null;

  return NextResponse.json({
    streamId: channel.streamId,
    name: channel.name,
    tvgName: channel.tvgName || null,
    tvgLogo: channel.tvgLogo || null,
    group: channel.group || null,
    // Raw upstream URL — direct MPEG-TS from the provider. Works in VLC /
    // TiviMate / IPTV Smarters. Not playable directly in a browser.
    streamUrl: upstreamUrl,
    // Proxy URL for in-browser playback. Null if the droplet isn't wired up.
    proxyUrl,
  });
}
