/**
 * TheSportsDB — free fixtures/events API
 *   https://www.thesportsdb.com/api.php
 *
 * Free API key "3" allows unlimited calls for public endpoints. We cache
 * responses aggressively because the free tier has shared rate limits
 * and fixtures update only once a day.
 */

const TSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";

// Common league IDs we care about. Discovered from /all_leagues.php on the
// free API. Docs:
//   https://www.thesportsdb.com/free_sports_api.php
export const TSDB_LEAGUES = {
  afl: { id: "4456", name: "AFL" },
  nrl: { id: "4418", name: "NRL" },
  superRugby: { id: "4414", name: "Super Rugby" },
  epl: { id: "4328", name: "English Premier League" },
  championsLeague: { id: "4480", name: "UEFA Champions League" },
  aLeague: { id: "4356", name: "A-League" },
  laLiga: { id: "4335", name: "La Liga" },
  bundesliga: { id: "4331", name: "Bundesliga" },
  serieA: { id: "4332", name: "Serie A" },
  ufc: { id: "4443", name: "UFC" },
  nfl: { id: "4391", name: "NFL" },
  nba: { id: "4387", name: "NBA" },
  pga: { id: "4425", name: "PGA Tour" },
  bbl: { id: "4432", name: "Big Bash League" },
  ipl: { id: "4450", name: "IPL" },
  f1: { id: "4370", name: "Formula 1" },
  motogp: { id: "4407", name: "MotoGP" },
  atp: { id: "4464", name: "ATP Tour" },
} as const;

export interface TsdbEvent {
  idEvent: string;
  strEvent: string;
  strLeague: string;
  strSport: string;
  strHomeTeam: string | null;
  strAwayTeam: string | null;
  dateEvent: string | null;        // "2026-04-18"
  strTime: string | null;          // "09:30:00"
  strTimestamp: string | null;     // ISO-ish
  strVenue: string | null;
  strStatus: string | null;
  strThumb: string | null;
  strPoster: string | null;
}

async function fetchTsdb<T>(
  url: string,
  revalidateSec = 3600
): Promise<T> {
  const res = await fetch(url, {
    next: { revalidate: revalidateSec },
    headers: { "User-Agent": "ComfyTV/1.0 (+https://comfytv.xyz)" },
  });
  if (!res.ok) throw new Error(`TheSportsDB ${res.status}`);
  return res.json();
}

/** Next upcoming events for a league (from the current season). */
export async function fetchNextEventsForLeague(
  leagueId: string
): Promise<TsdbEvent[]> {
  const now = new Date();
  const year = now.getFullYear();
  const todayStr = now.toISOString().slice(0, 10);

  // eventsseason.php works on the free tier; eventsnextleague.php is broken
  // (returns English League 1 soccer regardless of league ID).
  // Try current year first, fall back to "YYYY-1-YYYY" season format
  // (used by leagues like EPL that span two calendar years).
  let events = await fetchSeasonEvents(leagueId, String(year));
  if (events.length === 0) {
    events = await fetchSeasonEvents(leagueId, `${year - 1}-${year}`);
  }

  return events
    .filter((e) => e.dateEvent && e.dateEvent >= todayStr)
    .sort((a, b) => {
      const ta = a.strTimestamp || `${a.dateEvent}T${a.strTime || "00:00:00"}`;
      const tb = b.strTimestamp || `${b.dateEvent}T${b.strTime || "00:00:00"}`;
      return ta.localeCompare(tb);
    })
    .slice(0, 15);
}

async function fetchSeasonEvents(
  leagueId: string,
  season: string
): Promise<TsdbEvent[]> {
  try {
    const data = await fetchTsdb<{ events: TsdbEvent[] | null }>(
      `${TSDB_BASE}/eventsseason.php?id=${leagueId}&s=${encodeURIComponent(season)}`
    );
    return data.events || [];
  } catch {
    return [];
  }
}

/** Combine events from several leagues, dedup by idEvent, sort by date. */
export async function fetchEventsForLeagues(
  leagueIds: string[]
): Promise<TsdbEvent[]> {
  const results = await Promise.all(
    leagueIds.map((id) =>
      fetchNextEventsForLeague(id).catch(() => [] as TsdbEvent[])
    )
  );
  const seen = new Set<string>();
  const flat: TsdbEvent[] = [];
  for (const list of results) {
    for (const ev of list) {
      if (seen.has(ev.idEvent)) continue;
      seen.add(ev.idEvent);
      flat.push(ev);
    }
  }
  flat.sort((a, b) => {
    const ta = a.strTimestamp || `${a.dateEvent}T${a.strTime || "00:00:00"}`;
    const tb = b.strTimestamp || `${b.dateEvent}T${b.strTime || "00:00:00"}`;
    return ta.localeCompare(tb);
  });
  return flat;
}
