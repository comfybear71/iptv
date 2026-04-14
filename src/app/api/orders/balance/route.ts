import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { sendAdminNewOrderEmail } from "@/lib/email";
import { PLANS, PlanType } from "@/types";

// POST: Pay for a plan using the user's stored crypto balance.
// Body: { plan: PlanType, currency: "SOL" | "BUDJU" }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plan, currency } = await req.json();
  if (!["SOL", "BUDJU"].includes(currency)) {
    return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
  }

  const validPlan = PLANS.find((p) => p.id === plan as PlanType);
  if (!validPlan) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const db = await getDb();
  const user = await db
    .collection("users")
    .findOne({ email: session.user.email });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch current conversion rates
  let solPrice: number | null = null;
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      solPrice = data.solana?.usd || null;
    }
  } catch {
    solPrice = null;
  }
  const budjuRate = parseFloat(process.env.BUDJU_USD_RATE || "0.01");

  // Compute required amount
  let amount: number;
  if (currency === "SOL") {
    if (!solPrice) {
      return NextResponse.json(
        { error: "SOL price unavailable, try again" },
        { status: 503 }
      );
    }
    amount = parseFloat((validPlan.price / solPrice).toFixed(4));
  } else {
    amount = parseFloat((validPlan.price / budjuRate).toFixed(2));
  }

  const currentSOL = user.balanceSOL || 0;
  const currentBUDJU = user.balanceBUDJU || 0;
  const currentBalance = currency === "SOL" ? currentSOL : currentBUDJU;

  if (currentBalance < amount) {
    return NextResponse.json(
      {
        error: `Insufficient ${currency} balance. Required: ${amount}, available: ${currentBalance}`,
      },
      { status: 400 }
    );
  }

  // Debit balance
  const newSOL = currency === "SOL" ? currentSOL - amount : currentSOL;
  const newBUDJU = currency === "BUDJU" ? currentBUDJU - amount : currentBUDJU;

  await db
    .collection("users")
    .updateOne(
      { _id: user._id },
      { $set: { balanceSOL: newSOL, balanceBUDJU: newBUDJU } }
    );

  // Create the order as confirmed (payment already settled via balance)
  const orderResult = await db.collection("orders").insertOne({
    userId: user._id.toString(),
    userEmail: user.email,
    userName: user.name || "Unknown",
    plan,
    amount,
    currency: "BALANCE",
    txHash: `BALANCE-${currency}-${Date.now()}`,
    status: "confirmed",
    notes: `Paid from ${currency} balance (${amount} ${currency})`,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Ledger entry
  await db.collection("ledger").insertOne({
    userId: user._id.toString(),
    userEmail: user.email,
    type: "debit",
    currency,
    amount,
    reason: `Subscription payment: ${validPlan.name}`,
    orderId: orderResult.insertedId.toString(),
    balanceAfterSOL: newSOL,
    balanceAfterBUDJU: newBUDJU,
    createdAt: new Date(),
  });

  // Notify admin
  try {
    await sendAdminNewOrderEmail({
      userEmail: user.email,
      userName: user.name || "Unknown",
      plan: validPlan.name,
      amount,
      currency,
      txHash: `Paid from balance`,
    });
  } catch (err) {
    console.error("Admin email failed:", err);
  }

  return NextResponse.json(
    { orderId: orderResult.insertedId, status: "confirmed" },
    { status: 201 }
  );
}
