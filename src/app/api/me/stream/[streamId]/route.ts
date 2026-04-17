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

// GET /api/me/stream/{streamId}
//
// Session-authenticated lookup for the in-site hls.js player. Returns the
// stream URL (with the user's credentials swapped in) plus enough channel
// metadata to render a "Now playing" header.
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

  const streamUrl = buildPerUserStreamUrl(
    channel,
    creds.xtremeUsername,
    creds.xtremePassword
  );

  return NextResponse.json({
    streamId: channel.streamId,
    name: channel.name,
    tvgName: channel.tvgName || null,
    tvgLogo: channel.tvgLogo || null,
    group: channel.group || null,
    streamUrl,
  });
}
