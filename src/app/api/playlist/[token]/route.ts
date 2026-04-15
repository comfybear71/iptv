import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { fetchMyBunnyEntries } from "@/lib/mybunny-playlist";
import { serializeM3u } from "@/lib/m3u-parse";
import { DEFAULT_XTREME_HOST } from "@/lib/mybunny";

export const revalidate = 0;
export const dynamic = "force-dynamic";

// GET /api/playlist/{token}.m3u
//
// Proxies MyBunny's own download.php playlist (which we know plays in
// Smarters Pro / TiviMate / VLC) and filters it by:
//   - the user's channelPrefs.enabledCategoryIds (string group-titles now)
//   - the user's favouriteStreamIds (moved to the top under "⭐ Favorites")
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

  const host = (c.xtremeHost || DEFAULT_XTREME_HOST).replace(/\/$/, "");
  const creds = {
    host,
    username: c.xtremeUsername,
    password: c.xtremePassword,
  };

  const enabledGroups: Set<string> = new Set(
    (Array.isArray(user.channelPrefs?.enabledCategoryIds)
      ? user.channelPrefs.enabledCategoryIds
      : []
    ).map((x: unknown) => String(x))
  );

  const favoriteIds: Set<number> = new Set(
    (Array.isArray(user.favoriteStreamIds) ? user.favoriteStreamIds : [])
      .map((x: unknown) => Number(x))
      .filter((n: number) => Number.isFinite(n) && n > 0)
  );

  try {
    const entries = await fetchMyBunnyEntries(creds);

    // Favourites (pinned to top under "⭐ Favorites")
    const favEntries = entries
      .filter((e) => e.streamId !== null && favoriteIds.has(e.streamId))
      .map((e) => ({ ...e, overrideGroup: "⭐ Favorites" }));

    // Rest: either everything (no prefs) or only entries whose group matches
    let restEntries = entries;
    if (enabledGroups.size > 0) {
      restEntries = entries.filter((e) => enabledGroups.has(e.group));
    }

    // De-dup — a favourited entry must not also appear in the rest list
    const favIdSet = new Set(
      favEntries.map((e) => e.streamId).filter((x): x is number => x !== null)
    );
    restEntries = restEntries.filter(
      (e) => e.streamId === null || !favIdSet.has(e.streamId)
    );

    const body = serializeM3u([...favEntries, ...restEntries]);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/x-mpegURL; charset=utf-8",
        "Content-Disposition": `attachment; filename="comfytv-${token.slice(0, 8)}.m3u"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "playlist build failed";
    return new NextResponse(msg, { status: 502 });
  }
}
