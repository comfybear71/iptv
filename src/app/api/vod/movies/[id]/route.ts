import { NextRequest, NextResponse } from "next/server";
import { getMovieInfo, parseYearFromTitle } from "@/lib/xtream-vod";

export const revalidate = 0;
export const dynamic = "force-dynamic";

// GET /api/vod/movies/{streamId}
// Detailed info for one movie — plot, cast, director, poster, etc.
export async function GET(
  _req: NextRequest,
  ctx: { params: { id: string } }
) {
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  try {
    const data = await getMovieInfo(id);
    const info = data.info || {};
    const movie = data.movie_data || null;
    if (!movie) {
      return NextResponse.json({ error: "Movie not found" }, { status: 404 });
    }
    return NextResponse.json({
      streamId: movie.stream_id,
      name: movie.name,
      year:
        parseYearFromTitle(movie.name) ||
        (info.releasedate ? parseInt(info.releasedate, 10) || null : null),
      poster: info.movie_image || "",
      backdrops: info.backdrop_path || [],
      plot: info.plot || "",
      cast: info.cast || "",
      director: info.director || "",
      genre: info.genre || "",
      rating: parseFloat(info.rating || "0") || 0,
      durationSecs: info.duration_secs || 0,
      tmdbId: info.tmdb_id || null,
      added: Number(movie.added),
      containerExt: movie.container_extension,
      directSource: movie.direct_source,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load movie";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
