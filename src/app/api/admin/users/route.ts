import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { getBudjuBalance } from "@/lib/solana";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDb();
  const users = await db
    .collection("users")
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  // Active subscription counts per user
  const subscriptions = await db
    .collection("subscriptions")
    .find({ status: "active" })
    .toArray();

  const subMap: Record<string, number> = {};
  for (const sub of subscriptions) {
    subMap[sub.userId] = (subMap[sub.userId] || 0) + 1;
  }

  // Fetch on-chain BUDJU for every user with a linked wallet, in parallel.
  // At friends/family scale (≤ ~50 users) this stays well under Vercel Pro's
  // 60s function timeout. Failures silently fall back to null so one bad
  // wallet doesn't break the whole list.
  const budjuEntries = await Promise.all(
    users.map(async (u) => {
      if (!u.walletAddress) return [u._id.toString(), null] as const;
      try {
        const bal = await getBudjuBalance(u.walletAddress);
        return [u._id.toString(), bal] as const;
      } catch {
        return [u._id.toString(), null] as const;
      }
    })
  );
  const budjuMap: Record<string, number | null> = Object.fromEntries(
    budjuEntries
  );

  const usersWithSubs = users.map((u) => ({
    ...u,
    activeSubscriptions: subMap[u._id.toString()] || 0,
    balanceSOL: u.balanceSOL || 0,
    balanceBUDJU: u.balanceBUDJU || 0,
    budjuOnChain: budjuMap[u._id.toString()],
    disabled: u.disabled || false,
    walletAddress: u.walletAddress || null,
  }));

  return NextResponse.json({ users: usersWithSubs });
}
