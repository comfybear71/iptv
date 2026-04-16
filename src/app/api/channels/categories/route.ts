import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCategories } from "@/lib/channel-catalog";

export const revalidate = 60;

// GET /api/channels/categories
// Returns categories from the master channel catalog (MongoDB) — NOT from
// the user's own M3U. This way every user sees all ~129 categories even if
// their MyBunny sub-account only has a subset ticked.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const categories = await getCategories();
    return NextResponse.json({ categories });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to fetch categories";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
