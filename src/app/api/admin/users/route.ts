import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDb();
  const users = await db
    .collection("users")
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  // Get subscription counts per user
  const subscriptions = await db
    .collection("subscriptions")
    .find({ status: "active" })
    .toArray();

  const subMap: Record<string, number> = {};
  for (const sub of subscriptions) {
    subMap[sub.userId] = (subMap[sub.userId] || 0) + 1;
  }

  const usersWithSubs = users.map((u) => ({
    ...u,
    activeSubscriptions: subMap[u._id.toString()] || 0,
  }));

  return NextResponse.json({ users: usersWithSubs });
}
