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
  const subscriptions = await db
    .collection("subscriptions")
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json({ subscriptions });
}
