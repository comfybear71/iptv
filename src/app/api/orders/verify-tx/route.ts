import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { sendAdminNewOrderEmail } from "@/lib/email";
import {
  verifySolPayment,
  verifyBudjuPayment,
  getBudjuBalance,
} from "@/lib/solana";
import {
  PLANS,
  PlanType,
  applyDiscount,
  getDiscountPct,
} from "@/types";

// Allow up to 45 seconds for tx verification (polls up to 30s for tx
// to appear on-chain plus buffer for other work).
export const maxDuration = 45;

// POST /api/orders/verify-tx
// Body: { plan, currency ("SOL"|"BUDJU"), signature, walletAddress }
// 1. Fetches current rates + user's BUDJU holdings (for discount)
// 2. Verifies on-chain: tx succeeded, recipient correct, amount within tolerance
// 3. Creates confirmed order + notifies admin
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { plan, currency, signature, walletAddress, desiredChannelName } = body;

  if (!plan || !currency || !signature || !walletAddress) {
    return NextResponse.json(
      { error: "plan, currency, signature, walletAddress required" },
      { status: 400 }
    );
  }

  if (!["SOL", "BUDJU"].includes(currency)) {
    return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
  }

  const validPlan = PLANS.find((p) => p.id === (plan as PlanType));
  if (!validPlan) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const db = await getDb();

  // Prevent replay — each signature can be used only once
  const existing = await db.collection("orders").findOne({ txHash: signature });
  if (existing) {
    return NextResponse.json(
      { error: "Transaction signature already used" },
      { status: 409 }
    );
  }

  const user = await db
    .collection("users")
    .findOne({ email: session.user.email });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch user's BUDJU balance in the paying wallet → apply discount
  const budjuBalance = await getBudjuBalance(walletAddress);
  const discountPct = getDiscountPct(budjuBalance);
  const discountedPriceUsd = applyDiscount(validPlan.price, discountPct);

  // Determine expected on-chain amount
  let expectedAmount: number;
  if (currency === "SOL") {
    // Get current SOL price
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

    if (!solPrice) {
      return NextResponse.json(
        { error: "Failed to fetch SOL price; try again" },
        { status: 503 }
      );
    }
    expectedAmount = parseFloat((discountedPriceUsd / solPrice).toFixed(4));
  } else {
    const budjuRate = parseFloat(process.env.BUDJU_USD_RATE || "0.01");
    expectedAmount = parseFloat((discountedPriceUsd / budjuRate).toFixed(2));
  }

  // Verify on-chain
  const recipient =
    currency === "SOL"
      ? process.env.SOL_WALLET_ADDRESS ||
        process.env.NEXT_PUBLIC_SOL_WALLET_ADDRESS
      : process.env.BUDJU_WALLET_ADDRESS ||
        process.env.NEXT_PUBLIC_BUDJU_WALLET_ADDRESS;

  if (!recipient) {
    return NextResponse.json(
      { error: `${currency} wallet not configured` },
      { status: 500 }
    );
  }

  const verify =
    currency === "SOL"
      ? await verifySolPayment({
          signature,
          expectedRecipient: recipient,
          expectedAmountSol: expectedAmount,
          expectedSender: walletAddress,
        })
      : await verifyBudjuPayment({
          signature,
          expectedRecipient: recipient,
          expectedAmountBudju: expectedAmount,
          expectedSender: walletAddress,
        });

  if (!verify.valid) {
    return NextResponse.json(
      {
        error: verify.error || "Transaction verification failed",
        expectedAmount,
        actualAmount: verify.actualAmount,
      },
      { status: 400 }
    );
  }

  // Create confirmed order
  const cleanedChannelName =
    typeof desiredChannelName === "string"
      ? desiredChannelName.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 30)
      : undefined;

  const result = await db.collection("orders").insertOne({
    userId: user._id.toString(),
    userEmail: user.email,
    userName: user.name || "Unknown",
    plan,
    amount: expectedAmount,
    currency,
    txHash: signature,
    status: "confirmed",
    desiredChannelName: cleanedChannelName || undefined,
    originalPriceUsd: validPlan.price,
    discountPct,
    discountedPriceUsd,
    walletAddress,
    budjuBalanceAtPayment: budjuBalance,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Notify admin
  try {
    await sendAdminNewOrderEmail({
      userEmail: user.email,
      userName: user.name || "Unknown",
      plan: validPlan.name,
      amount: expectedAmount,
      currency,
      txHash: signature,
    });
  } catch (err) {
    console.error("Admin email failed:", err);
  }

  return NextResponse.json(
    {
      orderId: result.insertedId,
      status: "confirmed",
      discountPct,
      finalPriceUsd: discountedPriceUsd,
    },
    { status: 201 }
  );
}
