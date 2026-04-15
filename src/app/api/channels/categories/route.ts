import { NextResponse } from "next/server";
import { fetchXtreamLiveCategories } from "@/lib/xtream";
import { getUserXtremeCreds } from "../_helpers";

export const revalidate = 1800; // 30 min ISR

// GET /api/channels/categories
// Returns [{ category_id, category_name, parent_id }] from MyBunny's Xtream API.
export async function GET() {
  const auth = await getUserXtremeCreds();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const categories = await fetchXtreamLiveCategories(auth.creds);
    return NextResponse.json({ categories });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to fetch categories" },
      { status: 502 }
    );
  }
}
