import { NextRequest, NextResponse } from "next/server";
import {
  getMovieCategories,
  getMoviesByCategory,
  parseYearFromTitle,
} from "@/lib/xtream-vod";

export const revalidate = 0;
export const dynamic = "force-dynamic";

// GET /api/vod/movies/latest?limit=12
// Returns the most recently added movies (by Xtream "added" timestamp).
// Only movies with a poster are included so the UI has something to show.
export async function GET(req: NextRequest) {
  const limit = Math.min(
    Math.max(parseInt(req.nextUrl.searchParams.get("limit") || "12", 10), 1),
    30
  );

  try {
    // "Latest Movies" is conventionally category_id 1 on Xtream panels,
    // but to be robust we look it up by name first and fall back to "1".
    const cats = await getMovieCategories();
    const latestCat = cats.find(
      (c) => c.category_name.toLowerCase() === "latest movies"
    );
    const categoryId = latestCat?.category_id || "1";

    const movies = await getMoviesByCategory(categoryId);
    const withPosters = movies
      .filter((m) => m.stream_icon && m.stream_icon.trim().length > 0)
      .sort((a, b) => Number(b.added) - Number(a.added))
      .slice(0, limit)
      .map((m) => ({
        streamId: m.stream_id,
        name: m.name,
        year: parseYearFromTitle(m.name),
        poster: m.stream_icon,
        rating: parseFloat(m.rating) || 0,
        added: Number(m.added),
        containerExt: m.container_extension,
        directSource: m.direct_source,
      }));

    return NextResponse.json({ movies: withPosters });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load latest movies";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
