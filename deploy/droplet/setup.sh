#!/usr/bin/env bash
# ComfyTV stream-proxy one-shot installer.
# Run as root on a fresh Ubuntu 22.04 / 24.04 droplet.
#
# Env vars:
#   DOMAIN       — subdomain for the proxy (default: stream.comfytv.xyz)
#   NODE_VERSION — Node major version (default: 20)

set -euo pipefail

DOMAIN="${DOMAIN:-stream.comfytv.xyz}"
NODE_VERSION="${NODE_VERSION:-20}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script as root (sudo bash setup.sh)." >&2
  exit 1
fi

echo "==> Installing prerequisites..."
apt-get update
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https \
  curl ca-certificates gnupg openssl

echo "==> Installing Caddy..."
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update
  apt-get install -y caddy
else
  echo "    Caddy already installed, skipping."
fi

echo "==> Installing Node.js ${NODE_VERSION}..."
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/^v\([0-9]*\).*/\1/')" != "$NODE_VERSION" ]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
  apt-get install -y nodejs
else
  echo "    Node $(node -v) already installed, skipping."
fi

echo "==> Installing comfytv-stream service files..."
mkdir -p /opt/comfytv-stream /etc/comfytv-stream
cp "$SCRIPT_DIR/server.js" /opt/comfytv-stream/server.js
cp "$SCRIPT_DIR/package.json" /opt/comfytv-stream/package.json
cp "$SCRIPT_DIR/comfytv-stream.service" /etc/systemd/system/comfytv-stream.service

echo "==> Generating env file..."
if [ -f /etc/comfytv-stream/.env ]; then
  echo "    /etc/comfytv-stream/.env already exists — keeping existing secret."
  SECRET="$(grep '^STREAM_PROXY_SECRET=' /etc/comfytv-stream/.env | cut -d= -f2-)"
else
  SECRET="$(openssl rand -hex 32)"
  cat > /etc/comfytv-stream/.env <<ENV
STREAM_PROXY_SECRET=$SECRET
PORT=3000
ENV
  chmod 600 /etc/comfytv-stream/.env
fi

echo "==> Writing Caddyfile for $DOMAIN..."
cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
	reverse_proxy localhost:3000 {
		flush_interval -1
	}
	encode zstd gzip
	log {
		output file /var/log/caddy/access.log
		format console
	}
}
CADDY

echo "==> Enabling + starting services..."
systemctl daemon-reload
systemctl enable --now comfytv-stream
systemctl reload caddy || systemctl restart caddy

echo ""
echo "==============================================================="
echo " ComfyTV stream proxy installed."
echo ""
echo " Add the following to your Vercel project environment variables:"
echo ""
echo "   STREAM_PROXY_HOST=$DOMAIN"
echo "   STREAM_PROXY_SECRET=$SECRET"
echo "   ENABLE_DROPLET_PLAYER=1"
echo ""
echo " DNS: ensure an A record points $DOMAIN at this droplet's IP."
echo ""
echo " Smoke test once DNS has propagated:"
echo "   curl https://$DOMAIN/health"
echo ""
echo " Tail logs:"
echo "   journalctl -u comfytv-stream -f"
echo "==============================================================="
