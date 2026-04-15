import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";

// GET  → { favoriteStreamIds: number[] }
// POST { streamId: number, favorite: boolean } → toggles one favorite.
//
// Favorites are stored on the user record and automatically included at
// the top of the user's personal M3U playlist under the group "⭐ Favorites".

async function resolveUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { error: "Unauthorized", status: 401 } as const;
  }
  const db = await getDb();
  const user = await db
    .collection("users")
    .findOne({ email: session.user.email });
  if (!user) {
    return { error: "User not found", status: 404 } as const;
  }
  return { user, db } as const;
}

export async function GET() {
  const r = await resolveUser();
  if ("error" in r) {
    return NextResponse.json({ error: r.error }, { status: r.status });
  }
  const ids: number[] = Array.isArray(r.user.favoriteStreamIds)
    ? r.user.favoriteStreamIds
        .map((x: unknown) => Number(x))
        .filter((n: number) => Number.isFinite(n))
    : [];
  return NextResponse.json({ favoriteStreamIds: ids });
}

const MAX_FAVORITES = 500;

export async function POST(req: NextRequest) {
  const r = await resolveUser();
  if ("error" in r) {
    return NextResponse.json({ error: r.error }, { status: r.status });
  }

  const body = await req.json().catch(() => null);
  const streamId = Number(body?.streamId);
  const favorite = !!body?.favorite;

  if (!Number.isFinite(streamId) || streamId <= 0) {
    return NextResponse.json(
      { error: "streamId must be a positive number" },
      { status: 400 }
    );
  }

  const current: number[] = Array.isArray(r.user.favoriteStreamIds)
    ? r.user.favoriteStreamIds
        .map((x: unknown) => Number(x))
        .filter((n: number) => Number.isFinite(n))
    : [];

  let next: number[];
  if (favorite) {
    if (current.includes(streamId)) {
      next = current;
    } else {
      if (current.length >= MAX_FAVORITES) {
        return NextResponse.json(
          { error: `Favorites limit is ${MAX_FAVORITES}` },
          { status: 400 }
        );
      }
      next = [...current, streamId];
    }
  } else {
    next = current.filter((id) => id !== streamId);
  }

  await r.db.collection("users").updateOne(
    { _id: r.user._id },
    {
      $set: {
        favoriteStreamIds: next,
        favoritesUpdatedAt: new Date(),
      },
    }
  );

  return NextResponse.json({ success: true, favoriteStreamIds: next });
}
