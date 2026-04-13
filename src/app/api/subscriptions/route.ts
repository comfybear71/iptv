import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const user = await db
    .collection("users")
    .findOne({ email: session.user.email });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const subscriptions = await db
    .collection("subscriptions")
    .find({ userId: user._id.toString() })
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json({ subscriptions });
}
