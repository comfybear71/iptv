import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { CHANNELS_COLLECTION } from "@/lib/channel-catalog";

export const revalidate = 0;
export const dynamic = "force-dynamic";

// GET /api/me/favorites/detail
//
// Returns the logged-in user's hearted channels with enough info for the
// dashboard to render removable pills, plus an aggregation of hearted
// counts per category so the sidebar can show "5/490"-style badges.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const user = await db
    .collection("users")
    .findOne({ email: session.user.email });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const favoriteIds: number[] = Array.isArray(user.favoriteStreamIds)
    ? user.favoriteStreamIds
        .map((x: unknown) => Number(x))
        .filter((n: number) => Number.isFinite(n) && n > 0)
    : [];

  if (favoriteIds.length === 0) {
    return NextResponse.json({ channels: [], byCategory: {} });
  }

  const coll = db.collection(CHANNELS_COLLECTION);

  const [channelDocs, grouped] = await Promise.all([
    coll
      .find(
        { streamId: { $in: favoriteIds } },
        {
          projection: {
            _id: 0,
            streamId: 1,
            name: 1,
            tvgName: 1,
            tvgLogo: 1,
            group: 1,
          },
        }
      )
      .sort({ group: 1, name: 1 })
      .toArray(),
    coll
      .aggregate<{ _id: string; count: number }>([
        { $match: { streamId: { $in: favoriteIds } } },
        { $group: { _id: "$group", count: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  const channels = channelDocs.map((c) => ({
    stream_id: c.streamId as number,
    name: (c.name as string) || "",
    tvg_name: (c.tvgName as string) || "",
    tvg_logo: (c.tvgLogo as string) || "",
    group: (c.group as string) || "",
  }));

  const byCategory: Record<string, number> = {};
  for (const row of grouped) {
    byCategory[row._id] = row.count;
  }

  return NextResponse.json({ channels, byCategory });
}
