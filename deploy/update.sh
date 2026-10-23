#!/usr/bin/env bash
# Update nooi.ai to a new package — keeps data, media and .env; rolls back automatically if the new version fails.
# Usage: nooi-update /root/nooi-server.zip
set -euo pipefail
ZIP="${1:-}"; APP="${APP:-/opt/nooi}"; BINDIR="${BINDIR:-/usr/local/bin}"; PORT="$(grep -E '^PORT=' $APP/.env | cut -d= -f2 || echo 8080)"; PORT="${PORT:-8080}"
[ -f "$ZIP" ] || { echo "Usage: nooi-update /path/to/nooi-server.zip"; exit 1; }
TMP="$(mktemp -d)"; unzip -q "$ZIP" -d "$TMP"; NEW="$(find "$TMP" -maxdepth 2 -name server.js -printf '%h\n' | head -1)"
[ -n "$NEW" ] || { echo "server.js not found in the package"; exit 1; }
# v138: mktemp makes its folder for root only (700) and "rsync -a NEW/ APP/" gives the site's folder the same — for the seconds until
# chown below, the running site (user nooi) couldn't open its own folder: "EACCES: permission denied, stat /opt/nooi/public/…",
# and a picture or a save landing then failed. The new version's folders are opened to read (755) before they are copied.
chmod 755 "$TMP" "$NEW"
"$BINDIR/nooi-backup" || true
PREV="${PREV:-${APP}-prev}"; rm -rf "$PREV"; rsync -a --exclude data --exclude media --exclude node_modules "$APP"/ "$PREV"/
rsync -a --delete --exclude data --exclude media --exclude .env --exclude node_modules "$NEW"/ "$APP"/
chown -R nooi:nooi "$APP"; sudo -u nooi -H bash -c "cd $APP && npm install --omit=dev --no-audit --no-fund"
systemctl restart nooi; sleep 4
if curl -fsS --max-time 10 "http://127.0.0.1:$PORT/v1/health" >/dev/null; then echo "✅ Updated"; else
  echo "⚠ New version failed — rolling back"; rsync -a --delete --exclude data --exclude media --exclude .env --exclude node_modules "$PREV"/ "$APP"/
  sudo -u nooi -H bash -c "cd $APP && npm install --omit=dev --no-audit --no-fund"; systemctl restart nooi; exit 1; fi
rm -rf "$TMP"
# v138: the update and backup commands of this version are the ones installed from now on (written beside, then moved in place: this
# script may be the one running)
for f in update:nooi-update backup:nooi-backup; do src="$APP/deploy/${f%%:*}.sh"; dst="$BINDIR/${f#*:}"
  [ -f "$src" ] && [ -d "$BINDIR" ] && t="$(mktemp "$BINDIR/.${f#*:}.XXXXXX")" && cp "$src" "$t" && chmod 755 "$t" && mv -f "$t" "$dst" || true; done
