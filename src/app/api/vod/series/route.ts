import { NextRequest, NextResponse } from "next/server";
import {
  getSeriesByCategory,
  getSeriesCategories,
  XtreamSeries,
} from "@/lib/xtream-vod";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

// GET /api/vod/series?year=2025&genre=Crime&page=1
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const yearParam = sp.get("year") || "";
  const genreParam = (sp.get("genre") || "").toLowerCase().trim();
  const page = Math.max(parseInt(sp.get("page") || "1", 10), 1);

  try {
    const cats = await getSeriesCategories();

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
          series: [],
        });
      }
    } else {
      targetCats = cats.filter(
        (c) => c.category_name.toLowerCase() !== "latest series"
      );
    }

    const perCat = await Promise.all(
      targetCats.map((c) => getSeriesByCategory(c.category_id))
    );

    const seen = new Set<number>();
    const merged: XtreamSeries[] = [];
    for (const list of perCat) {
      for (const s of list) {
        if (seen.has(s.series_id)) continue;
        seen.add(s.series_id);
        merged.push(s);
      }
    }

    let filtered = merged;
    if (yearParam && yearParam !== "All") {
      const y = parseInt(yearParam, 10);
      if (Number.isFinite(y)) {
        filtered = filtered.filter((s) => {
          const sy = s.releaseDate ? parseInt(s.releaseDate, 10) : NaN;
          return sy === y;
        });
      }
    }

    filtered.sort((a, b) => Number(b.last_modified) - Number(a.last_modified));

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const start = (page - 1) * PAGE_SIZE;
    const slice = filtered.slice(start, start + PAGE_SIZE).map((s) => ({
      seriesId: s.series_id,
      name: s.name,
      year: s.releaseDate ? parseInt(s.releaseDate, 10) || null : null,
      cover: s.cover || null,
      rating: parseFloat(s.rating) || 0,
      genre: s.genre || "",
      lastModified: Number(s.last_modified),
    }));

    return NextResponse.json({
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages,
      series: slice,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load series";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
