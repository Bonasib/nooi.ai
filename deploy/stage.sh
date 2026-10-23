#!/usr/bin/env bash
# Preview a new nooi.ai version BEFORE it goes live — the live site is not touched.
# The preview runs beside the live site at https://YOUR-DOMAIN:8443 (same sign-in), on a COPY of the live data:
# credits spent, jobs and changes there stay in the copy. It never takes payments, never sends emails and never posts
# to social accounts. Pictures and videos it makes do use your AI engine credits, like the live site.
#
#   bash /opt/nooi/deploy/stage.sh /root/nooi-update.zip   → start (or refresh) the preview with this package
#   bash /opt/nooi/deploy/stage.sh promote                 → happy with it: put the same package live (nooi-update), remove the preview
#   bash /opt/nooi/deploy/stage.sh stop                    → remove the preview
set -euo pipefail
APP="${APP:-/opt/nooi}"; STG="${STG:-/opt/nooi-stage}"; ZIPKEEP="${STG}.zip"; SPORT="${STAGE_PORT:-8090}"; PUBPORT="${STAGE_HTTPS_PORT:-8443}"
ETC="${ETC:-/etc}"; NG="$ETC/nginx/sites-available/nooi-stage"; UNIT="$ETC/systemd/system/nooi-stage.service"
[ "$(id -u)" = 0 ] || { echo "Run as root"; exit 1; }
get_env() { grep -E "^$1=" "$2" 2>/dev/null | tail -1 | cut -d= -f2- || true; }
set_env() { local k="$1" v="$2" f="$3" tmp; tmp="$(mktemp)"; grep -vE "^$k=" "$f" > "$tmp" || true; printf '%s=%s\n' "$k" "$v" >> "$tmp"; cat "$tmp" > "$f"; rm -f "$tmp"; }

stop_preview() {
  systemctl disable --now nooi-stage 2>/dev/null || true; rm -f "$UNIT"; systemctl daemon-reload
  rm -f "$ETC/nginx/sites-enabled/nooi-stage" "$NG"; nginx -t >/dev/null 2>&1 && systemctl reload nginx || true
  rm -rf "$STG"; }

case "${1:-}" in
stop)
  stop_preview; echo "✅ Preview removed — the live site was not touched."; exit 0 ;;
promote)
  [ -f "$ZIPKEEP" ] || { echo "No preview package — start one first: bash $0 /root/nooi-update.zip"; exit 1; }
  # v138: with the update steps of the version being put live (they know its needs), else the installed ones
  if [ -f "$STG/deploy/update.sh" ]; then bash "$STG/deploy/update.sh" "$ZIPKEEP"
  elif command -v nooi-update >/dev/null; then nooi-update "$ZIPKEEP"; else bash "$APP/deploy/update.sh" "$ZIPKEEP"; fi
  # v110: the preview is removed once its version is live — left running, it did the live site's work a second time on the
  # same server (and slowed it down)
  stop_preview; echo "✅ The previewed version is now live, and the preview was removed."; exit 0 ;;
"") echo "Usage: bash $0 /root/nooi-update.zip | promote | stop"; exit 1 ;;
esac

ZIP="$1"; [ -f "$ZIP" ] || { echo "Package not found: $ZIP"; exit 1; }
DOMAIN="$(get_env PUBLIC_BASE_URL "$APP/.env" | sed -E 's#^https?://##; s#/.*$##')"
[ -n "$DOMAIN" ] || { echo "PUBLIC_BASE_URL is not set in $APP/.env — run: bash $APP/deploy/activate.sh"; exit 1; }
CERT="$ETC/letsencrypt/live/$DOMAIN"; [ -f "$CERT/fullchain.pem" ] || CERT="$(ls -d "$ETC"/letsencrypt/live/*/ 2>/dev/null | head -1 | sed 's#/$##')"

