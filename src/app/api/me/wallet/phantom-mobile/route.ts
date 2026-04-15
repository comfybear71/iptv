import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PublicKey } from "@solana/web3.js";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";

/**
 * Link a wallet from the Phantom mobile deeplink flow.
 *
 * Unlike /api/me/wallet (which verifies a signed message), this endpoint
 * trusts the wallet address that fell out of a successful Phantom
 * `connect` callback decryption. Rationale:
 *
 *   - The user is authenticated via their Google session (only they can
 *     hit this endpoint with their email).
 *   - Phantom only returns a valid connect callback after the user
 *     approves in-app, and the X25519-encrypted payload can only be
 *     decrypted client-side using the dapp keypair in sessionStorage.
 *   - The resulting `public_key` is therefore the wallet the user owns
 *     and personally approved for this site.
 *
 * This is a friends-only service with modest abuse risk. If the gate
 * were high-value (e.g. $1M+ TVL), we'd add a follow-up signMessage
 * deeplink here as proof-of-possession.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { address } = await req.json();
  if (!address || typeof address !== "string") {
    return NextResponse.json(
      { error: "address (Solana public key) required" },
      { status: 400 }
    );
  }

  // Basic sanity: must be a valid base58 Solana public key
  try {
    new PublicKey(address);
  } catch {
    return NextResponse.json(
      { error: "Not a valid Solana public key" },
      { status: 400 }
    );
  }

  const db = await getDb();
  await db.collection("users").updateOne(
    { email: session.user.email },
    {
      $set: {
        walletAddress: address,
        walletVerifiedAt: new Date(),
        walletLinkMethod: "phantom-mobile-deeplink",
      },
    }
  );

  return NextResponse.json({ success: true, walletAddress: address });
}
