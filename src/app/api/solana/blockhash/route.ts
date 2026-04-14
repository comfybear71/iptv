import { NextResponse } from "next/server";
import { getConnection } from "@/lib/solana";

// GET /api/solana/blockhash
// Returns a recent blockhash from the server-side Helius RPC.
// Used by the subscribe page to bypass any browser RPC restrictions.
export async function GET() {
  try {
    const connection = getConnection();
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    return NextResponse.json({ blockhash, lastValidBlockHeight });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to fetch blockhash" },
      { status: 500 }
    );
  }
}
