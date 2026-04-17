/**
 * Stream-token signing + verification.
 *
 * The ComfyTV Next.js app signs a short-lived HMAC token containing the
 * upstream IPTV URL (with the user's per-account credentials) and the
 * expiry. The proxy on the DigitalOcean droplet verifies the same token
 * with the same secret (STREAM_PROXY_SECRET), then fetches the upstream
 * and pipes the response back with CORS headers.
 *
 * Token shape: base64url(payload JSON) + "." + base64url(HMAC-SHA256).
 * Payload: { u: string, exp: number }  — u = upstream URL, exp = unix secs.
 *
 * Matches deploy/droplet/server.js byte-for-byte.
 */

import crypto from "node:crypto";

export interface StreamTokenPayload {
  /** Upstream IPTV URL with user credentials embedded */
  u: string;
  /** Unix seconds; token is rejected if older than this */
  exp: number;
}

export function signStreamToken(
  payload: StreamTokenPayload,
  secret: string
): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function verifyStreamToken(
  token: string,
  secret: string
): StreamTokenPayload | null {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const dot = token.indexOf(".");
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig) return null;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64url");

  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(sig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  let payload: StreamTokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as StreamTokenPayload;
  } catch {
    return null;
  }
  if (
    !payload ||
    typeof payload.u !== "string" ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

/**
 * Build a full proxy URL for the browser to fetch.
 *   https://{STREAM_PROXY_HOST}/s/{token}
 */
export function buildProxyStreamUrl(params: {
  upstreamUrl: string;
  proxyHost: string;
  secret: string;
  ttlSeconds?: number;
}): string {
  const ttl = params.ttlSeconds ?? 60;
  const token = signStreamToken(
    {
      u: params.upstreamUrl,
      exp: Math.floor(Date.now() / 1000) + ttl,
    },
    params.secret
  );
  const host = params.proxyHost.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${host}/s/${token}`;
}
