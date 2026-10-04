#!/usr/bin/env bash
# nooi.ai — one-command install on a fresh Ubuntu 22.04 / 24.04 VPS (e.g. Hostinger KVM)
# Usage (as root):   bash install.sh nooi.ai contact@nooi.ai
set -euo pipefail
DOMAIN="${1:-}"; EMAIL="${2:-}"
[ -z "$DOMAIN" ] || [ -z "$EMAIL" ] && { echo "Usage: bash install.sh <domain> <admin-email>   e.g. bash install.sh nooi.ai contact@nooi.ai"; exit 1; }
[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo -i)"; exit 1; }
APP=/opt/nooi; SRC="$(cd "$(dirname "$0")/.." && pwd)"; PORT=8080
say(){ printf "\n\033[1;32m▶ %s\033[0m\n" "$*"; }

say "1/10 System update & packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get upgrade -y
apt-get install -y curl ca-certificates gnupg git rsync unzip ufw fail2ban nginx certbot python3-certbot-nginx ffmpeg unattended-upgrades dnsutils

say "2/10 Node.js 20"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
fi
node -v

say "3/10 Swap (helps small VPS plans)"
if [ "$(free -m | awk '/Mem:/{print $2}')" -lt 4000 ] && ! swapon --show | grep -q swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

say "4/10 App user & files → $APP"
id nooi >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin nooi
mkdir -p "$APP"
rsync -a --delete --exclude data --exclude media --exclude .env --exclude node_modules "$SRC"/ "$APP"/
mkdir -p "$APP/data" "$APP/media"
chown -R nooi:nooi "$APP"
sudo -u nooi -H bash -c "cd $APP && npm install --omit=dev --no-audit --no-fund"

say "5/10 Environment (.env)"
if [ ! -f "$APP/.env" ]; then
  cp "$APP/.env.example" "$APP/.env"
  set_env(){ grep -q "^$1=" "$APP/.env" && sed -i "s|^$1=.*|$1=$2|" "$APP/.env" || echo "$1=$2" >> "$APP/.env"; }
  set_env PORT "$PORT"; set_env PUBLIC_BASE_URL "https://$DOMAIN"; set_env ADMIN_EMAILS "$EMAIL"
  set_env SECRET_KEY "$(openssl rand -hex 32)"; set_env SUPPORT_INBOX "$EMAIL"; set_env EMAIL_FROM "\"nooi.ai <$EMAIL>\""
  mkdir -p "$APP/data"; [ -f "$APP/data/db.json" ] || { cp "$APP/deploy/db.seed.json" "$APP/data/db.json"; echo "  ✓ database created: $APP/data/db.json"; }
  echo "  ✓ .env created (SECRET_KEY generated). Add your API keys later: nano $APP/.env  — or from the Admin dashboard."
fi
chown nooi:nooi "$APP/.env"; chmod 600 "$APP/.env"

say "6/10 Service (auto-start, auto-restart)"
cat > /etc/systemd/system/nooi.service <<UNIT
[Unit]
Description=nooi.ai studio server
After=network-online.target
Wants=network-online.target
[Service]
User=nooi
WorkingDirectory=$APP
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$APP/data $APP/media
LimitNOFILE=65535
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload && systemctl enable --now nooi
sleep 3; curl -fsS "http://127.0.0.1:$PORT/v1/health" >/dev/null && echo "  ✓ app is running" || { journalctl -u nooi -n 40 --no-pager; exit 1; }

say "7/10 Nginx (reverse proxy, uploads up to 500 MB)"
cat > /etc/nginx/sites-available/nooi <<NGX
server {
  listen 80; listen [::]:80;
  server_name $DOMAIN www.$DOMAIN;
  client_max_body_size 500M;
  gzip on; gzip_types text/css application/javascript application/json image/svg+xml; gzip_min_length 1024;
  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;
  add_header X-Frame-Options SAMEORIGIN always;
  location /media/ { proxy_pass http://127.0.0.1:$PORT; expires 7d; }
  location / {
    proxy_pass http://127.0.0.1:$PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 300s; proxy_send_timeout 300s;
  }
}
NGX
ln -sf /etc/nginx/sites-available/nooi /etc/nginx/sites-enabled/nooi
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

say "8/10 Firewall & brute-force protection"
ufw allow OpenSSH >/dev/null; ufw allow 'Nginx Full' >/dev/null; ufw --force enable
systemctl enable --now fail2ban

say "9/10 HTTPS certificate (Let's Encrypt, auto-renew)"
IP="$(curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}')"
DNS="$(dig +short A "$DOMAIN" | tail -1)"
if [ "$DNS" = "$IP" ]; then
  WWW=""; [ "$(dig +short A "www.$DOMAIN" | tail -1)" = "$IP" ] && WWW="-d www.$DOMAIN"
  certbot --nginx -d "$DOMAIN" $WWW --redirect -m "$EMAIL" --agree-tos -n && echo "  ✓ https://$DOMAIN"
else
  echo "  ⚠ $DOMAIN points to '$DNS', this server is '$IP'. Set the DNS A records (see deploy/README.md), wait a few minutes, then run:"
  echo "    certbot --nginx -d $DOMAIN -d www.$DOMAIN --redirect -m $EMAIL --agree-tos -n"
fi

say "10/10 Automation: backups, health checks, security updates"
install -m 755 "$APP/deploy/backup.sh" /usr/local/bin/nooi-backup
install -m 755 "$APP/deploy/update.sh" /usr/local/bin/nooi-update
cat > /etc/cron.d/nooi <<CRON
# daily backup at 03:10, keep 14 days
10 3 * * * root /usr/local/bin/nooi-backup >> /var/log/nooi-backup.log 2>&1
# health check every 5 minutes — restart if the app stops answering
*/5 * * * * root curl -fsS --max-time 10 http://127.0.0.1:$PORT/v1/health >/dev/null || systemctl restart nooi
CRON
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true

cat <<DONE

✅ nooi.ai is installed.
   Site:        https://$DOMAIN   (http until the certificate is issued)
   Owner/admin: $EMAIL  (sign in with this email to open the Admin dashboard)
   App folder:  $APP      Logs: journalctl -u nooi -f
   Next:  1) nano $APP/.env  → add Firebase (sign-in), email, AI and payment keys
          2) systemctl restart nooi
   Update later:  nooi-update /path/to/nooi-server.zip
DONE
if ! grep -q "^FIREBASE_PROJECT_ID=." "$APP/.env"; then echo "⚠ Sign-in is not configured yet (FIREBASE_*). Until it is, the site runs as a single local user — set it up before inviting clients."; fi
