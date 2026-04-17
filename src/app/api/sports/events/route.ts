import { NextRequest, NextResponse } from "next/server";
import { SPORTS } from "@/lib/sports";
import { fetchEventsForLeagues } from "@/lib/thesportsdb";
import { fetchAflFixtures } from "@/lib/squiggle";

export const revalidate = 3600; // 1 hour — fixtures change slowly

// GET /api/sports/events?sportId=afl
// Returns upcoming events for the requested sport.
// AFL uses Squiggle (Australian-specific, reliable).
// All other sports use TheSportsDB (global, free key "3").
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sportId = searchParams.get("sportId");
  if (!sportId) {
    return NextResponse.json(
      { error: "sportId query param required" },
      { status: 400 }
    );
  }

  const sport = SPORTS.find((s) => s.id === sportId);
  if (!sport) {
    return NextResponse.json({ error: "Unknown sport" }, { status: 404 });
  }

  // AFL → Squiggle API (TheSportsDB's eventsnextleague endpoint has a bug
  // that returns English soccer for the AFL league ID 4456).
  if (sportId === "afl") {
    try {
      const fixtures = await fetchAflFixtures();
      return NextResponse.json({
        sportId,
        sportLabel: sport.label,
        channelHint: sport.channelHint || null,
        source: "squiggle",
        fixtures,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to fetch AFL fixtures";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  // All other sports → TheSportsDB
  if (!sport.tsdbLeagueIds || sport.tsdbLeagueIds.length === 0) {
    return NextResponse.json({
      sportId,
      events: [],
      note: "No upcoming-events feed configured for this sport yet.",
    });
  }

  try {
    const events = await fetchEventsForLeagues(sport.tsdbLeagueIds);
    return NextResponse.json({
      sportId,
      sportLabel: sport.label,
      channelHint: sport.channelHint || null,
      events,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch events";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
