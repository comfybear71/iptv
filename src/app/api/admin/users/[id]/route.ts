import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { authOptions, isAdmin } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDb();

  let user;
  try {
    user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(params.id) });
  } catch {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const orders = await db
    .collection("orders")
    .find({ userId: params.id })
    .sort({ createdAt: -1 })
    .toArray();

  const subscriptions = await db
    .collection("subscriptions")
    .find({ userId: params.id })
    .sort({ createdAt: -1 })
    .toArray();

  const ledger = await db
    .collection("ledger")
    .find({ userId: params.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  return NextResponse.json({ user, orders, subscriptions, ledger });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { role, autoRenew, disabled } = body;

  const update: any = {};
  if (role === "user" || role === "admin") update.role = role;
  if (typeof autoRenew === "boolean") update.autoRenew = autoRenew;
  if (typeof disabled === "boolean") update.disabled = disabled;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const db = await getDb();
  try {
    await db
      .collection("users")
      .updateOne({ _id: new ObjectId(params.id) }, { $set: update });
  } catch {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
