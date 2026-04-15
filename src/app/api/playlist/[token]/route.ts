import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import {
  fetchXtreamLiveCategories,
  fetchXtreamLiveStreams,
  XtreamLiveStream,
} from "@/lib/xtream";
import { buildM3u } from "@/lib/m3u";
import { DEFAULT_XTREME_HOST } from "@/lib/mybunny";

export const revalidate = 0; // playlist reflects user prefs — always fresh
export const dynamic = "force-dynamic";

// GET /api/playlist/{token}.m3u (or just /{token})
// Returns an M3U playlist filtered by the owning user's channelPrefs.
// If the user has no prefs (or empty list), returns the full channel lineup.
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

  // Resolve active subscription credentials
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

  const creds = {
    host: c.xtremeHost || DEFAULT_XTREME_HOST,
    username: c.xtremeUsername,
    password: c.xtremePassword,
  };

  const enabled: string[] = Array.isArray(user.channelPrefs?.enabledCategoryIds)
    ? user.channelPrefs.enabledCategoryIds.map((x: unknown) => String(x))
    : [];

  const favoriteIds: number[] = Array.isArray(user.favoriteStreamIds)
    ? user.favoriteStreamIds
        .map((x: unknown) => Number(x))
        .filter((n: number) => Number.isFinite(n))
    : [];

  try {
    // We need every stream in the user's enabled categories PLUS every
    // stream that matches a favorite ID. Fetch the full catalog when the
    // user has favorites so we can pick them out; otherwise use the
    // enabled-categories path.
    const needAllStreams = favoriteIds.length > 0;
    const [categories, mainStreams, allStreamsIfNeeded] = await Promise.all([
      fetchXtreamLiveCategories(creds),
      loadStreams(creds, enabled),
      needAllStreams
        ? fetchXtreamLiveStreams(creds)
        : Promise.resolve([] as XtreamLiveStream[]),
    ]);

    const categoryNames: Record<string, string> = {};
    for (const cat of categories) {
      categoryNames[cat.category_id] = cat.category_name;
    }

    // Build the favorites group by picking matching streams out of the full
    // catalog. We rename their group-title to "⭐ Favorites" via override.
    const favoriteStreams: XtreamLiveStream[] = allStreamsIfNeeded.filter((s) =>
      favoriteIds.includes(s.stream_id)
    );
    const favoritesCategoryId = "__favorites__";
    const favoritesOverride = favoriteStreams.map((s) => ({
      ...s,
      category_id: favoritesCategoryId,
    }));
    if (favoriteStreams.length > 0) {
      categoryNames[favoritesCategoryId] = "⭐ Favorites";
    }

    // De-dup: if a stream is both in mainStreams AND favorites, keep the
    // favorites version (so it appears in the ⭐ group, not twice).
    const favSet = new Set(favoriteIds);
    const mainDeduped = mainStreams.filter((s) => !favSet.has(s.stream_id));

    const body = buildM3u({
      streams: [...favoritesOverride, ...mainDeduped],
      host: creds.host,
      username: creds.username,
      password: creds.password,
      categoryNames,
    });

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/x-mpegURL; charset=utf-8",
        "Content-Disposition": `attachment; filename="comfytv-${token.slice(0, 8)}.m3u"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err: any) {
    return new NextResponse(err?.message || "playlist build failed", {
      status: 502,
    });
  }
}

async function loadStreams(
  creds: { host: string; username: string; password: string },
  enabledCategoryIds: string[]
): Promise<XtreamLiveStream[]> {
  if (enabledCategoryIds.length === 0) {
    return fetchXtreamLiveStreams(creds);
  }
  const results = await Promise.all(
    enabledCategoryIds.map((id) => fetchXtreamLiveStreams(creds, id))
  );
  return results.flat();
}
