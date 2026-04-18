/**
 * Upstash Redis client + getOrSet caching helper.
 *
 * Caching is OPTIONAL — if UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * aren't set (e.g. during local dev or before the env vars are wired up),
 * `getOrSet` falls back to just running the loader every time. That way
 * the VOD feature works end-to-end without Redis, it's just slower.
 *
 * Setup (one-time):
 *   1. Create a free database at https://upstash.com (Redis → Create).
 *   2. Open the database's REST API tab.
 *   3. Copy UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
 *   4. Add both to your Vercel project env vars.
 *   5. Redeploy. Caching activates automatically.
 */

import { Redis } from "@upstash/redis";

let client: Redis | null = null;

function getClient(): Redis | null {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  client = new Redis({ url, token });
  return client;
}

/**
 * Fetch `key` from Redis; if missing, run `loader`, store the result with
 * the given TTL (seconds), and return it.
 *
 * Results are JSON-serialised. Use for JSON-safe payloads only — no class
 * instances, no Date objects unless you serialise them yourself.
 */
export async function getOrSet<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  const redis = getClient();
  if (!redis) {
    // No cache configured — just run the loader.
    return loader();
  }
  try {
    const cached = await redis.get<T>(key);
    if (cached !== null && cached !== undefined) return cached as T;
  } catch {
    // Redis unreachable — fall through to loader.
  }
  const fresh = await loader();
  try {
    await redis.set(key, fresh as unknown as string, { ex: ttlSeconds });
  } catch {
    // Don't fail the request just because caching failed.
  }
  return fresh;
}

/**
 * Invalidate a cached entry. No-op if cache isn't configured.
 */
export async function invalidate(key: string): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    // ignore
  }
}

/**
 * True if Upstash is actually wired up — useful for admin UIs that want to
 * display cache status.
 */
export function isRedisConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}
