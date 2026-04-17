import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import {
  buildPerUserStreamUrl,
  CatalogChannel,
  CHANNELS_COLLECTION,
} from "@/lib/channel-catalog";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const maxDuration = 15;

// GET /api/stream/{token}/{streamId}.m3u
//
// Returns a single-channel M3U playlist so webplayer.online (which only
// understands playlists, not raw stream URLs) can play one channel at a
// time. Token auth matches the personal-playlist route so webplayer's
// server-side fetch works without any session cookie.
export async function GET(
  _req: NextRequest,
  ctx: { params: { token: string; streamId: string } }
) {
  const token = (ctx.params.token || "").trim();
  const rawStreamId = (ctx.params.streamId || "").replace(/\.m3u8?$/i, "").trim();
  const streamId = Number(rawStreamId);

  if (!token || token.length < 8) {
    return new NextResponse("invalid token", { status: 404 });
  }
  if (!Number.isFinite(streamId) || streamId <= 0) {
    return new NextResponse("invalid stream id", { status: 400 });
  }

  const db = await getDb();
  const user = await db.collection("users").findOne({ playlistToken: token });
  if (!user) {
    return new NextResponse("playlist not found", { status: 404 });
  }

  const sub = await db
    .collection("subscriptions")
    .findOne(
      { userId: user._id.toString(), status: "active" },
      { sort: { createdAt: -1 } }
    );

  const creds = sub?.credentials;
  if (!creds?.xtremeUsername || !creds?.xtremePassword) {
    return new NextResponse("no active subscription", { status: 403 });
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
          tvgId: 1,
          tvgName: 1,
          tvgLogo: 1,
          group: 1,
          streamHost: 1,
          urlScheme: 1,
        },
      }
    )) as CatalogChannel | null;

  if (!channel) {
    return new NextResponse("channel not found", { status: 404 });
  }

  const streamUrl = buildPerUserStreamUrl(
    channel,
    creds.xtremeUsername,
    creds.xtremePassword
  );

  const attrs: string[] = [];
  if (channel.tvgId) attrs.push(`tvg-id="${escapeAttr(channel.tvgId)}"`);
  const displayName = channel.tvgName || channel.name;
  if (displayName) attrs.push(`tvg-name="${escapeAttr(displayName)}"`);
  if (channel.tvgLogo) attrs.push(`tvg-logo="${escapeAttr(channel.tvgLogo)}"`);
  if (channel.group) attrs.push(`group-title="${escapeAttr(channel.group)}"`);

  const body =
    `#EXTM3U\n#EXTINF:-1 ${attrs.join(" ")},${channel.name}\n${streamUrl}\n`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/x-mpegURL; charset=utf-8",
      "Content-Disposition": `inline; filename="comfytv-${streamId}.m3u"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}

function escapeAttr(v: string): string {
  return v.replace(/"/g, "'").replace(/[\r\n]+/g, " ");
}
