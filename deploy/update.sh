#!/usr/bin/env bash
# Update nooi.ai to a new package — keeps data, media and .env; rolls back automatically if the new version fails.
# Usage: nooi-update /root/nooi-server.zip
set -euo pipefail
ZIP="${1:-}"; APP=/opt/nooi; PORT="$(grep -E '^PORT=' $APP/.env | cut -d= -f2 || echo 8080)"; PORT="${PORT:-8080}"
[ -f "$ZIP" ] || { echo "Usage: nooi-update /path/to/nooi-server.zip"; exit 1; }
TMP="$(mktemp -d)"; unzip -q "$ZIP" -d "$TMP"; NEW="$(find "$TMP" -maxdepth 2 -name server.js -printf '%h\n' | head -1)"
[ -n "$NEW" ] || { echo "server.js not found in the package"; exit 1; }
/usr/local/bin/nooi-backup || true
PREV="/opt/nooi-prev"; rm -rf "$PREV"; rsync -a --exclude data --exclude media --exclude node_modules "$APP"/ "$PREV"/
rsync -a --delete --exclude data --exclude media --exclude .env --exclude node_modules "$NEW"/ "$APP"/
chown -R nooi:nooi "$APP"; sudo -u nooi -H bash -c "cd $APP && npm install --omit=dev --no-audit --no-fund"
systemctl restart nooi; sleep 4
if curl -fsS --max-time 10 "http://127.0.0.1:$PORT/v1/health" >/dev/null; then echo "✅ Updated"; else
  echo "⚠ New version failed — rolling back"; rsync -a --delete --exclude data --exclude media --exclude .env --exclude node_modules "$PREV"/ "$APP"/
  sudo -u nooi -H bash -c "cd $APP && npm install --omit=dev --no-audit --no-fund"; systemctl restart nooi; exit 1; fi
rm -rf "$TMP"
