import { NextRequest, NextResponse } from "next/server";
import { getSeriesInfo } from "@/lib/xtream-vod";

export const revalidate = 0;
export const dynamic = "force-dynamic";

// GET /api/vod/series/{seriesId}
// Returns the series metadata + full season/episode tree.
export async function GET(
  _req: NextRequest,
  ctx: { params: { id: string } }
) {
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  try {
    const data = await getSeriesInfo(id);
    const info = data.info || ({} as typeof data.info);
    const seasons = Array.isArray(data.seasons) ? data.seasons : [];

    // Flatten + sort episodes by season then episode_num for clean UI.
    const episodesBySeason: Record<
      string,
      Array<{
        id: string;
        episodeNum: number;
        title: string;
        plot: string;
        poster: string;
        containerExt: string;
        directSource: string;
        durationSecs: number;
      }>
    > = {};
    for (const [seasonKey, list] of Object.entries(data.episodes || {})) {
      if (!Array.isArray(list)) continue;
      const sorted = [...list].sort((a, b) => a.episode_num - b.episode_num);
      episodesBySeason[seasonKey] = sorted.map((e) => ({
        id: e.id,
        episodeNum: e.episode_num,
        title: e.title,
        plot: e.info?.plot || "",
        poster: e.info?.movie_image || "",
        containerExt: e.container_extension,
        directSource: e.direct_source,
        durationSecs: e.info?.duration_secs || 0,
      }));
    }

    return NextResponse.json({
      seriesId: id,
      name: info.name || "",
      cover: info.cover || "",
      plot: info.plot || "",
      cast: info.cast || "",
      director: info.director || "",
      genre: info.genre || "",
      year: info.releaseDate
        ? parseInt(info.releaseDate, 10) || null
        : null,
      rating: parseFloat(info.rating || "0") || 0,
      youtubeTrailer: info.youtube_trailer || "",
      seasons: seasons.map((s) => ({
        seasonNumber: s.season_number,
        name: s.name,
        episodeCount: s.episode_count,
        cover: s.cover,
        overview: s.overview,
      })),
      episodesBySeason,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load series";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
