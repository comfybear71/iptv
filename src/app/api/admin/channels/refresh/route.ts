import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { getCatalogMeta, refreshMasterCatalog } from "@/lib/channel-catalog";

// Allow up to 60s for the initial 21k-channel fetch + parse + insert
export const maxDuration = 60;

// GET /api/admin/channels/refresh — returns current catalog meta
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const meta = await getCatalogMeta();
  return NextResponse.json({ meta });
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
    const msg =
      err instanceof Error ? err.message : "Catalog refresh failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
