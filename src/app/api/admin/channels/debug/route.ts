import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { CHANNELS_COLLECTION, queryChannels } from "@/lib/channel-catalog";

export const revalidate = 0;
export const dynamic = "force-dynamic";

/**
 * Admin-only diagnostic: GET /api/admin/channels/debug?q=rick&category=...
 *
 * Returns TWO views of the same query:
 *   1. Raw Mongo inline query (what this endpoint does)
 *   2. What queryChannels() returns (the exact function /api/channels/streams
 *      uses). If these disagree, queryChannels has a bug.
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

  // Run the EXACT same path the streams endpoint uses so we can compare.
  const viaQueryChannels = await queryChannels({
    category: category ?? undefined,
    search: q || undefined,
    page: 1,
    pageSize: 10,
  });

  const categoryFilter = category ? { group: category } : {};
  const categorySamples = await coll.find(categoryFilter).limit(3).toArray();
  const headChannels = await coll.find({}).limit(3).toArray();

  return NextResponse.json({
    query: { q, category },
    filterUsed,
    totalChannels,
    totalMatchingAny,
    totalMatchingInCategory,
    samples,
    viaQueryChannels: {
      total: viaQueryChannels.total,
      rowCount: viaQueryChannels.rows.length,
      firstRow: viaQueryChannels.rows[0] || null,
    },
    categorySamples,
    headChannels,
  });
}
