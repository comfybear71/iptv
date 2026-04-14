import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { authOptions, isAdmin } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { sendCustomerCredentialsEmail } from "@/lib/email";
import { PLANS, PlanType, SubscriptionCredentials } from "@/types";

function sanitizeCredentials(
  raw: any
): SubscriptionCredentials | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c: SubscriptionCredentials = {};
  const strFields: (keyof SubscriptionCredentials)[] = [
    "xtremeHost",
    "xtremeUsername",
    "xtremePassword",
    "m3uUrlLiveTV",
    "m3uUrlMovies",
    "m3uUrlSeries",
    "m3uUrlAll",
    "channelName",
    "webPlayerUrl",
  ];
  for (const f of strFields) {
    if (typeof raw[f] === "string" && raw[f].trim()) {
      (c as any)[f] = raw[f].trim();
    }
  }
  return Object.keys(c).length ? c : undefined;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDb();
  const subscriptions = await db
    .collection("subscriptions")
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json({ subscriptions });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    userId,
    plan,
    months,
    credentials,
    notes,
    sendEmail,
  } = body;

  if (!userId || !plan || typeof months !== "number" || months <= 0) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const planInfo = PLANS.find((p) => p.id === (plan as PlanType));
  if (!planInfo) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const db = await getDb();
  let user;
  try {
    user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
  } catch {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + months);

  const sub: any = {
    userId,
    userEmail: user.email,
    plan,
    connections: planInfo.connections,
    status: "active",
    startDate,
    endDate,
    orderId: "manual",
    createdAt: new Date(),
  };

  const cleanCreds = sanitizeCredentials(credentials);
  if (cleanCreds) {
    sub.credentials = cleanCreds;
  }

  if (notes) sub.notes = notes;

  const result = await db.collection("subscriptions").insertOne(sub);

  if (sendEmail && cleanCreds) {
    try {
      await sendCustomerCredentialsEmail(user.email, {
        plan: planInfo.name,
        credentials: cleanCreds,
      });
    } catch (err) {
      console.error("Failed to send customer email:", err);
    }
  }

  return NextResponse.json(
    { subscriptionId: result.insertedId },
    { status: 201 }
  );
}
