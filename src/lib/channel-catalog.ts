/**
 * Master channel catalog — stored in MongoDB, refreshed manually by admin.
 *
 * Flow:
 *   1. Admin clicks "Refresh Catalog" → refreshMasterCatalog() fetches MyBunny
 *      M3U with env-var reseller creds, parses it, wipes + reloads the
 *      `channels` collection.
 *   2. `/api/channels/categories` + `/api/channels/streams` read from this
 *      collection, not from each user's limited M3U.
 *   3. Per-user playback URLs are built on the fly by swapping the logged-in
 *      user's credentials into the channel's stream URL pattern.
 *
 * This means every ComfyTV user sees the full catalog (all ~129 categories /
 * 21k channels) regardless of what their MyBunny sub-account has provisioned.
 */

import { getDb } from "./mongodb";
import { parseM3u } from "./m3u-parse";
import { DEFAULT_XTREME_HOST } from "./mybunny";

export const CHANNELS_COLLECTION = "channels";
const CATALOG_META_COLLECTION = "catalog_meta";

export interface CatalogChannel {
  streamId: number;
  name: string;
  tvgId: string;
  tvgName: string;
  tvgLogo: string;
  group: string;
  /** e.g. "turbobunny.net" — host from the master M3U stream URL */
  streamHost: string;
  /** "http" or "https" */
  urlScheme: string;
  refreshedAt: Date;
}

export interface CatalogMeta {
  refreshedAt: Date;
  channelCount: number;
  categoryCount: number;
}

function parseStreamUrl(url: string): { host: string; scheme: string } | null {
  try {
    const u = new URL(url);
    return { host: u.host, scheme: u.protocol.replace(/:$/, "") };
  } catch {
    return null;
  }
}

/**
 * Fetch the master M3U from MyBunny using env-var reseller credentials,
 * parse it, and wipe + reload the channels collection. Returns counts.
 */
export async function refreshMasterCatalog(): Promise<{
  channelCount: number;
  categoryCount: number;
  refreshedAt: Date;
}> {
  const username = process.env.MYBUNNY_MASTER_USERNAME;
  const password = process.env.MYBUNNY_MASTER_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "MYBUNNY_MASTER_USERNAME and MYBUNNY_MASTER_PASSWORD must be set"
    );
  }

  const host = DEFAULT_XTREME_HOST.replace(/\/$/, "");
  const url = `${host}/client/download.php?u=${encodeURIComponent(
    username
  )}&p=${encodeURIComponent(password)}`;

  // 25s timeout on the MyBunny fetch — leaves ~35s for parse + DB on a
  // Vercel Pro 60s function budget.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25_000);

  let text: string;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "TiviMate/4.8.0 (Linux; Android 11)",
        Accept:
          "application/x-mpegURL, application/octet-stream, text/plain, */*",
      },
    });
    if (!res.ok) {
      throw new Error(`MyBunny M3U fetch failed: HTTP ${res.status}`);
    }
    text = await res.text();
  } catch (err: unknown) {
    if ((err as { name?: string }).name === "AbortError") {
      throw new Error("MyBunny M3U fetch timed out after 25s");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!text.trim().startsWith("#EXTM3U")) {
    throw new Error("MyBunny returned a non-M3U body");
  }

  const entries = parseM3u(text);
  const refreshedAt = new Date();

  const docs: CatalogChannel[] = [];
  for (const e of entries) {
    if (e.streamId === null) continue;
    const parsed = parseStreamUrl(e.url);
    if (!parsed) continue;
    docs.push({
      streamId: e.streamId,
      name: e.name,
      tvgId: e.tvgId,
      tvgName: e.tvgName,
      tvgLogo: e.tvgLogo,
      group: e.group || "Uncategorised",
      streamHost: parsed.host,
      urlScheme: parsed.scheme,
      refreshedAt,
    });
  }

  const db = await getDb();

  // Drop the collection (O(1), much faster than deleteMany on 21k docs)
  // and also drops indexes so inserts don't pay the index-maintenance cost.
  const existing = await db
    .listCollections({ name: CHANNELS_COLLECTION })
    .toArray();
  if (existing.length > 0) {
    await db.dropCollection(CHANNELS_COLLECTION);
  }

  const coll = db.collection<CatalogChannel>(CHANNELS_COLLECTION);

  if (docs.length > 0) {
    // ordered:false lets the driver parallelise writes → much faster on 21k
    await coll.insertMany(docs, { ordered: false });
  }

  // Recreate indexes AFTER insert (faster than maintaining during insert).
  // The compound { group: 1, name: 1 } covers both category filters AND the
  // default sort used when building the per-user M3U — without it MongoDB
  // had to in-memory sort all 21k docs, which was hanging /api/playlist/...
  await Promise.all([
    coll.createIndex({ streamId: 1 }),
    coll.createIndex({ group: 1, name: 1 }),
    coll.createIndex({ name: 1 }),
  ]);

  const categoryCount = new Set(docs.map((d) => d.group)).size;
  await db
    .collection(CATALOG_META_COLLECTION)
    .updateOne(
      { key: "catalog" },
      { $set: { key: "catalog", refreshedAt, channelCount: docs.length, categoryCount } },
      { upsert: true }
    );

  return { channelCount: docs.length, categoryCount, refreshedAt };
}

