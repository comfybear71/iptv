import { randomBytes } from "crypto";
import { getDb } from "@/lib/mongodb";
import type { Document, WithId } from "mongodb";

/**
 * Return the user's playlist token, generating + persisting one if missing.
 * The token is an opaque, ComfyTV-owned identifier used in public M3U URLs
 * like https://comfytv.xyz/api/playlist/{token}.m3u — so if it ever leaks,
 * we can rotate it without rotating the user's MyBunny credentials.
 */
export async function getOrCreatePlaylistToken(
  user: WithId<Document>
): Promise<string> {
  if (typeof user.playlistToken === "string" && user.playlistToken.length > 0) {
    return user.playlistToken;
  }
  const token = randomBytes(16).toString("hex");
  const db = await getDb();
  await db
    .collection("users")
    .updateOne({ _id: user._id }, { $set: { playlistToken: token } });
  return token;
}

/**
 * Build the public M3U playlist URL for a given token.
 */
export function buildPlaylistUrl(
  origin: string | undefined,
  token: string
): string {
  const base = (origin || "https://comfytv.xyz").replace(/\/$/, "");
  return `${base}/api/playlist/${token}.m3u`;
}
