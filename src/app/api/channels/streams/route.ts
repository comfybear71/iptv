import { NextRequest, NextResponse } from "next/server";
import { getUserXtremeCreds } from "../_helpers";
import { fetchMyBunnyEntries } from "@/lib/mybunny-playlist";

export const revalidate = 1800; // 30 min ISR

const PAGE_SIZE = 80;

// GET /api/channels/streams?category_ids=USA%20Premium,Australia&search=cnn&page=1
//
// Streams come from MyBunny's M3U (not the thinner Xtream API). Each
// returned stream includes the EXACT url from the M3U — we use it AS-IS
// for playback so we don't rebuild URLs that MyBunny may not accept.
export async function GET(req: NextRequest) {
  const auth = await getUserXtremeCreds();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const categoryIdsRaw = searchParams.get("category_ids") || "";
  const search = (searchParams.get("search") || "").trim().toLowerCase();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const wanted = new Set(
    categoryIdsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  try {
    const entries = await fetchMyBunnyEntries(auth.creds);

    // Filter by group-title if any categories specified
    let filtered = entries;
    if (wanted.size > 0) {
      filtered = entries.filter((e) => wanted.has(e.group));
    }

    // Name search (case-insensitive)
    if (search) {
      filtered = filtered.filter((e) =>
        e.name.toLowerCase().includes(search)
      );
    }

    const total = filtered.length;
    const start = (page - 1) * PAGE_SIZE;
    const window = filtered.slice(start, start + PAGE_SIZE);

    const streams = window.map((e) => ({
      stream_id: e.streamId || 0,
      name: e.name,
      stream_icon: e.tvgLogo,
      category_id: e.group,
      epg_channel_id: e.tvgId || null,
      // Include the actual URL from MyBunny so the UI can use it AS-IS
      // for playback instead of rebuilding the URL and getting the
      // extension wrong for 24/7 channels.
      url: e.url,
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
