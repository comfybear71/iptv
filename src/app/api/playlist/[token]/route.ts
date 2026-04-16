import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import {
  buildPerUserStreamUrl,
  CatalogChannel,
  CHANNELS_COLLECTION,
} from "@/lib/channel-catalog";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/playlist/{token}.m3u
//
// The user's personal M3U contains ONLY the channels they've hearted (♥).
// Users curate their own playlist by tapping hearts on Browse Channels; the
// resulting M3U is small (typically 10-100 channels) and loads instantly in
// IPTV apps + webplayer.online.
//
// Playback URLs use the user's own MyBunny credentials, so the same stream
// IDs that come from the master catalog authenticate under their account.
export async function GET(
  _req: NextRequest,
  ctx: { params: { token: string } }
) {
  const raw = ctx.params.token || "";
  const token = raw.replace(/\.m3u$/i, "").trim();
  if (!token || token.length < 8) {
    return new NextResponse("invalid token", { status: 404 });
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

  const c = sub?.credentials;
  if (!c?.xtremeUsername || !c?.xtremePassword) {
    return new NextResponse("no active subscription", { status: 403 });
  }

  const username = c.xtremeUsername;
  const password = c.xtremePassword;

  const favoriteIds = Array.from(
    new Set<number>(
      (Array.isArray(user.favoriteStreamIds) ? user.favoriteStreamIds : [])
        .map((x: unknown) => Number(x))
        .filter((n: number) => Number.isFinite(n) && n > 0)
    )
  );

  const filename = `comfytv-${token.slice(0, 8)}.m3u`;

  // No favourites → return a valid but empty M3U with a helpful commented hint.
  if (favoriteIds.length === 0) {
    const emptyBody =
      "#EXTM3U\n# Tap the ♥ on any channel in Browse Channels to add it here.\n";
    return new NextResponse(emptyBody, {
      status: 200,
      headers: {
        "Content-Type": "application/x-mpegURL; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  }

  try {
    const favChannels = (await db
      .collection<CatalogChannel>(CHANNELS_COLLECTION)
      .find(
        { streamId: { $in: favoriteIds } },
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
      )
      .sort({ name: 1 })
      .toArray()) as CatalogChannel[];

    const lines: string[] = ["#EXTM3U"];
    for (const ch of favChannels) {
      lines.push(serializeEntry(ch, "⭐ Favorites", username, password));
    }
    const body = lines.join("\n") + "\n";

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/x-mpegURL; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "playlist build failed";
    return new NextResponse(msg, { status: 502 });
  }
}

function serializeEntry(
  ch: CatalogChannel,
  group: string,
  username: string,
  password: string
): string {
  const attrs: string[] = [];
  if (ch.tvgId) attrs.push(`tvg-id="${escapeAttr(ch.tvgId)}"`);
  const name = ch.tvgName || ch.name;
  if (name) attrs.push(`tvg-name="${escapeAttr(name)}"`);
  if (ch.tvgLogo) attrs.push(`tvg-logo="${escapeAttr(ch.tvgLogo)}"`);
  if (group) attrs.push(`group-title="${escapeAttr(group)}"`);
  const url = buildPerUserStreamUrl(ch, username, password);
  return `#EXTINF:-1 ${attrs.join(" ")},${ch.name}\n${url}`;
}

function escapeAttr(v: string): string {
  return v.replace(/"/g, "'").replace(/[\r\n]+/g, " ");
}
