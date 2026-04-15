/**
 * MyBunny.TV uses the standard Xtream Codes panel API.
 *
 *   Base:           {host}/player_api.php?username=USER&password=PASS&action=ACTION
 *
 * We use these endpoints server-side only so credentials never hit the browser.
 * Responses are cached via Next.js fetch revalidation (30 min) — the channel
 * list rarely changes.
 *
 * Docs / reference:
 *   https://xtream-codes.com/api-documentation (panel vendor)
 */

export interface XtreamCredentials {
  host: string; // e.g. https://mybunny.tv
  username: string;
  password: string;
}

export interface XtreamLiveCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface XtreamLiveStream {
  stream_id: number;
  name: string;
  stream_icon: string;
  stream_type: string;
  epg_channel_id: string | null;
  category_id: string;
  added: string;
  is_adult?: string;
  tv_archive?: number;
  tv_archive_duration?: number;
}

const CACHE_TTL_SECONDS = 30 * 60; // 30 min edge cache

function buildApiUrl(creds: XtreamCredentials, action: string, params: Record<string, string> = {}): string {
  const base = creds.host.trim().replace(/\/$/, "");
  const search = new URLSearchParams({
    username: creds.username,
    password: creds.password,
    action,
    ...params,
  });
  return `${base}/player_api.php?${search.toString()}`;
}

async function fetchXtream<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    next: { revalidate: CACHE_TTL_SECONDS },
    // UA ≈ TiviMate to avoid any anti-bot filters
    headers: { "User-Agent": "ComfyTV/1.0 (+https://comfytv.xyz)" },
  });
  if (!res.ok) {
    throw new Error(`Xtream API ${res.status}: ${res.statusText}`);
  }
  const text = await res.text();
  // Some panels return an empty string on invalid creds — guard JSON parse
  if (!text.trim()) {
    throw new Error("Xtream API returned empty body — check credentials");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Xtream API returned non-JSON: ${text.slice(0, 120)}…`);
  }
}

export function fetchXtreamLiveCategories(
  creds: XtreamCredentials
): Promise<XtreamLiveCategory[]> {
  return fetchXtream<XtreamLiveCategory[]>(
    buildApiUrl(creds, "get_live_categories")
  );
}

export function fetchXtreamLiveStreams(
  creds: XtreamCredentials,
  categoryId?: string
): Promise<XtreamLiveStream[]> {
  const params: Record<string, string> = categoryId
    ? { category_id: categoryId }
    : {};
  return fetchXtream<XtreamLiveStream[]>(
    buildApiUrl(creds, "get_live_streams", params)
  );
}

/**
 * Build a direct playback URL for a live stream. HLS (.m3u8) is preferred
 * for in-browser playback; MPEGTS (.ts) is needed for VLC / native apps.
 */
export function buildLiveStreamUrl(
  creds: XtreamCredentials,
  streamId: number,
  ext: "m3u8" | "ts" = "m3u8"
): string {
  const base = creds.host.trim().replace(/\/$/, "");
  const u = encodeURIComponent(creds.username);
  const p = encodeURIComponent(creds.password);
  return `${base}/live/${u}/${p}/${streamId}.${ext}`;
}