export async function getCatalogMeta(): Promise<CatalogMeta | null> {
  const db = await getDb();
  const doc = await db
    .collection(CATALOG_META_COLLECTION)
    .findOne({ key: "catalog" });
  if (!doc) return null;
  return {
    refreshedAt: doc.refreshedAt,
    channelCount: doc.channelCount,
    categoryCount: doc.categoryCount,
  };
}

export async function getCategories(): Promise<
  { category_id: string; category_name: string; count: number }[]
> {
  const db = await getDb();
  const rows = await db
    .collection(CHANNELS_COLLECTION)
    .aggregate([
      { $group: { _id: "$group", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray();
  return rows.map((r) => ({
    category_id: r._id as string,
    category_name: r._id as string,
    count: r.count as number,
  }));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function queryChannels(opts: {
  category?: string | null;
  search?: string;
  page: number;
  pageSize: number;
}): Promise<{ total: number; rows: CatalogChannel[] }> {
  const db = await getDb();
  const coll = db.collection<CatalogChannel>(CHANNELS_COLLECTION);
  const filter: Record<string, unknown> = {};
  if (opts.category) filter.group = opts.category;
  if (opts.search && opts.search.trim()) {
    // Search across every reasonable text field — display name, tvg-name,
    // and tvg-id. MyBunny stores cleaner names in tvg-name ("Rick and Morty")
    // while the display name may be cryptic ("24/7 (DE) …"); tvg-id
    // sometimes contains the show name too.
    const pattern = escapeRegex(opts.search.trim());
    const regex = { $regex: pattern, $options: "i" };
    filter.$or = [
      { name: regex },
      { tvgName: regex },
      { tvgId: regex },
    ];
  }
  const total = await coll.countDocuments(filter);
  const rows = await coll
    .find(filter)
    .sort({ group: 1, name: 1 })
    .skip((opts.page - 1) * opts.pageSize)
    .limit(opts.pageSize)
    .toArray();
  return { total, rows };
}

export async function getAllChannels(): Promise<CatalogChannel[]> {
  const db = await getDb();
  return db
    .collection<CatalogChannel>(CHANNELS_COLLECTION)
    .find({})
    .sort({ group: 1, name: 1 })
    .toArray();
}

/**
 * Build the per-user playback URL by swapping the user's creds into the
 * stream URL pattern: {scheme}://{host}/live/{user}/{pass}/{streamId}.m3u8
 *
 * Use the full Xtream HLS path (/live/.../ID.m3u8) so each URL returns a
 * single-stream playlist (~1KB). The bare form {host}/{user}/{pass}/{id}
 * caused webplayer.online to receive the full master M3U (~6MB) and time
 * out, because that path isn't a single-stream endpoint.
 */
export function buildPerUserStreamUrl(
  channel: Pick<CatalogChannel, "streamHost" | "urlScheme" | "streamId">,
  username: string,
  password: string
): string {
  const u = encodeURIComponent(username);
  const p = encodeURIComponent(password);
  return `${channel.urlScheme}://${channel.streamHost}/live/${u}/${p}/${channel.streamId}.m3u8`;
}
