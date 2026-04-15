import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { XtreamCredentials } from "@/lib/xtream";
import { DEFAULT_XTREME_HOST } from "@/lib/mybunny";

export type XtremeCredsResult =
  | { ok: true; creds: XtreamCredentials }
  | { ok: false; error: string; status: number };

/**
 * Look up the signed-in user's active subscription credentials.
 */
export async function getUserXtremeCreds(): Promise<XtremeCredsResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { ok: false, error: "Unauthorized", status: 401 };
  }

  const db = await getDb();
  const user = await db
    .collection("users")
    .findOne({ email: session.user.email });
  if (!user) {
    return { ok: false, error: "User not found", status: 404 };
  }

  const sub = await db
    .collection("subscriptions")
    .findOne(
      { userId: user._id.toString(), status: "active" },
      { sort: { createdAt: -1 } }
    );

  const creds = sub?.credentials;
  if (!creds?.xtremeUsername || !creds?.xtremePassword) {
    return {
      ok: false,
      error: "No active subscription with Xtreme credentials",
      status: 403,
    };
  }

  return {
    ok: true,
    creds: {
      host: creds.xtremeHost || DEFAULT_XTREME_HOST,
      username: creds.xtremeUsername,
      password: creds.xtremePassword,
    },
  };
}
