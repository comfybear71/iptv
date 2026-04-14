import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/solana";

// POST /api/solana/send-tx
// Body: { signedTx: string (base64-encoded serialized Transaction) }
// Broadcasts the signed transaction via the server-side Helius RPC and
// returns the signature. This keeps all RPC calls server-side so the
// browser never hits a restricted or rate-limited endpoint.
export async function POST(req: NextRequest) {
  try {
    const { signedTx } = await req.json();
    if (!signedTx || typeof signedTx !== "string") {
      return NextResponse.json(
        { error: "signedTx (base64) required" },
        { status: 400 }
      );
    }

    const rawTx = Buffer.from(signedTx, "base64");
    const connection = getConnection();

    const signature = await connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 3,
    });

    // Best-effort confirmation; if this fails, the signature is still
    // valid and backend verification will handle it.
    try {
      await connection.confirmTransaction(signature, "confirmed");
    } catch {
      // ignore — /api/orders/verify-tx will check on-chain anyway
    }

    return NextResponse.json({ signature });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to broadcast transaction" },
      { status: 500 }
    );
  }
}
