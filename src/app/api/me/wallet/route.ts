import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { verifyMessageSignature } from "@/lib/solana";

// Link a wallet to the authenticated user by verifying a signed message.
// Body: { address, message, signature }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { address, message, signature } = await req.json();

  if (!address || !message || !signature) {
    return NextResponse.json(
      { error: "address, message, signature required" },
      { status: 400 }
    );
  }

  // The message must include the user's email to prevent cross-account replay.
  if (!message.includes(session.user.email)) {
    return NextResponse.json(
      { error: "Message must include your email" },
      { status: 400 }
    );
  }

  const valid = await verifyMessageSignature(address, message, signature);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid signature" },
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
      },
    }
  );

  return NextResponse.json({ success: true, walletAddress: address });
}

// Remove wallet link
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  await db
    .collection("users")
    .updateOne(
      { email: session.user.email },
      { $unset: { walletAddress: "", walletVerifiedAt: "" } }
    );

  return NextResponse.json({ success: true });
}
