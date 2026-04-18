/**
 * Upstash Redis client + getOrSet caching helper.
 *
 * Caching is OPTIONAL — if no Redis env vars are set, `getOrSet` falls
 * back to just running the loader every time. That way the VOD feature
 * works end-to-end without Redis, it's just slower.
 *
 * Recognises two env var naming conventions:
 *   - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (plain Upstash)
 *   - `KV_REST_API_URL` + `KV_REST_API_TOKEN` (Vercel Marketplace's
 *     "Upstash for Redis" integration — same service under the hood,
 *     different env var names injected automatically).
 *
 * Setup (pick one):
 *
 *   Vercel Marketplace (easiest):
 *     Project → Storage → Browse Marketplace → Upstash for Redis → Create.
 *     Vercel injects KV_REST_API_URL/TOKEN into all environments.
 *
 *   Plain Upstash:
 *     Create a DB at https://upstash.com → copy REST URL + TOKEN from the
 *     REST API tab → add as UPSTASH_REDIS_REST_URL/_TOKEN in Vercel.
 */

import { Redis } from "@upstash/redis";

let client: Redis | null = null;

function getClient(): Redis | null {
  if (client) return client;
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
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
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return !!(url && token);
}
