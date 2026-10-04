#!/usr/bin/env bash
# Daily backup of clients' data, uploaded media and settings. Keeps 14 days.
set -euo pipefail
APP=/opt/nooi; DEST=/var/backups/nooi; mkdir -p "$DEST"; chmod 700 "$DEST"
STAMP="$(date +%F-%H%M)"
tar -czf "$DEST/nooi-$STAMP.tgz" -C "$APP" data .env media 2>/dev/null || tar -czf "$DEST/nooi-$STAMP.tgz" -C "$APP" data .env
find "$DEST" -name 'nooi-*.tgz' -mtime +14 -delete
echo "$(date -Is) backup ok → $DEST/nooi-$STAMP.tgz"
# Optional off-site copy: set BACKUP_RCLONE_REMOTE in .env (e.g. "gdrive:nooi-backups") after installing rclone
REMOTE="$(grep -E '^BACKUP_RCLONE_REMOTE=' $APP/.env | cut -d= -f2- || true)"
[ -n "$REMOTE" ] && command -v rclone >/dev/null && rclone copy "$DEST/nooi-$STAMP.tgz" "$REMOTE" && echo "off-site copy ok"
