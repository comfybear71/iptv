/**
 * Curated sport definitions for /dashboard/sports.
 *
 * Each sport has:
 *  - label + emoji for the tile
 *  - keywords: regex-style name fragments we match against channel names
 *    (case-insensitive, any match wins)
 *  - categoryHints: category-name substrings that should be auto-included
 *    so we don't miss channels that are inside a category but named oddly
 *
 * Matching runs in the browser against the full /api/channels/streams
 * response once the user picks a sport.
 */

export interface SportDef {
  id: string;
  label: string;
  emoji: string;
  blurb: string;
  keywords: string[];
  /** Category-name substrings — any stream whose category name matches
   *  these will ALSO be included even if the channel name doesn't. */
  categoryHints: string[];
  /** Accent Tailwind classes for the tile */
  accent: string;
  /** TheSportsDB league IDs for upcoming events. Multiple IDs get merged. */
  tsdbLeagueIds?: string[];
  /** Friendly hint about which MyBunny channel usually carries this sport */
  channelHint?: string;
}

export const SPORTS: SportDef[] = [
  {
    id: "afl",
    label: "AFL",
    emoji: "🏉",
    blurb: "Aussie Rules — Fox Footy, Kayo, 7mate",
    keywords: ["afl", "aussie rules", "fox footy", "afl nation", "afl channel"],
    categoryHints: ["australia", "au sports", "aus sports"],
    accent: "from-red-700 to-orange-700",
    tsdbLeagueIds: ["4449"],
    channelHint: "Fox Footy HD / Kayo AFL",
  },
  {
    id: "nrl",
    label: "NRL / Rugby League",
    emoji: "🏉",
    blurb: "Rugby League — Fox League, NRL on Nine",
    keywords: ["nrl", "rugby league", "fox league", "league live"],
    categoryHints: ["australia", "au sports", "rugby"],
    accent: "from-lime-700 to-emerald-700",
    tsdbLeagueIds: ["4418"],
    channelHint: "Fox League HD / Kayo NRL",
  },
  {
    id: "rugby",
    label: "Rugby Union",
    emoji: "🏉",
    blurb: "Super Rugby, Wallabies, Six Nations",
    keywords: [
      "rugby union",
      "super rugby",
      "wallabies",
      "stan sport",
      "rugby pass",
      "rfu",
    ],
    categoryHints: ["rugby", "au sports"],
    accent: "from-emerald-700 to-teal-700",
    tsdbLeagueIds: ["4414"],
    channelHint: "Stan Sport / Sky Sports Rugby",
  },
  {
    id: "epl",
    label: "Soccer / EPL",
    emoji: "⚽",
    blurb: "Premier League, Champions League, A-League",
    keywords: [
      "premier league",
      "epl",
      "champions league",
      "soccer",
      "football",
      "la liga",
      "bundesliga",
      "serie a",
      "mls",
      "a-league",
      "a league",
      "fa cup",
      "uefa",
    ],
    categoryHints: ["soccer", "football", "la liga", "premier", "uefa"],
    accent: "from-blue-700 to-indigo-700",
    tsdbLeagueIds: ["4328", "4480", "4356", "4335", "4331", "4332"],
    channelHint: "Sky Sports Football / Paramount+",
  },
  {
    id: "ufc",
    label: "UFC / MMA",
    emoji: "🥋",
    blurb: "UFC events, MMA cards, Fight Pass",
    keywords: [
      "ufc",
      "mma",
      "fight pass",
      "bellator",
      "cage warriors",
      "one championship",
    ],
    categoryHints: ["ppv", "fighting", "combat"],
    accent: "from-red-700 to-rose-700",
    tsdbLeagueIds: ["4443"],
    channelHint: "UFC HD / PPV — lights up near event time",
  },
  {
    id: "boxing",
    label: "Boxing / PPV",
    emoji: "🥊",
    blurb: "Major title fights, PPV events",
    keywords: [
      "boxing",
      "ppv",
      "main event",
      "title fight",
      "fury",
      "joshua",
      "tyson",
      "canelo",
    ],
    categoryHints: ["ppv", "boxing", "fighting"],
    accent: "from-amber-700 to-red-700",
    channelHint: "Main Event HD / PPV",
  },
  {
    id: "nfl",
    label: "NFL",
    emoji: "🏈",
    blurb: "NFL games, RedZone, Sunday Ticket",
    keywords: [
      "nfl",
      "redzone",
      "sunday ticket",
      "monday night football",
      "thursday night football",
      "super bowl",
    ],
    categoryHints: ["us sports", "nfl"],
    accent: "from-blue-800 to-sky-700",
    tsdbLeagueIds: ["4391"],
    channelHint: "ESPN / NFL Network / RedZone",
  },
  {
    id: "nba",
    label: "NBA",
    emoji: "🏀",
    blurb: "NBA League Pass, TNT, ESPN games",
    keywords: ["nba", "nba tv", "league pass", "basketball"],
    categoryHints: ["us sports", "basketball"],
    accent: "from-orange-700 to-amber-700",
    tsdbLeagueIds: ["4387"],
    channelHint: "NBA TV / ESPN / TNT",
  },
  {
    id: "golf",
    label: "Golf",
    emoji: "⛳",
    blurb: "PGA Tour, LIV, The Masters, Open",
    keywords: ["golf", "pga", "liv golf", "masters", "the open", "ryder cup"],
    categoryHints: ["golf"],
    accent: "from-green-700 to-emerald-800",
    tsdbLeagueIds: ["4425"],
    channelHint: "Golf Channel HD / Sky Sports Golf",
  },
  {
    id: "cricket",
    label: "Cricket",
    emoji: "🏏",
    blurb: "BBL, IPL, Test cricket, T20",
    keywords: [
      "cricket",
      "bbl",
      "big bash",
      "ipl",
      "test match",
      "t20",
      "the ashes",
      "willow",
    ],
    categoryHints: ["cricket", "willow"],
    accent: "from-purple-700 to-fuchsia-700",
    tsdbLeagueIds: ["4432", "4450"],
    channelHint: "Fox Cricket / Willow / Sky Sports Cricket",
  },
  {
    id: "motorsport",
    label: "Motorsport",
    emoji: "🏎️",
    blurb: "F1, NASCAR, MotoGP, V8 Supercars",
    keywords: [
      "formula",
      " f1",
      "motogp",
      "nascar",
      "v8 supercars",
      "indycar",
      "wrc",
      "rally",
    ],
    categoryHints: ["motor", "racing"],
    accent: "from-slate-700 to-zinc-700",
    tsdbLeagueIds: ["4370", "4407"],
    channelHint: "Fox Sports 506 / Sky Sports F1",
  },
  {
    id: "tennis",
    label: "Tennis",
    emoji: "🎾",
    blurb: "ATP, WTA, Grand Slams",
    keywords: [
      "tennis",
      "atp",
      "wta",
      "wimbledon",
      "us open",
      "roland garros",
      "australian open",
    ],
    categoryHints: ["tennis"],
    accent: "from-yellow-700 to-lime-700",
    tsdbLeagueIds: ["4464"],
    channelHint: "Tennis Channel HD / Eurosport",
  },
];

