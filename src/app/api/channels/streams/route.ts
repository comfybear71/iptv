import { NextRequest, NextResponse } from "next/server";
import { getUserXtremeCreds } from "../_helpers";
import { buildPerUserStreamUrl, queryChannels } from "@/lib/channel-catalog";

export const revalidate = 0;

const PAGE_SIZE = 80;

// GET /api/channels/streams?category_ids=USA%20Premium&search=cnn&page=1
//
// Returns channels from the master catalog (MongoDB). Each stream's `url` is
// built on the fly by swapping the logged-in user's credentials into the
// stream URL pattern — so playback always goes through MyBunny authenticated
// as the user, not as the master account.
export async function GET(req: NextRequest) {
  const auth = await getUserXtremeCreds();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const category = (searchParams.get("category_ids") || "").trim() || null;
  const search = (searchParams.get("search") || "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  try {
    const { total, rows } = await queryChannels({
      category,
      search,
      page,
      pageSize: PAGE_SIZE,
    });

    const streams = rows.map((r) => ({
      stream_id: r.streamId,
      name: r.name,
      tvg_name: r.tvgName,
      stream_icon: r.tvgLogo,
      category_id: r.group,
      epg_channel_id: r.tvgId || null,
      url: buildPerUserStreamUrl(r, auth.creds.username, auth.creds.password),
    }));

    return NextResponse.json({
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      streams,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch streams";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
