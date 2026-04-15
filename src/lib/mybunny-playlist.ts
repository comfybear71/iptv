/**
 * Fetches + parses MyBunny's full M3U playlist (the one served by
 * /client/download.php). We use the M3U instead of the Xtream API's
 * get_live_categories + get_live_streams because MyBunny serves a
 * richer catalog via the M3U — 180+ categories / 20k+ channels, vs.
 * only ~7 categories the Xtream API returns for our account.
 *
 * Stream URLs inside the M3U are used AS-IS for playback — they're the
 * format MyBunny actually expects, which differs between live channels
 * and 24/7 "created_live" content.
 */

import { parseM3u, M3uEntry } from "@/lib/m3u-parse";

export interface MyBunnyCreds {
  host: string;
  username: string;
  password: string;
}

/**
 * Raw M3U text from MyBunny. Cached for 30 min via Next.js ISR.
 * Each user's URL is distinct (username+password), so cache keys cleanly.
 */
async function fetchM3uText(creds: MyBunnyCreds): Promise<string> {
  const host = creds.host.replace(/\/$/, "");
  const url = `${host}/client/download.php?u=${encodeURIComponent(
    creds.username
  )}&p=${encodeURIComponent(creds.password)}`;

  const res = await fetch(url, {
    next: { revalidate: 1800 },
    headers: {
      "User-Agent": "TiviMate/4.8.0 (Linux; Android 11)",
      Accept: "application/x-mpegURL, application/octet-stream, text/plain, */*",
    },
  });
  if (!res.ok) {
    throw new Error(`MyBunny M3U download failed: ${res.status}`);
  }
  const text = await res.text();
  if (!text.trim().startsWith("#EXTM3U")) {
    throw new Error("MyBunny returned a non-M3U body");
  }
  return text;
}

export async function fetchMyBunnyEntries(
  creds: MyBunnyCreds
): Promise<M3uEntry[]> {
  const text = await fetchM3uText(creds);
  return parseM3u(text);
}

/**
 * Summarise the M3U into a sorted category list: { category_id (=group),
 * category_name, count } — matches the shape our UI expects.
 */
export interface M3uCategorySummary {
  category_id: string;
  category_name: string;
  count: number;
}

export function summariseCategories(
  entries: M3uEntry[]
): M3uCategorySummary[] {
  const counts: Record<string, number> = {};
  for (const e of entries) {
    const g = e.group || "Uncategorised";
    counts[g] = (counts[g] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => ({
      category_id: name,
      category_name: name,
      count,
    }))
    .sort((a, b) => a.category_name.localeCompare(b.category_name));
}
