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
  let sub;
  try {
    sub = await db
      .collection("subscriptions")
      .findOne({ _id: new ObjectId(params.id) });
  } catch {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  if (!sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ subscription: sub });
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
  const {
    status,
    credentials,
    extendMonths,
    endDate,
    notes,
  } = body;

  const db = await getDb();
  let sub;
  try {
    sub = await db
      .collection("subscriptions")
      .findOne({ _id: new ObjectId(params.id) });
  } catch {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  if (!sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const update: any = {};

  if (status && ["active", "expired", "cancelled"].includes(status)) {
    update.status = status;
  }

  if (credentials && credentials.m3uUrl && credentials.username && credentials.password) {
    update.credentials = {
      m3uUrl: credentials.m3uUrl,
      username: credentials.username,
      password: credentials.password,
    };
  }

  if (typeof extendMonths === "number" && extendMonths > 0) {
    const base = sub.endDate ? new Date(sub.endDate) : new Date();
    const newEnd =
      base < new Date() ? new Date() : new Date(base);
    newEnd.setMonth(newEnd.getMonth() + extendMonths);
    update.endDate = newEnd;
    update.lastRenewedAt = new Date();
    if (sub.status !== "active") update.status = "active";
  } else if (endDate) {
    update.endDate = new Date(endDate);
  }

  if (typeof notes === "string") {
    update.notes = notes;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db
    .collection("subscriptions")
    .updateOne({ _id: new ObjectId(params.id) }, { $set: update });

  return NextResponse.json({ success: true });
}
