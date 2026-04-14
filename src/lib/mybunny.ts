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

/**
 * Filtered VOD URLs — Movies / Series with optional year + genre filter.
 *   {host}/client/Movies.php?u=...&p=...&s=SIZE&year=YEAR&genre=GENRE
 *   {host}/client/Series.php?u=...&p=...&s=SIZE&year=YEAR&genre=GENRE
 */
export function buildFilteredMoviesUrl(params: {
  host?: string;
  username?: string;
  password?: string;
  size?: CollectionSize;
  year?: string;
  genre?: string;
}): string {
  return buildVodUrl({ ...params, kind: "Movies" });
}

export function buildFilteredSeriesUrl(params: {
  host?: string;
  username?: string;
  password?: string;
  size?: CollectionSize;
  year?: string;
  genre?: string;
}): string {
  return buildVodUrl({ ...params, kind: "Series" });
}

function buildVodUrl(params: {
  kind: "Movies" | "Series";
  host?: string;
  username?: string;
  password?: string;
  size?: CollectionSize;
  year?: string;
  genre?: string;
}): string {
  if (!params.host || !params.username || !params.password) return "";
  const base = params.host.trim().replace(/\/$/, "");
  const u = encodeURIComponent(params.username.trim());
  const p = encodeURIComponent(params.password.trim());
  const size = params.size || 2;
  let url = `${base}/client/${params.kind}.php?u=${u}&p=${p}&s=${size}`;
  if (params.year && params.year !== "All") {
    url += `&year=${encodeURIComponent(params.year)}`;
  }
  if (params.genre && params.genre !== "All") {
    url += `&genre=${encodeURIComponent(params.genre)}`;
  }
  return url;
}

/**
 * Hot Channels — same as Live TV with &trending=1 appended.
 */
export function buildHotChannelsUrl(
  host: string | undefined,
  username: string | undefined,
  password: string | undefined
): string {
  if (!host || !username || !password) return "";
  const base = host.trim().replace(/\/$/, "");
  const u = encodeURIComponent(username.trim());
  const p = encodeURIComponent(password.trim());
  return `${base}/client/download.php?u=${u}&p=${p}&trending=1`;
}

/**
 * EPG (TV guide) URL — http://epg.mybunny.tv/btv/USER/PASS/PASS
 * (yes, password appears twice as per MyBunny's pattern)
 */
export function buildEpgUrl(
  username: string | undefined,
  password: string | undefined
): string {
  if (!username || !password) return "";
  return `http://epg.mybunny.tv/btv/${username}/${password}/${password}`;
}

// Common filter values for VOD pages — can be overridden by the user.
export const VOD_YEARS: string[] = [
  "All",
  "2026",
  "2025",
  "2024",
  "2023",
  "2022",
  "2021",
  "2020",
  "2019",
  "2018",
  "2017",
  "2016",
  "2015",
];

export const MOVIE_GENRES: string[] = [
  "All",
  "Action",
  "Adventure",
  "Animation",
  "Biography",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Thriller",
  "Other",
];

export const SERIES_GENRES: string[] = [
  "All",
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "Kids",
  "Mystery",
  "Politics",
  "Reality",
  "Sci-Fi",
  "Talk",
  "Other",
];

/**
 * Hardcoded list of MyBunny live-TV channel categories (no API to fetch).
 * Approximate counts as of MyBunny's portal — for display only.
 */
export const CHANNEL_CATEGORIES: { name: string; count: number; flag?: string }[] = [
  { name: "USA Premium", count: 129, flag: "🇺🇸" },
  { name: "PPV Live Events", count: 888, flag: "🥊" },
  { name: "US Sports", count: 777, flag: "🏈" },
  { name: "US News", count: 735, flag: "📰" },
  { name: "United States", count: 6610, flag: "🇺🇸" },
  { name: "United Kingdom", count: 1149, flag: "🇬🇧" },
  { name: "Canada", count: 1087, flag: "🇨🇦" },
  { name: "24/7 Streams", count: 1590, flag: "📺" },
  { name: "Portugal", count: 783, flag: "🇵🇹" },
  { name: "Latino", count: 2205, flag: "🌎" },
  { name: "Germany", count: 503, flag: "🇩🇪" },
  { name: "Turkey", count: 543, flag: "🇹🇷" },
  { name: "ESP Spain", count: 849, flag: "🇪🇸" },
  { name: "US Movies", count: 427, flag: "🎬" },
  { name: "UK Entertainment", count: 1149, flag: "🇬🇧" },
  { name: "Mexico", count: 490, flag: "🇲🇽" },
  { name: "Flo Sports", count: 351, flag: "🏟️" },
  { name: "US Entertainment", count: 2625, flag: "📺" },
];
