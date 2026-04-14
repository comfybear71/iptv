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

  return NextResponse.json({
    user: {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      balanceSOL: user.balanceSOL || 0,
      balanceBUDJU: user.balanceBUDJU || 0,
      autoRenew: user.autoRenew || false,
    },
  });
}
