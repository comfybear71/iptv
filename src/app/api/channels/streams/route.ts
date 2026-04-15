import { NextRequest, NextResponse } from "next/server";
import { fetchXtreamLiveStreams, XtreamLiveStream } from "@/lib/xtream";
import { getUserXtremeCreds } from "../_helpers";

export const revalidate = 1800; // 30 min ISR

const PAGE_SIZE = 80;

// GET /api/channels/streams?category_ids=1,2,3&search=cnn&page=1
// - category_ids: comma-separated list. If omitted → all channels.
// - search: case-insensitive name match
// - page: 1-indexed
export async function GET(req: NextRequest) {
  const auth = await getUserXtremeCreds();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const categoryIdsRaw = searchParams.get("category_ids") || "";
  const search = (searchParams.get("search") || "").trim().toLowerCase();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const categoryIds = categoryIdsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    // Fetch streams for the requested categories in parallel. If no
    // categories are requested, fetch everything in one call.
    let all: XtreamLiveStream[];
    if (categoryIds.length === 0) {
      all = await fetchXtreamLiveStreams(auth.creds);
    } else if (categoryIds.length === 1) {
      all = await fetchXtreamLiveStreams(auth.creds, categoryIds[0]);
    } else {
      const results = await Promise.all(
        categoryIds.map((id) => fetchXtreamLiveStreams(auth.creds, id))
      );
      all = results.flat();
    }

    // Optional search filter on channel name
    const filtered = search
      ? all.filter((s) => s.name.toLowerCase().includes(search))
      : all;

    const total = filtered.length;
    const start = (page - 1) * PAGE_SIZE;
    const streams = filtered.slice(start, start + PAGE_SIZE);

    return NextResponse.json({
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      streams,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to fetch streams" },
      { status: 502 }
    );
  }
}
