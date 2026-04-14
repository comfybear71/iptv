import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { authOptions, isAdmin } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { sendCustomerCredentialsEmail } from "@/lib/email";
import { PLANS } from "@/types";

export async function POST(
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

  if (!sub.credentials) {
    return NextResponse.json(
      { error: "Subscription has no credentials" },
      { status: 400 }
    );
  }

  const planInfo = PLANS.find((p) => p.id === sub.plan);

  try {
    await sendCustomerCredentialsEmail(sub.userEmail, {
      plan: planInfo?.name || sub.plan,
      m3uUrl: sub.credentials.m3uUrl,
      username: sub.credentials.username,
      password: sub.credentials.password,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Email send failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
