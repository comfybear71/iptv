import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import {
  buildPerUserStreamUrl,
  CatalogChannel,
  CHANNELS_COLLECTION,
} from "@/lib/channel-catalog";

export const revalidate = 0;
export const dynamic = "force-dynamic";

// GET /api/playlist/{token}.m3u
//
// The user's personal M3U is now assembled from the master catalog in Mongo
// (stored by /api/admin/channels/refresh) with the user's credentials
// swapped into every stream URL. Favourites appear at the top under
// "⭐ Favorites" and, if the user has channelPrefs.enabledCategoryIds set,
// the rest is filtered by those groups.
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

  const favoriteIds = new Set<number>(
    (Array.isArray(user.favoriteStreamIds) ? user.favoriteStreamIds : [])
      .map((x: unknown) => Number(x))
      .filter((n: number) => Number.isFinite(n) && n > 0)
  );

  const enabledGroups = new Set<string>(
    (Array.isArray(user.channelPrefs?.enabledCategoryIds)
      ? user.channelPrefs.enabledCategoryIds
      : []
    ).map((x: unknown) => String(x))
  );

  try {
    const allChannels = (await db
      .collection<CatalogChannel>(CHANNELS_COLLECTION)
      .find({})
      .sort({ group: 1, name: 1 })
      .toArray()) as CatalogChannel[];

    const lines: string[] = ["#EXTM3U"];

    const favChannels = allChannels.filter((ch) =>
      favoriteIds.has(ch.streamId)
    );
    for (const ch of favChannels) {
      appendExtinf(lines, ch, "⭐ Favorites");
      lines.push(buildPerUserStreamUrl(ch, username, password));
    }

    let restChannels = allChannels;
    if (enabledGroups.size > 0) {
      restChannels = allChannels.filter((ch) => enabledGroups.has(ch.group));
    }
    const favIdSet = new Set(favChannels.map((ch) => ch.streamId));
    restChannels = restChannels.filter((ch) => !favIdSet.has(ch.streamId));

    for (const ch of restChannels) {
      appendExtinf(lines, ch, ch.group);
      lines.push(buildPerUserStreamUrl(ch, username, password));
    }

    const body = lines.join("\n") + "\n";

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/x-mpegURL; charset=utf-8",
        "Content-Disposition": `attachment; filename="comfytv-${token.slice(
          0,
          8
        )}.m3u"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "playlist build failed";
    return new NextResponse(msg, { status: 502 });
  }
}

function appendExtinf(
  lines: string[],
  ch: CatalogChannel,
  group: string
): void {
  const attrs: string[] = [];
  if (ch.tvgId) attrs.push(`tvg-id="${escapeAttr(ch.tvgId)}"`);
  const name = ch.tvgName || ch.name;
  if (name) attrs.push(`tvg-name="${escapeAttr(name)}"`);
  if (ch.tvgLogo) attrs.push(`tvg-logo="${escapeAttr(ch.tvgLogo)}"`);
  if (group) attrs.push(`group-title="${escapeAttr(group)}"`);
  lines.push(`#EXTINF:-1 ${attrs.join(" ")},${ch.name}`);
}

function escapeAttr(v: string): string {
  return v.replace(/"/g, "'").replace(/[\r\n]+/g, " ");
}
