import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { getCatalogMeta, refreshMasterCatalog } from "@/lib/channel-catalog";

// Allow up to 60s for the initial 21k-channel fetch + parse + insert
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// GET /api/admin/channels/refresh — returns current catalog meta
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const meta = await getCatalogMeta();
    return NextResponse.json({ meta });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to read meta";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/admin/channels/refresh — triggers a full catalog re-fetch
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await refreshMasterCatalog();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    // Log to Vercel function logs so we can diagnose timeouts vs other failures
    console.error("[catalog refresh] failed:", err);
    const msg =
      err instanceof Error ? err.message : "Catalog refresh failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
