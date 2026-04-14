import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { authOptions, isAdmin } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { sendCustomerCredentialsEmail } from "@/lib/email";
import { PLANS, SubscriptionCredentials } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDb();
  let order;
  try {
    order = await db
      .collection("orders")
      .findOne({ _id: new ObjectId(params.id) });
  } catch {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}

function sanitizeCredentials(
  raw: any
): SubscriptionCredentials | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c: SubscriptionCredentials = {};
  const strFields: (keyof SubscriptionCredentials)[] = [
    "xtremeHost",
    "xtremeUsername",
    "xtremePassword",
    "channelName",
  ];
  for (const f of strFields) {
    if (typeof raw[f] === "string" && raw[f].trim()) {
      (c as any)[f] = raw[f].trim();
    }
  }
  const size = Number(raw.collectionSize);
  if ([1, 2, 3, 4].includes(size)) {
    c.collectionSize = size as 1 | 2 | 3 | 4;
  }
  return Object.keys(c).length ? c : undefined;
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
  const { status, credentials } = body;

  const db = await getDb();
  let order;
  try {
    order = await db
      .collection("orders")
      .findOne({ _id: new ObjectId(params.id) });
  } catch {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const update: any = { updatedAt: new Date() };

  if (status === "confirmed" || status === "provisioned") {
    update.status = status;
  }

  await db
    .collection("orders")
    .updateOne({ _id: new ObjectId(params.id) }, { $set: update });

  // If provisioning with credentials, create/update subscription and email customer
  if (status === "provisioned" && credentials) {
    const cleanCreds = sanitizeCredentials(credentials);
    if (!cleanCreds) {
      return NextResponse.json(
        { error: "At least one credential field is required" },
        { status: 400 }
      );
    }

    const planInfo = PLANS.find((p) => p.id === order.plan);
    const now = new Date();
    const endDate = new Date(now);
    // Honor the order's billing duration (defaults to 1 month for legacy orders)
    const months = typeof order.months === "number" && order.months > 0 ? order.months : 1;
    endDate.setMonth(endDate.getMonth() + months);

    await db.collection("subscriptions").updateOne(
      { orderId: params.id },
      {
        $set: {
          userId: order.userId,
          userEmail: order.userEmail,
          plan: order.plan,
          connections: planInfo?.connections || 1,
          status: "active",
          startDate: now,
          endDate,
          credentials: cleanCreds,
          orderId: params.id,
          createdAt: now,
        },
      },
      { upsert: true }
    );

    try {
      await sendCustomerCredentialsEmail(order.userEmail, {
        plan: planInfo?.name || order.plan,
        credentials: cleanCreds,
      });
    } catch (err) {
      console.error("Failed to send customer email:", err);
    }
  }

  return NextResponse.json({ success: true });
}
