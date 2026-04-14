import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { authOptions, isAdmin } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { type, currency, amount, reason } = body;

  if (
    !["credit", "debit"].includes(type) ||
    !["SOL", "BUDJU"].includes(currency) ||
    typeof amount !== "number" ||
    amount <= 0 ||
    !reason
  ) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const db = await getDb();
  let user;
  try {
    user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(params.id) });
  } catch {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const currentSOL = user.balanceSOL || 0;
  const currentBUDJU = user.balanceBUDJU || 0;

  const delta = type === "credit" ? amount : -amount;
  const newSOL =
    currency === "SOL"
      ? Math.max(0, currentSOL + delta)
      : currentSOL;
  const newBUDJU =
    currency === "BUDJU"
      ? Math.max(0, currentBUDJU + delta)
      : currentBUDJU;

  if (type === "debit") {
    if (currency === "SOL" && currentSOL < amount) {
      return NextResponse.json(
        { error: "Insufficient SOL balance" },
        { status: 400 }
      );
    }
    if (currency === "BUDJU" && currentBUDJU < amount) {
      return NextResponse.json(
        { error: "Insufficient BUDJU balance" },
        { status: 400 }
      );
    }
  }

  await db
    .collection("users")
    .updateOne(
      { _id: new ObjectId(params.id) },
      { $set: { balanceSOL: newSOL, balanceBUDJU: newBUDJU } }
    );

  await db.collection("ledger").insertOne({
    userId: params.id,
    userEmail: user.email,
    type,
    currency,
    amount,
    reason,
    adminEmail: session.user.email,
    balanceAfterSOL: newSOL,
    balanceAfterBUDJU: newBUDJU,
    createdAt: new Date(),
  });

  return NextResponse.json({
    success: true,
    balanceSOL: newSOL,
    balanceBUDJU: newBUDJU,
  });
}
