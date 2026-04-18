import { NextRequest, NextResponse } from "next/server";
import { getMovieCategories, getSeriesCategories } from "@/lib/xtream-vod";

export const revalidate = 0;
export const dynamic = "force-dynamic";

// GET /api/vod/categories/movies
// GET /api/vod/categories/series
//
// Returns the Xtream category list for VOD movies or series. Public (no
// auth) — these are generic genre labels, not user-specific. Cached 1h.
export async function GET(
  _req: NextRequest,
  ctx: { params: { kind: string } }
) {
  const kind = ctx.params.kind;
  try {
    const cats =
      kind === "movies"
        ? await getMovieCategories()
        : kind === "series"
          ? await getSeriesCategories()
          : null;
    if (!cats) {
      return NextResponse.json(
        { error: "kind must be 'movies' or 'series'" },
        { status: 400 }
      );
    }
    return NextResponse.json({ categories: cats });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load categories";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
