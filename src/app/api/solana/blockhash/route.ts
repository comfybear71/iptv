import { NextResponse } from "next/server";
import { getConnection } from "@/lib/solana";

// GET /api/solana/blockhash
// Returns a recent blockhash from the server-side Helius RPC.
// Uses "finalized" commitment so the blockhash is universally propagated
// across RPC nodes — prevents "Blockhash not found" errors during
// preflight simulation on send.
export async function GET() {
  try {
    const connection = getConnection();
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("finalized");
    return NextResponse.json({ blockhash, lastValidBlockHeight });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to fetch blockhash" },
      { status: 500 }
    );
  }
}