echo "▶ 1/5 unpacking the new version into $STG"
TMP="$(mktemp -d)"; unzip -q "$ZIP" -d "$TMP"; NEW="$(find "$TMP" -maxdepth 2 -name server.js -printf '%h\n' | head -1)"
[ -n "$NEW" ] || { echo "server.js not found in the package"; exit 1; }
chmod 755 "$TMP" "$NEW"   # (v138: mktemp's root-only folder is not copied onto the preview's folder)
cp "$ZIP" "$ZIPKEEP"; mkdir -p "$STG"
rsync -a --delete --exclude data --exclude media --exclude .env --exclude node_modules "$NEW"/ "$STG"/; rm -rf "$TMP"

echo "▶ 2/5 a copy of the live data (the live data is not changed)"
rm -rf "$STG/data"; cp -a "$APP/data" "$STG/data"
[ -L "$STG/media" ] || { rm -rf "$STG/media"; ln -s "$APP/media" "$STG/media"; }      # old pictures and videos show in the preview

echo "▶ 3/5 settings for the preview"
cp "$APP/.env" "$STG/.env"; chmod 600 "$STG/.env"
# PUBLIC_BASE_URL stays the live address: the media folder is shared, so the AI engines read the preview's uploads from the live site
set_env PORT "$SPORT" "$STG/.env"; set_env NOOI_STAGE 1 "$STG/.env"
chown -R nooi:nooi "$STG"; sudo -u nooi -H bash -c "cd $STG && npm install --omit=dev --no-audit --no-fund >/dev/null"

echo "▶ 4/5 the preview service"
cat > "$UNIT" <<UNIT
[Unit]
Description=nooi.ai preview (not live)
After=network-online.target
[Service]
User=nooi
WorkingDirectory=$STG
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=3
Environment=NODE_ENV=production
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$STG/data $APP/media
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload; systemctl enable nooi-stage >/dev/null 2>&1; systemctl restart nooi-stage; sleep 4
curl -fsS --max-time 10 "http://127.0.0.1:$SPORT/v1/health" >/dev/null || { echo "⚠ The preview didn't start:"; journalctl -u nooi-stage -n 30 --no-pager; exit 1; }

echo "▶ 5/5 the preview address"
if [ -n "$CERT" ] && [ -f "$CERT/fullchain.pem" ]; then
cat > "$NG" <<NGX
server {
  listen $PUBPORT ssl; listen [::]:$PUBPORT ssl;
  server_name $DOMAIN www.$DOMAIN;
  ssl_certificate $CERT/fullchain.pem; ssl_certificate_key $CERT/privkey.pem;
  client_max_body_size 2048M;
  add_header X-Robots-Tag "noindex, nofollow" always;
  location / {
    proxy_pass http://127.0.0.1:$SPORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 900s; proxy_send_timeout 900s; proxy_request_buffering off;
  }
}
NGX
  ln -sf "$NG" "$ETC/nginx/sites-enabled/nooi-stage"
  if nginx -t >/dev/null 2>&1; then systemctl reload nginx; else rm -f "$ETC/nginx/sites-enabled/nooi-stage"; echo "⚠ nginx refused the preview address"; nginx -t; exit 1; fi
  command -v ufw >/dev/null && ufw allow "$PUBPORT/tcp" >/dev/null 2>&1 || true
  echo; echo "✅ Preview ready: https://$DOMAIN:$PUBPORT   (a yellow \"Preview version\" ribbon shows on every page)"
  echo "   If it doesn't open, allow port $PUBPORT in the Hostinger VPS firewall (hPanel → VPS → Security → Firewall)."
else
  echo; echo "✅ Preview running on this server at http://127.0.0.1:$SPORT (no https certificate found for a public address)."
  echo "   From your computer: ssh -L $SPORT:127.0.0.1:$SPORT root@YOUR-SERVER  then open http://localhost:$SPORT"
fi
echo "   Happy with it?  bash $APP/deploy/stage.sh promote      Not happy?  bash $APP/deploy/stage.sh stop"
