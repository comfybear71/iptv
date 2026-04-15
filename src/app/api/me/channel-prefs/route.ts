import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";

// GET  → { enabledCategoryIds: string[] }
// POST { enabledCategoryIds: string[] } → saves preferences
//
// An empty array means "show all" (no filter applied).

async function resolveUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { error: "Unauthorized", status: 401 } as const;
  }
  const db = await getDb();
  const user = await db
    .collection("users")
    .findOne({ email: session.user.email });
  if (!user) {
    return { error: "User not found", status: 404 } as const;
  }
  return { user, db } as const;
}

export async function GET() {
  const r = await resolveUser();
  if ("error" in r) {
    return NextResponse.json({ error: r.error }, { status: r.status });
  }
  return NextResponse.json({
    enabledCategoryIds: r.user.channelPrefs?.enabledCategoryIds || [],
  });
}

export async function POST(req: NextRequest) {
  const r = await resolveUser();
  if ("error" in r) {
    return NextResponse.json({ error: r.error }, { status: r.status });
  }

  const body = await req.json().catch(() => null);
  const raw = body?.enabledCategoryIds;
  if (!Array.isArray(raw)) {
    return NextResponse.json(
      { error: "enabledCategoryIds must be an array of strings" },
      { status: 400 }
    );
  }
  const enabledCategoryIds = raw
    .map((v: unknown) => String(v).trim())
    .filter((v: string) => v.length > 0 && v.length < 64)
    .slice(0, 200);

  await r.db.collection("users").updateOne(
    { _id: r.user._id },
    {
      $set: {
        channelPrefs: { enabledCategoryIds },
        channelPrefsUpdatedAt: new Date(),
      },
    }
  );

  return NextResponse.json({ success: true, enabledCategoryIds });
}
