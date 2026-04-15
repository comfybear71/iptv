import { NextResponse } from "next/server";
import { getUserXtremeCreds } from "../_helpers";
import {
  fetchMyBunnyEntries,
  summariseCategories,
} from "@/lib/mybunny-playlist";

export const revalidate = 1800; // 30 min ISR

// GET /api/channels/categories
// Returns the live-TV category list extracted from MyBunny's M3U
// playlist (so all 180+ groups are included, not the 7 that the Xtream
// API surfaces for our reseller account).
export async function GET() {
  const auth = await getUserXtremeCreds();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const entries = await fetchMyBunnyEntries(auth.creds);
    const categories = summariseCategories(entries);
    return NextResponse.json({ categories });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch categories";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
