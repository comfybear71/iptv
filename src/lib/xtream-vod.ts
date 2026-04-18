/**
 * MyBunny Xtream API — VOD helpers.
 *
 * We don't persist VOD to Mongo. Everything goes straight to MyBunny's
 * player_api.php and is cached in Upstash Redis (1h for list endpoints,
 * 24h for per-item detail). This is the MVP approach for 5 users; if
 * it grows we'll move to a Mongo catalog with admin-triggered refresh.
 *
 * All fetches use the MASTER account credentials (MYBUNNY_MASTER_USERNAME
 * / _PASSWORD). Per-user playback URLs are built by swapping the logged-
 * in user's Xtream creds into the path and HMAC-signing through the
 * droplet proxy — same pattern as live TV.
 */

import { DEFAULT_XTREME_HOST } from "./mybunny";
import { getOrSet } from "./redis";

// ---------- Shapes returned by Xtream ----------

export interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface XtreamMovie {
  num?: number;
  name: string;
  stream_type?: string;
  stream_id: number;
  stream_icon: string; // Poster URL (may be empty)
  rating: string;
  rating_5based: number;
  added: string; // Unix seconds as string
  category_id: string;
  category_ids: number[];
  container_extension: string; // e.g. "mp4"
  custom_sid?: string;
  direct_source: string; // Full stream URL with master creds
}

export interface XtreamMovieInfo {
  info: {
    movie_image: string;
    name: string;
    plot: string;
    cast: string;
    director: string;
    genre: string;
    releasedate: string;
    rating: string;
    rating_5based: number;
    duration_secs: number;
    duration: string;
    backdrop_path: string[];
    tmdb_id: string;
  };
  movie_data: {
    stream_id: number;
    name: string;
    added: string;
    category_id: string;
    container_extension: string;
    custom_sid: string;
    direct_source: string;
  };
}

export interface XtreamSeries {
  num?: number;
  series_id: number;
  name: string;
  cover: string;
  plot: string;
  cast: string;
  director: string;
  genre: string;
  releaseDate: string;
  last_modified: string;
  rating: string;
  rating_5based: number;
  youtube_trailer: string;
  episode_run_time: string;
  category_id: string;
  category_ids: number[];
  backdrop_path: string[];
}

export interface XtreamEpisode {
  id: string;
  episode_num: number;
  title: string;
  container_extension: string;
  info: {
    movie_image: string;
    plot: string;
    releasedate: string;
    rating: string;
    duration_secs: number;
    duration: string;
  };
  custom_sid?: string;
  added: string;
  season: number;
  direct_source: string;
}

export interface XtreamSeasonMeta {
  season_number: number;
  name: string;
  episode_count: number;
  cover: string;
  overview: string;
}

export interface XtreamSeriesInfo {
  seasons: XtreamSeasonMeta[];
  info: XtreamSeries;
  episodes: Record<string, XtreamEpisode[]>; // keyed by season number as string
}

// ---------- Fetch helpers ----------

function masterCreds(): { username: string; password: string } {
  const username = process.env.MYBUNNY_MASTER_USERNAME;
  const password = process.env.MYBUNNY_MASTER_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "MYBUNNY_MASTER_USERNAME / _PASSWORD not set — can't query VOD"
    );
  }
  return { username, password };
}

