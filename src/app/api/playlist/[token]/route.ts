import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import {
  buildPerUserStreamUrl,
  CatalogChannel,
  CHANNELS_COLLECTION,
} from "@/lib/channel-catalog";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/playlist/{token}.m3u
//
// The user's personal M3U is streamed from the master catalog in Mongo.
// Favourites appear at the top under "⭐ Favorites", then the rest of the
// catalog (filtered by channelPrefs.enabledCategoryIds if set).
//
// Streaming avoids buffering the ~4 MB M3U in function memory and lets
// bytes flow to the client as soon as they're generated, which keeps
// webplayer.online and the browser happy (no 30s client-side timeout).
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

  // Projection: fetch only the fields we actually need to build the M3U.
  // Saves CPU + memory vs. pulling the full docs.
  const projection = {
    _id: 0,
    streamId: 1,
    name: 1,
    tvgId: 1,
    tvgName: 1,
    tvgLogo: 1,
    group: 1,
    streamHost: 1,
    urlScheme: 1,
  } as const;

  const coll = db.collection<CatalogChannel>(CHANNELS_COLLECTION);

  // Favourites first (small set) — fetch them explicitly so we can prepend
  // the ⭐ Favorites group before streaming the rest.
  let favChannels: CatalogChannel[] = [];
  if (favoriteIds.size > 0) {
    favChannels = (await coll
      .find({ streamId: { $in: Array.from(favoriteIds) } }, { projection })
      .sort({ name: 1 })
      .toArray()) as CatalogChannel[];
  }

  // Rest: stream via a cursor so we never buffer all 21k docs in memory.
  const restFilter: Record<string, unknown> = {};
  if (enabledGroups.size > 0) {
    restFilter.group = { $in: Array.from(enabledGroups) };
  }
  if (favoriteIds.size > 0) {
    restFilter.streamId = { $nin: Array.from(favoriteIds) };
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode("#EXTM3U\n"));

        // Favourites
        for (const ch of favChannels) {
          controller.enqueue(
            encoder.encode(serializeEntry(ch, "⭐ Favorites", username, password))
          );
        }

        // Rest — streamed from the cursor, no toArray()
        const cursor = coll
          .find(restFilter, { projection })
          .sort({ group: 1, name: 1 });

        for await (const raw of cursor) {
          const ch = raw as unknown as CatalogChannel;
          controller.enqueue(
            encoder.encode(serializeEntry(ch, ch.group, username, password))
          );
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new NextResponse(stream, {
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
  return `#EXTINF:-1 ${attrs.join(" ")},${ch.name}\n${url}\n`;
}

function escapeAttr(v: string): string {
  return v.replace(/"/g, "'").replace(/[\r\n]+/g, " ");
}
