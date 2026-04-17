/**
 * Squiggle API — free AFL fixtures + teams.
 *   https://api.squiggle.com.au
 *
 * No API key required. We cache responses for 1 hour since fixtures
 * update infrequently (once a day at most). The User-Agent header is
 * required by Squiggle's fair-use policy.
 */

const SQUIGGLE_BASE = "https://api.squiggle.com.au";
const SQUIGGLE_LOGO_BASE = "https://squiggle.com.au";

export interface SquiggleTeam {
  id: number;
  name: string;
  abbrev: string;
  logo: string;
}

export interface SquiggleGame {
  id: number;
  round: number;
  roundname: string;
  year: number;
  date: string;
  localtime: string;
  unixtime: number;
  venue: string;
  hteam: string;
  hteamid: number;
  ateam: string;
  ateamid: number;
  hscore: number | null;
  ascore: number | null;
  complete: number;
  is_final: number;
  is_grand_final: number;
  winner: string | null;
  tz: string;
}

async function fetchSquiggle<T>(path: string): Promise<T> {
  const res = await fetch(`${SQUIGGLE_BASE}/${path}`, {
    next: { revalidate: 3600 },
    headers: {
      "User-Agent": "ComfyTV/1.0 (https://comfytv.xyz; sfrench71@gmail.com)",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Squiggle API error: ${res.status}`);
  }
  return res.json();
}

let teamsCache: Map<number, SquiggleTeam> | null = null;

export async function fetchAflTeams(): Promise<Map<number, SquiggleTeam>> {
  if (teamsCache) return teamsCache;

  const data = await fetchSquiggle<{ teams: SquiggleTeam[] }>("?q=teams");
  const map = new Map<number, SquiggleTeam>();
  for (const t of data.teams || []) {
    map.set(t.id, {
      ...t,
      logo: t.logo.startsWith("http")
        ? t.logo
        : `${SQUIGGLE_LOGO_BASE}${t.logo}`,
    });
  }
  teamsCache = map;
  return map;
}

export async function fetchUpcomingAflGames(): Promise<SquiggleGame[]> {
  const now = new Date();
  const year = now.getFullYear();

  const data = await fetchSquiggle<{ games: SquiggleGame[] }>(
    `?q=games;year=${year};complete=0`
  );

  const games = (data.games || [])
    .filter((g) => g.complete === 0)
    .sort((a, b) => a.unixtime - b.unixtime);

  return games;
}

export interface AflFixture {
  id: number;
  round: number;
  roundname: string;
  date: string;
  localtime: string;
  unixtime: number;
  venue: string;
  homeTeam: string;
  homeTeamLogo: string | null;
  awayTeam: string;
  awayTeamLogo: string | null;
}

export async function fetchAflFixtures(): Promise<AflFixture[]> {
  const [games, teams] = await Promise.all([
    fetchUpcomingAflGames(),
    fetchAflTeams(),
  ]);

  return games.map((g) => {
    const home = teams.get(g.hteamid);
    const away = teams.get(g.ateamid);
    return {
      id: g.id,
      round: g.round,
      roundname: g.roundname,
      date: g.date,
      localtime: g.localtime,
      unixtime: g.unixtime,
      venue: g.venue,
      homeTeam: g.hteam,
      homeTeamLogo: home?.logo || null,
      awayTeam: g.ateam,
      awayTeamLogo: away?.logo || null,
    };
  });
}
