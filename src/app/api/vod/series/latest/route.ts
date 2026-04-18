import { NextRequest, NextResponse } from "next/server";
import {
  getSeriesByCategory,
  getSeriesCategories,
} from "@/lib/xtream-vod";

export const revalidate = 0;
export const dynamic = "force-dynamic";

// GET /api/vod/series/latest?limit=12
// Returns the most recently modified series (uses Xtream "last_modified").
// Posters-only so the UI has something to render.
export async function GET(req: NextRequest) {
  const limit = Math.min(
    Math.max(parseInt(req.nextUrl.searchParams.get("limit") || "12", 10), 1),
    30
  );
  try {
    const cats = await getSeriesCategories();
    const latestCat = cats.find(
      (c) => c.category_name.toLowerCase() === "latest series"
    );
    const categoryId = latestCat?.category_id || "1";

    const series = await getSeriesByCategory(categoryId);
    const withCovers = series
      .filter((s) => s.cover && s.cover.trim().length > 0)
      .sort((a, b) => Number(b.last_modified) - Number(a.last_modified))
      .slice(0, limit)
      .map((s) => ({
        seriesId: s.series_id,
        name: s.name,
        year: s.releaseDate ? parseInt(s.releaseDate, 10) || null : null,
        cover: s.cover,
        rating: parseFloat(s.rating) || 0,
        genre: s.genre || "",
        lastModified: Number(s.last_modified),
      }));

    return NextResponse.json({ series: withCovers });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load latest series";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
