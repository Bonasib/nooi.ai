#!/usr/bin/env bash
# Update nooi.ai to a new package — keeps data, media and .env; rolls back automatically if the new version fails.
# Usage: nooi-update /root/nooi-server.zip
set -euo pipefail
ZIP="${1:-}"; APP="${APP:-/opt/nooi}"; BINDIR="${BINDIR:-/usr/local/bin}"; PORT="$(grep -E '^PORT=' $APP/.env | cut -d= -f2 || echo 8080)"; PORT="${PORT:-8080}"
[ -f "$ZIP" ] || { echo "Usage: nooi-update /path/to/nooi-server.zip"; exit 1; }
# v188: on a nearly full disk the package can't even be unpacked — the old backup archives (all the media inside each, from before
# v186) are cleared first, keeping the newest, and the system log is cut to 300 MB
if [ "$(df -Pm "$APP" | awk 'NR==2{print $4}')" -lt 3072 ]; then
  { ls -1t /var/backups/nooi/nooi-2[0-9][0-9][0-9]-*.tgz 2>/dev/null | tail -n +2 | xargs -r rm -f; } || true
  { command -v journalctl >/dev/null && journalctl --vacuum-size=300M >/dev/null 2>&1; } || true; fi
TMP="$(mktemp -d)"; unzip -q "$ZIP" -d "$TMP"; NEW="$(find "$TMP" -maxdepth 2 -name server.js -printf '%h\n' | head -1)"
[ -n "$NEW" ] || { echo "server.js not found in the package"; exit 1; }
# v138: mktemp makes its folder for root only (700) and "rsync -a NEW/ APP/" gives the site's folder the same — for the seconds until
# chown below, the running site (user nooi) couldn't open its own folder: "EACCES: permission denied, stat /opt/nooi/public/…",
# and a picture or a save landing then failed. The new version's folders are opened to read (755) before they are copied.
chmod 755 "$TMP" "$NEW"
# v186: the new package's backup (data + settings in a small archive, the media kept once) — the installed one may still be an old
# one that packs all the media again; and a word when the disk is nearly full
if [ -f "$NEW/deploy/backup.sh" ]; then APP="$APP" bash "$NEW/deploy/backup.sh" || true; else "$BINDIR/nooi-backup" || true; fi
FREE_MB="$(df -Pm "$APP" | awk 'NR==2{print $4}')"; [ "${FREE_MB:-0}" -lt 2048 ] && echo "⚠ Only ${FREE_MB} MB free on the disk — after this update: bash $APP/deploy/space.sh --free"
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
# v188: the server's own disk timer — every 5 minutes it clears what nooi doesn't need when Admin asks ("Free space now") or the disk
# is 90 % full, and keeps the report Admin shows ("What fills the disk") up to date (deploy/space.sh --auto)
CROND="${CROND:-/etc/cron.d}"
if [ -d "$CROND" ] && [ -f "$APP/deploy/space.sh" ]; then
  printf 'SHELL=/bin/bash\n*/5 * * * * root APP=%s nice -n 10 bash %s/deploy/space.sh --auto >/dev/null 2>&1\n' "$APP" "$APP" > "$CROND/nooi-space" && chmod 644 "$CROND/nooi-space"
  (APP="$APP" nohup nice -n 10 bash "$APP/deploy/space.sh" --json >/dev/null 2>&1 &) || true; fi
