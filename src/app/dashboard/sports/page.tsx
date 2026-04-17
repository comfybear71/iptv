"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildWebPlayerUrl, DEFAULT_XTREME_HOST } from "@/lib/mybunny";
import {
  SPORTS,
  SportDef,
  filterStreamsForSport,
  StreamForFilter,
  CategoryForFilter,
} from "@/lib/sports";
import { useFavorites } from "@/hooks/useFavorites";
import { SubscriptionCredentials } from "@/types";

interface TsdbEvent {
  idEvent: string;
  strEvent: string;
  strLeague: string;
  strHomeTeam: string | null;
  strAwayTeam: string | null;
  dateEvent: string | null;
  strTime: string | null;
  strTimestamp: string | null;
  strVenue: string | null;
}

interface AflFixture {
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

interface Subscription {
  _id: string;
  status: string;
  credentials?: SubscriptionCredentials;
}

export default function SportsPage() {
  const { favorites, toggle: toggleFavorite } = useFavorites();

  const [subs, setSubs] = useState<Subscription[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);

  const [categories, setCategories] = useState<CategoryForFilter[]>([]);
  const [allStreams, setAllStreams] = useState<StreamForFilter[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");

  const [activeSport, setActiveSport] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Upcoming events for the active sport
  const [events, setEvents] = useState<TsdbEvent[]>([]);
  const [aflFixtures, setAflFixtures] = useState<AflFixture[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [eventsNote, setEventsNote] = useState("");
  const [channelHint, setChannelHint] = useState<string | null>(null);

  // Initial load — subscription + categories
  useEffect(() => {
    (async () => {
      try {
        const [subsRes, catsRes] = await Promise.all([
          fetch("/api/subscriptions"),
          fetch("/api/channels/categories"),
        ]);
        const subsData = await subsRes.json().catch(() => ({}));
        const catsData = await catsRes.json().catch(() => ({}));
        setSubs(subsData.subscriptions || []);
        if (Array.isArray(catsData.categories)) {
          setCategories(catsData.categories);
        }
      } finally {
        setSubsLoading(false);
      }
    })();
  }, []);

  const active = subs.find((s) => s.status === "active");
  const creds = active?.credentials;
  const host = creds?.xtremeHost || DEFAULT_XTREME_HOST;
  const hasCreds = !!(creds?.xtremeUsername && creds?.xtremePassword);

  // Lazy-load ALL streams once when a sport is first picked. The /api/channels/streams
  // endpoint is paginated — we ask for a huge page so we get the full set in one call.
  // 22k channels × ~200 bytes JSON ≈ 4-5MB, loads in a few seconds, then filtering is instant.
  const loadAllStreams = useCallback(async () => {
    if (allStreams.length > 0 || !hasCreds) return;
    setDataLoading(true);
    setDataError("");
    try {
      // Paginate through until we've got everything. 80 per page default.
      let page = 1;
      const collected: StreamForFilter[] = [];
      while (true) {
        const res = await fetch(`/api/channels/streams?page=${page}`);
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        collected.push(...(data.streams || []));
        if (page >= data.totalPages || data.streams.length === 0) break;
        page += 1;
        // Safety guard — bail out if panel is somehow returning >300 pages (~24k)
        if (page > 400) break;
      }
      setAllStreams(collected);
    } catch (err: any) {
      setDataError(err?.message || "Failed to load channels");
    } finally {
      setDataLoading(false);
    }
  }, [hasCreds, allStreams.length]);

  // Matches for the active sport
  const sportDef: SportDef | null = useMemo(
    () => SPORTS.find((s) => s.id === activeSport) || null,
    [activeSport]
  );

  const matches = useMemo(() => {
    if (!sportDef || allStreams.length === 0) return [];
    const full = filterStreamsForSport(sportDef, allStreams, categories);
    if (!search.trim()) return full;
    const q = search.trim().toLowerCase();
    return full.filter((s) => s.name.toLowerCase().includes(q));
  }, [sportDef, allStreams, categories, search]);

  const loadEvents = useCallback(async (sportId: string) => {
    setEventsLoading(true);
    setEventsError("");
    setEventsNote("");
    setChannelHint(null);
    setEvents([]);
    setAflFixtures([]);
    try {
      const res = await fetch(`/api/sports/events?sportId=${sportId}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (Array.isArray(data.fixtures)) {
        setAflFixtures(data.fixtures);
      } else {
        setEvents(Array.isArray(data.events) ? data.events : []);
      }
      if (data.note) setEventsNote(data.note);
      if (typeof data.channelHint === "string") setChannelHint(data.channelHint);
    } catch (err: unknown) {
      setEventsError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const pickSport = (id: string) => {
    setActiveSport(id);
    setSearch("");
    loadAllStreams(); // fire once; cached after
    loadEvents(id);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600/20 text-2xl">
          🏆
        </span>
        <div>
          <h1 className="text-2xl font-bold text-white">Sports</h1>
          <p className="text-sm text-slate-400">
            Pick a sport to see the channels that carry it.
          </p>
        </div>
      </div>

      {subsLoading ? (
        <div className="mt-8 text-center text-slate-400">Loading...</div>
      ) : !hasCreds ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-amber-800 bg-amber-900/20 p-6 text-center">
          <h2 className="text-lg font-bold text-white">
            Subscribe first to watch sports
          </h2>
          <p className="mt-2 text-sm text-amber-200">
            Pick a plan and we&apos;ll unlock the sports channel browser.
          </p>
          <a
            href="/dashboard/order"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Order a Plan →
          </a>
        </div>
      ) : (
        <>
          {/* Sport tiles */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {SPORTS.map((sport) => {
              const on = activeSport === sport.id;
              return (
                <button
                  key={sport.id}
                  onClick={() => pickSport(sport.id)}
                  className={`overflow-hidden rounded-2xl border p-4 text-left transition ${
                    on
                      ? "border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/40"
                      : "border-slate-800 bg-slate-900 hover:border-slate-700"
                  }`}
                >
                  <div
                    className={`mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-2xl text-white ${sport.accent}`}
                  >
                    {sport.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sport.logoUrl}
                        alt={sport.label}
                        className="h-8 w-8 object-contain"
                      />
                    ) : (
                      sport.emoji
                    )}
                  </div>
                  <div className="text-sm font-bold text-white">
                    {sport.label}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {sport.blurb}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Upcoming events (Phase B) */}
          {sportDef && (
            <section className="mt-8 overflow-hidden rounded-2xl border border-amber-800 bg-amber-900/10 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-white">
                  📅 Upcoming {sportDef.label}
                </h2>
                {channelHint && (
                  <span className="rounded-full bg-amber-900/40 px-3 py-1 text-[11px] text-amber-200">
                    Usually on: {channelHint}
                  </span>
                )}
              </div>

              {eventsLoading && (
                <div className="mt-4 text-xs text-slate-500">
                  Loading upcoming events…
                </div>
              )}
              {eventsError && (
                <div className="mt-4 rounded-lg border border-red-800 bg-red-900/30 p-3 text-xs text-red-300">
                  {eventsError}
                </div>
              )}
              {eventsNote && !eventsLoading && !eventsError && (
                <div className="mt-4 text-xs text-slate-500">{eventsNote}</div>
              )}

              {/* AFL fixtures (from Squiggle) — grouped by round */}
              {!eventsLoading && !eventsError && aflFixtures.length > 0 && (
                <AflRoundGroups fixtures={aflFixtures} />
              )}

              {/* Other sports events (from TheSportsDB) */}
              {!eventsLoading && !eventsError && events.length > 0 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {events.slice(0, 12).map((ev) => (
                    <EventCard key={ev.idEvent} event={ev} />
                  ))}
                </div>
              )}

              {!eventsLoading &&
                !eventsError &&
                !eventsNote &&
                events.length === 0 &&
                aflFixtures.length === 0 && (
                  <div className="mt-4 text-xs text-slate-500">
                    No events in the next few weeks.
                  </div>
                )}
            </section>
          )}

          {/* Match list */}
          {sportDef && (
            <section className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white">
                    {sportDef.emoji} {sportDef.label} channels
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {dataLoading
                      ? "Loading channel list…"
                      : `${matches.length.toLocaleString()} channels found`}
                  </p>
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search these results…"
                  className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {dataError && (
                <div className="mt-4 rounded-lg border border-red-800 bg-red-900/30 p-3 text-xs text-red-300">
                  {dataError}
                </div>
              )}

              {!dataLoading && matches.length === 0 && !dataError && (
                <div className="mt-6 text-center text-sm text-slate-500">
                  No channels matched. Try a different sport or check back
                  during broadcast hours (PPV channels often light up only
                  around event time).
                </div>
              )}

              {matches.length > 0 && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {matches.slice(0, 150).map((stream) => (
                    <ChannelTile
                      key={stream.stream_id}
                      stream={stream}
                      host={host}
                      username={creds!.xtremeUsername!}
                      password={creds!.xtremePassword!}
                      isFavorite={favorites.has(stream.stream_id)}
                      onToggleFavorite={() =>
                        toggleFavorite(stream.stream_id)
                      }
                    />
                  ))}
                </div>
              )}

              {matches.length > 150 && (
                <div className="mt-4 text-center text-[11px] text-slate-500">
                  Showing the first 150 matches. Use search to narrow down.
                </div>
              )}
            </section>
          )}

          {!sportDef && (
            <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/50 p-5 text-xs text-slate-400">
              👆 Tap a sport above to see the channels that carry it.
              First-time load of the channel list takes a few seconds —
              after that switching sports is instant.
            </div>
          )}

          {/* Phase 2 teaser */}
          <div className="mt-8 rounded-xl border border-blue-800 bg-blue-900/20 p-4 text-xs text-slate-300">
            <strong>🗓️ Upcoming events calendar — coming soon.</strong> We&apos;ll
            add a live schedule of AFL fixtures, UFC PPVs, and Premier League
            games so you can plan ahead. For now, this page shows every
            channel that carries the sport.
          </div>
        </>
      )}
    </div>
  );
}

function EventCard({ event }: { event: TsdbEvent }) {
  const when = useMemo(() => {
    const ts =
      event.strTimestamp ||
      (event.dateEvent ? `${event.dateEvent}T${event.strTime || "00:00:00"}` : "");
    if (!ts) return { date: "TBA", time: "" };
    const d = new Date(ts);
    if (isNaN(d.getTime())) return { date: ts, time: "" };
    return {
      date: d.toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
      time: d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  }, [event.strTimestamp, event.dateEvent, event.strTime]);

  const title =
    event.strHomeTeam && event.strAwayTeam
      ? `${event.strHomeTeam} vs ${event.strAwayTeam}`
      : event.strEvent;

  return (
    <div className="overflow-hidden rounded-xl border border-amber-900/40 bg-slate-950 p-3">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 rounded-lg bg-amber-900/40 px-3 py-2 text-center">
          <div className="text-[10px] uppercase tracking-widest text-amber-300">
            {when.date}
          </div>
          <div className="text-sm font-bold text-white">{when.time || "—"}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">
            {title}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-slate-400">
            {event.strLeague}
          </div>
          {event.strVenue && (
            <div className="mt-0.5 truncate text-[10px] text-slate-500">
              📍 {event.strVenue}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChannelTile({
  stream,
  host,
  username,
  password,
  isFavorite,
  onToggleFavorite,
}: {
  stream: StreamForFilter;
  host: string;
  username: string;
  password: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const streamUrl =
    stream.url ||
    `${host.replace(/\/$/, "")}/live/${encodeURIComponent(
      username
    )}/${encodeURIComponent(password)}/${stream.stream_id}.m3u8`;
  const playerUrl = buildWebPlayerUrl(streamUrl);

  return (
    <div className="flex items-center gap-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3">
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-900">
        {stream.stream_icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={stream.stream_icon}
            alt={stream.name}
            className="h-full w-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <span className="text-xl">🏆</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">
          {stream.name}
        </div>
        {stream.epg_channel_id && (
          <div className="truncate text-[10px] text-slate-500">
            {stream.epg_channel_id}
          </div>
        )}
      </div>
      <button
        onClick={onToggleFavorite}
        title={isFavorite ? "Remove from favourites" : "Add to favourites"}
        className={`flex-shrink-0 rounded-md px-2 py-1.5 text-base leading-none transition ${
          isFavorite
            ? "bg-rose-600/20 text-rose-400 hover:bg-rose-600/30"
            : "bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-rose-400"
        }`}
      >
        {isFavorite ? "♥" : "♡"}
      </button>
      <a
        href={playerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
      >
        ▶
      </a>
    </div>
  );
}

function AflRoundGroups({ fixtures }: { fixtures: AflFixture[] }) {
  const rounds = useMemo(() => {
    const map = new Map<number, AflFixture[]>();
    for (const fix of fixtures) {
      const list = map.get(fix.round) || [];
      list.push(fix);
      map.set(fix.round, list);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([round, games]) => ({ round, roundname: games[0].roundname, games }));
  }, [fixtures]);

  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (rounds.length > 0) {
      setExpandedRounds(new Set([rounds[0].round]));
    }
  }, [rounds]);

  const toggle = (round: number) => {
    setExpandedRounds((prev) => {
      const next = new Set(prev);
      if (next.has(round)) {
        next.delete(round);
      } else {
        next.add(round);
      }
      return next;
    });
  };

  return (
    <div className="mt-4 space-y-3">
      {rounds.map(({ round, roundname, games }, idx) => {
        const isOpen = expandedRounds.has(round);
        return (
          <div key={round}>
            <button
              onClick={() => toggle(round)}
              className="flex w-full items-center justify-between rounded-xl border border-amber-900/40 bg-slate-950 px-4 py-3 text-left transition hover:bg-slate-900"
            >
              <span className="text-sm font-bold text-white">
                {roundname}
                <span className="ml-2 text-xs font-normal text-slate-400">
                  ({games.length} game{games.length === 1 ? "" : "s"})
                </span>
              </span>
              <span className="text-slate-400">
                {isOpen ? "▲" : "▼"}
              </span>
            </button>
            {isOpen && (
              <div className="mt-2 space-y-2">
                {games.map((fix) => (
                  <AflFixtureCard key={fix.id} fixture={fix} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AflFixtureCard({ fixture }: { fixture: AflFixture }) {
  const when = useMemo(() => {
    const d = new Date(fixture.unixtime * 1000);
    if (isNaN(d.getTime())) return { dateStr: "TBA", timeStr: "", countdown: "" };

    const now = Date.now();
    const diff = fixture.unixtime * 1000 - now;

    let countdown = "";
    if (diff > 0) {
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      if (days > 0) {
        countdown = `${days}d ${hours}h`;
      } else if (hours > 0) {
        countdown = `${hours}h ${mins}m`;
      } else {
        countdown = `${mins}m`;
      }
    }

    return {
      dateStr: d.toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
      timeStr: d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }),
      countdown,
    };
  }, [fixture.unixtime]);

  return (
    <div className="overflow-hidden rounded-xl border border-amber-900/40 bg-slate-950 p-4">
      <div className="flex items-center gap-4">
        {/* Home team */}
        <div className="flex flex-1 items-center justify-end gap-2 text-right">
          <span className="truncate text-sm font-semibold text-white">
            {fixture.homeTeam}
          </span>
          {fixture.homeTeamLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fixture.homeTeamLogo}
              alt={fixture.homeTeam}
              className="h-10 w-10 flex-shrink-0 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </div>

        {/* VS + time */}
        <div className="flex-shrink-0 text-center">
          <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
            vs
          </div>
          <div className="text-xs font-bold text-white">{when.timeStr}</div>
          <div className="text-[10px] text-slate-400">{when.dateStr}</div>
          {when.countdown && (
            <div className="mt-1 rounded-full bg-emerald-900/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              {when.countdown}
            </div>
          )}
        </div>

        {/* Away team */}
        <div className="flex flex-1 items-center gap-2">
          {fixture.awayTeamLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fixture.awayTeamLogo}
              alt={fixture.awayTeam}
              className="h-10 w-10 flex-shrink-0 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <span className="truncate text-sm font-semibold text-white">
            {fixture.awayTeam}
          </span>
        </div>
      </div>

      {/* Venue + round */}
      <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-slate-500">
        <span>{fixture.roundname}</span>
        <span>·</span>
        <span>{fixture.venue}</span>
      </div>
    </div>
  );
}
