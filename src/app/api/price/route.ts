import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      { next: { revalidate: 60 } }
    );

    if (!res.ok) {
      return NextResponse.json(
        { solPrice: null, budjuRate: parseFloat(process.env.BUDJU_USD_RATE || "0.01") },
        { status: 200 }
      );
    }

    const data = await res.json();
    const solPrice = data.solana?.usd || null;
    const budjuRate = parseFloat(process.env.BUDJU_USD_RATE || "0.01");

    return NextResponse.json({ solPrice, budjuRate });
  } catch {
    return NextResponse.json({
      solPrice: null,
      budjuRate: parseFloat(process.env.BUDJU_USD_RATE || "0.01"),
    });
  }
}
