import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { DEFAULT_XTREME_HOST } from "@/lib/mybunny";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Admin-only VOD diagnostic passthrough to MyBunny's Xtream API.
 *
 * Purpose: before we build the in-site VOD browser, we need to see what
 * metadata and stream-URL shape the provider actually returns. This
 * endpoint proxies specific Xtream API actions so the admin can inspect
 * responses in a browser without exposing the master credentials.
 *
 * Usage (logged in as admin):
 *   /api/admin/vod/diagnose?action=get_vod_categories
 *   /api/admin/vod/diagnose?action=get_vod_streams
 *   /api/admin/vod/diagnose?action=get_vod_streams&category_id=1
 *   /api/admin/vod/diagnose?action=get_vod_info&vod_id=12345
 *   /api/admin/vod/diagnose?action=get_series_categories
 *   /api/admin/vod/diagnose?action=get_series
 *   /api/admin/vod/diagnose?action=get_series&category_id=1
 *   /api/admin/vod/diagnose?action=get_series_info&series_id=12345
 *
 * Returns the raw Xtream JSON plus a `_meta` block with the URL we hit
 * (minus creds) so you can see exactly what was called.
 */

const ALLOWED_ACTIONS = new Set([
  "get_vod_categories",
  "get_vod_streams",
  "get_vod_info",
  "get_series_categories",
  "get_series",
  "get_series_info",
]);

const PASSTHROUGH_PARAMS = ["category_id", "vod_id", "series_id"] as const;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "";
  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json(
      {
        error: "Unknown or missing action",
        allowed: Array.from(ALLOWED_ACTIONS),
      },
      { status: 400 }
    );
  }

  const username = process.env.MYBUNNY_MASTER_USERNAME;
  const password = process.env.MYBUNNY_MASTER_PASSWORD;
  if (!username || !password) {
    return NextResponse.json(
      { error: "MYBUNNY_MASTER_USERNAME / _PASSWORD not set" },
      { status: 500 }
    );
  }

  const host = DEFAULT_XTREME_HOST.replace(/\/$/, "");
  const upstream = new URL(`${host}/player_api.php`);
  upstream.searchParams.set("username", username);
  upstream.searchParams.set("password", password);
  upstream.searchParams.set("action", action);
  for (const key of PASSTHROUGH_PARAMS) {
    const value = searchParams.get(key);
    if (value) upstream.searchParams.set(key, value);
  }

  // Safe URL for echoing back in the response — redact credentials so
  // pasting this somewhere doesn't leak the master account.
  const echoUrl = new URL(upstream.toString());
  echoUrl.searchParams.set("username", "REDACTED");
  echoUrl.searchParams.set("password", "REDACTED");

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstream.toString(), {
      cache: "no-store",
      headers: {
        "User-Agent": "TiviMate/4.8.0 (Linux; Android 11)",
        Accept: "application/json",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "fetch failed";
    return NextResponse.json(
      { error: `Upstream error: ${msg}`, urlHit: echoUrl.toString() },
      { status: 502 }
    );
  }

  if (!upstreamRes.ok) {
    return NextResponse.json(
      {
        error: `Upstream HTTP ${upstreamRes.status}`,
        urlHit: echoUrl.toString(),
      },
      { status: 502 }
    );
  }

  const contentType = upstreamRes.headers.get("content-type") || "";
  const text = await upstreamRes.text();

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      {
        error: "Upstream returned non-JSON",
        contentType,
        preview: text.slice(0, 500),
        urlHit: echoUrl.toString(),
      },
      { status: 502 }
    );
  }

  // For large responses (e.g. get_vod_streams with no category filter), trim
  // to a preview of the first 3 items so the JSON stays readable in a
  // browser. Full dataset fetched fine — we just don't need 14k items to
  // evaluate the shape.
  let preview: unknown = body;
  let truncated = false;
  if (Array.isArray(body) && body.length > 3) {
    preview = body.slice(0, 3);
    truncated = true;
  }

  return NextResponse.json({
    _meta: {
      action,
      urlHit: echoUrl.toString(),
      upstreamContentType: contentType,
      totalItems: Array.isArray(body) ? body.length : undefined,
      truncatedToFirst: truncated ? 3 : undefined,
    },
    data: preview,
  });
}
