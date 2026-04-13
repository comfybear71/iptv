import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { sendAdminNewOrderEmail } from "@/lib/email";
import { PLANS, PlanType } from "@/types";

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

  const orders = await db
    .collection("orders")
    .find({ userId: user._id.toString() })
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { plan, amount, currency, txHash } = body;

  if (!plan || !amount || !currency || !txHash) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const validPlan = PLANS.find((p) => p.id === plan as PlanType);
  if (!validPlan) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  if (!["SOL", "BUDJU"].includes(currency)) {
    return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
  }

  const db = await getDb();
  const user = await db
    .collection("users")
    .findOne({ email: session.user.email });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const order = {
    userId: user._id.toString(),
    userEmail: session.user.email,
    userName: session.user.name || "Unknown",
    plan,
    amount,
    currency,
    txHash,
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.collection("orders").insertOne(order);

  try {
    await sendAdminNewOrderEmail({
      userEmail: session.user.email,
      userName: session.user.name || "Unknown",
      plan: validPlan.name,
      amount,
      currency,
      txHash,
    });
  } catch (err) {
    console.error("Failed to send admin email:", err);
  }

  return NextResponse.json(
    { orderId: result.insertedId, status: "pending" },
    { status: 201 }
  );
}
