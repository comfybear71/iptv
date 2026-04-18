import { NextRequest, NextResponse } from "next/server";
import {
  getMovieCategories,
  getMoviesByCategory,
  parseYearFromTitle,
  XtreamMovie,
} from "@/lib/xtream-vod";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

// GET /api/vod/movies?year=2025&genre=Crime&page=1
//
// Filterable movie list. Year is optional (matches parsed year from name).
// Genre is optional (matches a category name, case-insensitive). If neither
// is supplied, returns the union of all non-"Latest" categories.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const yearParam = sp.get("year") || "";
  const genreParam = (sp.get("genre") || "").toLowerCase().trim();
  const page = Math.max(parseInt(sp.get("page") || "1", 10), 1);

  try {
    const cats = await getMovieCategories();

    // Decide which categories to pull from.
    let targetCats = cats;
    if (genreParam && genreParam !== "all") {
      targetCats = cats.filter(
        (c) => c.category_name.toLowerCase() === genreParam
      );
      if (targetCats.length === 0) {
        return NextResponse.json({
          total: 0,
          page,
          pageSize: PAGE_SIZE,
          totalPages: 0,
          movies: [],
        });
      }
    } else {
      // Skip the generic "Latest Movies" bucket when browsing all genres —
      // those movies already appear in their genre-specific categories.
      targetCats = cats.filter(
        (c) => c.category_name.toLowerCase() !== "latest movies"
      );
    }

    // Fetch each category in parallel (cached, so cheap).
    const perCat = await Promise.all(
      targetCats.map((c) => getMoviesByCategory(c.category_id))
    );

    // Dedupe by stream_id (movies appear in multiple categories).
    const seen = new Set<number>();
    const merged: XtreamMovie[] = [];
    for (const list of perCat) {
      for (const m of list) {
        if (seen.has(m.stream_id)) continue;
        seen.add(m.stream_id);
        merged.push(m);
      }
    }

    // Year filter — parsed from title.
    let filtered = merged;
    if (yearParam && yearParam !== "All") {
      const targetYear = parseInt(yearParam, 10);
      if (Number.isFinite(targetYear)) {
        filtered = filtered.filter(
          (m) => parseYearFromTitle(m.name) === targetYear
        );
      }
    }

    // Newest first within the result set.
    filtered.sort((a, b) => Number(b.added) - Number(a.added));

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const start = (page - 1) * PAGE_SIZE;
    const slice = filtered.slice(start, start + PAGE_SIZE).map((m) => ({
      streamId: m.stream_id,
      name: m.name,
      year: parseYearFromTitle(m.name),
      poster: m.stream_icon || null,
      rating: parseFloat(m.rating) || 0,
      added: Number(m.added),
      containerExt: m.container_extension,
    }));

    return NextResponse.json({
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages,
      movies: slice,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load movies";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
