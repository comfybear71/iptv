# ComfyTV Stream Proxy — Droplet Setup

A tiny HTTPS reverse-proxy that sits between ComfyTV users' browsers and the
IPTV provider. Bypasses the browser's CORS + mixed-content + TLS-cert-on-IP
restrictions that make direct playback impossible, and has no 60-second
Vercel-serverless timeout.

## What it does

1. Browser requests `https://stream.comfytv.xyz/s/<signed-token>`.
2. Caddy terminates TLS and forwards to the Node service on `localhost:3000`.
3. The Node service verifies the HMAC signature (same secret as Next.js).
4. On success it fetches the upstream MPEG-TS URL (embedded in the signed
   token) and pipes bytes back indefinitely.

## One-time setup (run on the droplet as root)

```bash
# 1. Copy this directory to the droplet
scp -r deploy/droplet/ root@your-droplet:/tmp/comfytv-stream

# 2. SSH in and run the installer
ssh root@your-droplet
cd /tmp/comfytv-stream
DOMAIN=stream.comfytv.xyz bash setup.sh

# 3. The installer prints the shared secret — copy it into Vercel:
#    STREAM_PROXY_HOST=stream.comfytv.xyz
#    STREAM_PROXY_SECRET=<the secret>
#    ENABLE_DROPLET_PLAYER=1
```

## DNS

Add an **A record** in your DNS provider:

```
stream.comfytv.xyz  →  <droplet IP>
```

Caddy obtains a TLS certificate automatically on first HTTPS request (Let's
Encrypt). Give DNS ~5 minutes to propagate before testing.

## Smoke tests

```bash
# Health check (should print "ok")
curl https://stream.comfytv.xyz/health

# Signed URL — get one by hitting the Next.js app's /api/me/stream/<id>
# while logged in. Paste the returned streamUrl here:
curl -I 'https://stream.comfytv.xyz/s/<token-from-next>'
# Expect: HTTP/2 200, content-type video/mp2t (or similar)
```

## Files

| File | Purpose |
|---|---|
| `setup.sh` | Installs Caddy + Node 20 + the stream proxy service. Run once. |
| `server.js` | The actual proxy — validates token, pipes upstream bytes. |
| `package.json` | Declares Node version (uses only built-in modules — no npm install needed). |
| `Caddyfile` | HTTPS reverse-proxy rule (auto Let's Encrypt). |
| `comfytv-stream.service` | systemd unit for auto-start + restart-on-crash. |

## Updating the service

```bash
# Edit /opt/comfytv-stream/server.js on the droplet, then:
systemctl restart comfytv-stream
journalctl -u comfytv-stream -f   # tail logs
```

## Troubleshooting

**`curl stream.comfytv.xyz/health` hangs** → DNS not yet propagated or droplet firewall blocking 443. Open ports 80 + 443:
```bash
ufw allow 80 && ufw allow 443
```

**`403 invalid or expired token`** → Secrets don't match, or the token is >60s old. Double-check `STREAM_PROXY_SECRET` is identical on Vercel and `/etc/comfytv-stream/.env`.

**`502 upstream error`** → The droplet can't reach turbobunny.net. Check:
```bash
curl -I http://turbobunny.net
```
If that fails too, the droplet provider may be blocking outbound HTTP (rare).

**Caddy cert issue** → Force-renew:
```bash
systemctl restart caddy
journalctl -u caddy -f
```