export interface StreamForFilter {
  stream_id: number;
  name: string;
  stream_icon: string;
  category_id: string;
  epg_channel_id: string | null;
  /** Direct playback URL straight from MyBunny's M3U — used AS-IS */
  url?: string;
}

export interface CategoryForFilter {
  category_id: string;
  category_name: string;
}

/**
 * Filter a list of streams down to those that plausibly carry a given sport.
 */
export function filterStreamsForSport(
  sport: SportDef,
  streams: StreamForFilter[],
  categories: CategoryForFilter[]
): StreamForFilter[] {
  const catById: Record<string, string> = {};
  for (const c of categories) catById[c.category_id] = c.category_name.toLowerCase();

  const keywords = sport.keywords.map((k) => k.toLowerCase());
  const catHints = sport.categoryHints.map((k) => k.toLowerCase());

  return streams.filter((s) => {
    const name = (s.name || "").toLowerCase();
    if (keywords.some((k) => name.includes(k))) return true;

    const catName = catById[s.category_id] || "";
    if (catHints.some((h) => catName.includes(h))) {
      // Category match alone isn't enough — we also need *some* hint the
      // channel is sports-related; otherwise e.g. every AU channel would
      // match "AFL". Require at least one keyword OR a sport-ish category.
      if (catName.includes("sport") || catName.includes("ppv")) return true;
      // Or check if channel name has any sport-ish word
      if (/sport|match|game|live|hd|tv/.test(name)) return true;
    }
    return false;
  });
}