async function xtreamJson<T>(action: string, extra: Record<string, string | number> = {}): Promise<T> {
  const { username, password } = masterCreds();
  const url = new URL(`${DEFAULT_XTREME_HOST.replace(/\/$/, "")}/player_api.php`);
  url.searchParams.set("username", username);
  url.searchParams.set("password", password);
  url.searchParams.set("action", action);
  for (const [k, v] of Object.entries(extra)) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      "User-Agent": "TiviMate/4.8.0 (Linux; Android 11)",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Xtream ${action} HTTP ${res.status}`);
  return (await res.json()) as T;
}

// ---------- Public cached fetchers ----------

const ONE_HOUR = 60 * 60;
const ONE_DAY = 24 * ONE_HOUR;

export function getMovieCategories(): Promise<XtreamCategory[]> {
  return getOrSet("vod:cat:movies", ONE_HOUR, async () => {
    const data = await xtreamJson<XtreamCategory[]>("get_vod_categories");
    return Array.isArray(data) ? data : [];
  });
}

export function getSeriesCategories(): Promise<XtreamCategory[]> {
  return getOrSet("vod:cat:series", ONE_HOUR, async () => {
    const data = await xtreamJson<XtreamCategory[]>("get_series_categories");
    return Array.isArray(data) ? data : [];
  });
}

export function getMoviesByCategory(categoryId: string): Promise<XtreamMovie[]> {
  return getOrSet(`vod:movies:cat:${categoryId}`, ONE_HOUR, async () => {
    const data = await xtreamJson<XtreamMovie[]>("get_vod_streams", {
      category_id: categoryId,
    });
    return Array.isArray(data) ? data : [];
  });
}

export function getSeriesByCategory(categoryId: string): Promise<XtreamSeries[]> {
  return getOrSet(`vod:series:cat:${categoryId}`, ONE_HOUR, async () => {
    const data = await xtreamJson<XtreamSeries[]>("get_series", {
      category_id: categoryId,
    });
    return Array.isArray(data) ? data : [];
  });
}

export function getMovieInfo(vodId: number): Promise<XtreamMovieInfo> {
  return getOrSet(`vod:movies:info:${vodId}`, ONE_DAY, async () => {
    return xtreamJson<XtreamMovieInfo>("get_vod_info", { vod_id: vodId });
  });
}

export function getSeriesInfo(seriesId: number): Promise<XtreamSeriesInfo> {
  return getOrSet(`vod:series:info:${seriesId}`, ONE_DAY, async () => {
    return xtreamJson<XtreamSeriesInfo>("get_series_info", {
      series_id: seriesId,
    });
  });
}

// ---------- Derived helpers ----------

/**
 * Parse a 4-digit year from a movie title like "Murder At The Embassy (2025)".
 * Returns null if no year found. Used for the year filter UI — movies
 * without a detectable year are simply excluded from year-filter results.
 */
export function parseYearFromTitle(title: string): number | null {
  const m = /\((\d{4})\)\s*$/.exec(title.trim());
  if (!m) return null;
  const y = Number(m[1]);
  if (!Number.isFinite(y) || y < 1900 || y > 2100) return null;
  return y;
}

/**
 * Strip the "(YYYY)" suffix from a title so the UI can show a cleaner name
 * with the year rendered separately.
 */
export function cleanTitle(title: string): string {
  return title.replace(/\s*\(\d{4}\)\s*$/, "").trim();
}

/**
 * Given a raw upstream URL (e.g.
 * `http://turbobunny.net/movie/gfjxcfhq/JYdAbstckXde/<hash>`) and the
 * logged-in user's Xtream creds, return the URL we'd actually play for
 * them — same host, same hash, but creds swapped. Used before HMAC-signing
 * for the droplet proxy.
 *
 * Returns null if the upstream URL doesn't match the expected
 * `{scheme}://{host}/{kind}/{user}/{pass}/{hash}` shape.
 */
export function buildPerUserVodUrl(
  directSource: string,
  username: string,
  password: string
): string | null {
  try {
    const u = new URL(directSource);
    const parts = u.pathname.split("/").filter(Boolean);
    // Expect ["movie"|"series", user, pass, hash]
    if (parts.length < 4) return null;
    const kind = parts[0];
    if (kind !== "movie" && kind !== "series") return null;
    const hash = parts.slice(3).join("/"); // in case hash has slashes (unlikely)
    return `${u.protocol}//${u.host}/${kind}/${encodeURIComponent(
      username
    )}/${encodeURIComponent(password)}/${hash}`;
  } catch {
    return null;
  }
}
