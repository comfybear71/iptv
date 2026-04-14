/**
 * Build MyBunny.TV M3U URLs from Xtreme credentials.
 *
 * MyBunny encodes the username/password directly into the playlist URLs:
 *   Live TV:  {host}/client/download.php?u={user}&p={pass}
 *   Movies:   {host}/client/Movies.php?u={user}&p={pass}&s={size}
 *   Series:   {host}/client/Series.php?u={user}&p={pass}&s={size}
 *
 * Size (s=) controls the collection depth on Movies/Series:
 *   1 = Compact (~250), 2 = Standard (~500), 3 = Extensive (~1000), 4 = Complete (all)
 */

export type CollectionSize = 1 | 2 | 3 | 4;

export const COLLECTION_SIZES: {
  value: CollectionSize;
  label: string;
  description: string;
}[] = [
  { value: 1, label: "Compact", description: "~250 movies/series" },
  { value: 2, label: "Standard", description: "~500 movies/series (default)" },
  { value: 3, label: "Extensive", description: "~1,000 movies/series" },
  { value: 4, label: "Complete", description: "All available" },
];

export interface MyBunnyM3uUrls {
  liveTV: string;
  movies: string;
  series: string;
}

export function buildMyBunnyM3uUrls(
  host: string,
  username: string,
  password: string,
  size: CollectionSize = 2
): MyBunnyM3uUrls {
  if (!host || !username || !password) {
    return { liveTV: "", movies: "", series: "" };
  }
  const base = host.trim().replace(/\/$/, "");
  const u = encodeURIComponent(username.trim());
  const p = encodeURIComponent(password.trim());
  return {
    liveTV: `${base}/client/download.php?u=${u}&p=${p}`,
    movies: `${base}/client/Movies.php?u=${u}&p=${p}&s=${size}`,
    series: `${base}/client/Series.php?u=${u}&p=${p}&s=${size}`,
  };
}
