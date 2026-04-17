// ComfyTV stream proxy — tiny HTTP server.
//
// Verifies an HMAC-signed token (from the ComfyTV Next.js app), extracts the
// upstream IPTV URL embedded in the payload, and pipes its body back to the
// browser. No external npm dependencies; uses only Node's built-in modules.
//
// Env:
//   STREAM_PROXY_SECRET  — shared HMAC secret (same as Vercel).
//   PORT                  — default 3000.

const http = require("node:http");
const crypto = require("node:crypto");

const SECRET = process.env.STREAM_PROXY_SECRET;
const PORT = Number(process.env.PORT || 3000);

if (!SECRET || SECRET.length < 16) {
  console.error("STREAM_PROXY_SECRET is missing or too short (min 16 chars)");
  process.exit(1);
}

// Token format: base64url(payload-json) + "." + base64url(HMAC-SHA256)
// Payload: { u: string (upstream URL), exp: number (unix seconds) }
function verifyToken(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const dot = token.indexOf(".");
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig) return null;

  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(body)
    .digest("base64url");

  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(sig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
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

  try {
    const url = new URL(payload.u);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  } catch {
    return null;
  }

  return payload;
}

async function pipeUpstream(upstream, res) {
  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        const ok = res.write(Buffer.from(value));
        if (!ok) {
          await new Promise((resolve, reject) => {
            res.once("drain", resolve);
            res.once("error", reject);
          });
        }
      }
    }
  } finally {
    try {
      reader.cancel();
    } catch {}
    res.end();
  }
}

const server = http.createServer(async (req, res) => {
  // CORS preflight (Caddy will usually strip these, but be safe).
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }

  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }

  const match = url.pathname.match(/^\/s\/([^/?]+)$/);
  if (!match) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
    return;
  }

  const payload = verifyToken(match[1]);
  if (!payload) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("invalid or expired token");
    return;
  }

  const aborter = new AbortController();
  req.on("close", () => {
    if (!res.writableEnded) aborter.abort();
  });

  let upstream;
  try {
    upstream = await fetch(payload.u, {
      method: "GET",
      redirect: "follow",
      signal: aborter.signal,
      headers: {
        // Spoof a common IPTV-app UA so providers that hotlink-block
        // generic clients still serve content.
        "User-Agent": "VLC/3.0.20 LibVLC/3.0.20",
        Accept: "*/*",
      },
    });
  } catch (err) {
    if (err && err.name === "AbortError") {
      try {
        res.destroy();
      } catch {}
      return;
    }
    console.error("upstream fetch error:", err && err.message);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("upstream error");
    } else {
      res.end();
    }
    return;
  }

  if (!upstream.ok) {
    res.writeHead(upstream.status, { "Content-Type": "text/plain" });
    res.end(`upstream HTTP ${upstream.status}`);
    return;
  }

  const ct =
    upstream.headers.get("content-type") || "application/octet-stream";
  const headers = {
    "Content-Type": ct,
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
    Connection: "keep-alive",
  };
  const len = upstream.headers.get("content-length");
  if (len) headers["Content-Length"] = len;

  res.writeHead(200, headers);

  try {
    await pipeUpstream(upstream, res);
  } catch (err) {
    if (err && err.name === "AbortError") return;
    console.error("pipe error:", err && err.message);
    try {
      res.destroy();
    } catch {}
  }
});

server.listen(PORT, () => {
  console.log(`comfytv-stream listening on :${PORT}`);
});

// Clean shutdown for systemd.
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`received ${sig}, shutting down...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
