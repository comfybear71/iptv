/**
 * Build MyBunny.TV M3U URLs from Xtreme credentials.
 *
 * MyBunny encodes the username/password directly into playlist URLs:
 *   Hot Channels: {host}/client/download.php?u={user}&p={pass}&trending=1
 *   Live TV:      {host}/client/download.php?u={user}&p={pass}
 *   Movies:       {host}/client/Movies.php?u={user}&p={pass}&s={size}
 *   Series:       {host}/client/Series.php?u={user}&p={pass}&s={size}
 *
 * Size controls Movies/Series collection depth:
 *   1=Compact (~250), 2=Standard (~500), 3=Extensive (~1000), 4=Complete (all)
 */

export type CollectionSize = 1 | 2 | 3 | 4;

export const COLLECTION_SIZES: {
  value: CollectionSize;
  label: string;
  description: string;
}[] = [
  { value: 1, label: "Compact", description: "~250 titles" },
  { value: 2, label: "Standard", description: "~500 titles (default)" },
  { value: 3, label: "Extensive", description: "~1,000 titles" },
  { value: 4, label: "Complete", description: "All titles" },
];

export interface MyBunnyM3uUrls {
  hotChannels: string;
  liveTV: string;
  movies: string;
  series: string;
}

export const DEFAULT_XTREME_HOST = "https://mybunny.tv";

export function buildMyBunnyM3uUrls(
  host: string | undefined,
  username: string | undefined,
  password: string | undefined,
  size: CollectionSize = 2
): MyBunnyM3uUrls {
  if (!host || !username || !password) {
    return { hotChannels: "", liveTV: "", movies: "", series: "" };
  }
  const base = host.trim().replace(/\/$/, "");
  const u = encodeURIComponent(username.trim());
  const p = encodeURIComponent(password.trim());
  return {
    hotChannels: `${base}/client/download.php?u=${u}&p=${p}&trending=1`,
    liveTV: `${base}/client/download.php?u=${u}&p=${p}`,
    movies: `${base}/client/Movies.php?u=${u}&p=${p}&s=${size}`,
    series: `${base}/client/Series.php?u=${u}&p=${p}&s=${size}`,
  };
}

/**
 * Wrap an M3U URL in webplayer.online so the user can watch in-browser.
 */
export function buildWebPlayerUrl(m3uUrl: string | undefined): string {
  if (!m3uUrl) return "";
  return `http://webplayer.online/?url=${encodeURIComponent(m3uUrl)}`;
}
