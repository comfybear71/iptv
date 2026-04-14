import { NextRequest, NextResponse } from "next/server";
import { getBudjuBalance } from "@/lib/solana";
import { getDiscountTier, getDiscountPct } from "@/types";

// GET ?wallet=<address>
// Returns BUDJU balance + discount tier for the wallet.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json(
      { error: "wallet query param required" },
      { status: 400 }
    );
  }

  try {
    const balance = await getBudjuBalance(wallet);
    const tier = getDiscountTier(balance);
    const discountPct = getDiscountPct(balance);

    return NextResponse.json({
      walletAddress: wallet,
      budjuBalance: balance,
      discountPct,
      tier: tier
        ? { label: tier.label, minBudju: tier.minBudju, discountPct: tier.discountPct }
        : null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to fetch balance" },
      { status: 500 }
    );
  }
}
