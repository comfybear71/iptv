import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { CHANNELS_COLLECTION } from "@/lib/channel-catalog";

export const revalidate = 0;
export const dynamic = "force-dynamic";

/**
 * Admin-only diagnostic: GET /api/admin/channels/debug?q=rick
 * Returns:
 *   - total channels in the catalog
 *   - total matching `q` in ANY of name/tvgName/tvgId across ALL categories
 *   - total matching `q` restricted to a category, if provided via ?category=
 *   - first 5 matching channels (full raw docs)
 *
 * Purpose: let us verify the data is actually in the DB and see why a
 * search might be returning unexpected results.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const category = (searchParams.get("category") || "").trim() || null;

  const db = await getDb();
  const coll = db.collection(CHANNELS_COLLECTION);

  const totalChannels = await coll.countDocuments({});

  let totalMatchingAny = 0;
  let totalMatchingInCategory = 0;
  let samples: unknown[] = [];
  let filterUsed: Record<string, unknown> = {};

  if (q) {
    const pattern = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = { $regex: pattern, $options: "i" };
    const orClause = [
      { name: regex },
      { tvgName: regex },
      { tvgId: regex },
    ];

    totalMatchingAny = await coll.countDocuments({ $or: orClause });

    if (category) {
      filterUsed = { group: category, $or: orClause };
      totalMatchingInCategory = await coll.countDocuments(filterUsed);
      samples = await coll.find(filterUsed).limit(5).toArray();
    } else {
      filterUsed = { $or: orClause };
      samples = await coll.find(filterUsed).limit(5).toArray();
    }
  }

  // Also return a sample of 3 channels from the specified category (or any)
  // so we can see what `group` actually looks like in the DB.
  const categoryFilter = category ? { group: category } : {};
  const categorySamples = await coll
    .find(categoryFilter)
    .limit(3)
    .toArray();

  // And the first few channels overall
  const headChannels = await coll.find({}).limit(3).toArray();

  return NextResponse.json({
    query: { q, category },
    filterUsed,
    totalChannels,
    totalMatchingAny,
    totalMatchingInCategory,
    samples,
    categorySamples,
    headChannels,
  });
}
