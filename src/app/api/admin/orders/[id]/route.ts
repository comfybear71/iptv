import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { authOptions, isAdmin } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { sendCustomerCredentialsEmail } from "@/lib/email";
import { PLANS } from "@/types";

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
    const planInfo = PLANS.find((p) => p.id === order.plan);
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);

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
          credentials: {
            m3uUrl: credentials.m3uUrl,
            username: credentials.username,
            password: credentials.password,
          },
          orderId: params.id,
          createdAt: now,
        },
      },
      { upsert: true }
    );

    try {
      await sendCustomerCredentialsEmail(order.userEmail, {
        plan: planInfo?.name || order.plan,
        m3uUrl: credentials.m3uUrl,
        username: credentials.username,
        password: credentials.password,
      });
    } catch (err) {
      console.error("Failed to send customer email:", err);
    }
  }

  return NextResponse.json({ success: true });
}
