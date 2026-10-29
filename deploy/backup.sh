#!/usr/bin/env bash
# Backup of clients' data, settings and uploaded media — every night (cron, 03:10) and before every update.
# v186: the media is no longer packed into every backup. Each archive held all of it again (1.3 GB a time, kept 14 days, and every
# update made one), and the updates of two busy weeks filled the 100 GB disk. Now:
#   · data + .env → a small archive each time (nooi-data-<date>.tgz), kept 14 days, at most 60;
#   · media → ONE copy beside them (media/), made of hard links on the same disk (no extra space for a file the site still has);
#     a file deleted on the site moves to media-deleted/<day>/ and stays there 30 days;
#   · archives from before (nooi-<date>.tgz, the media inside) are cleared down to the newest one;
#   · nothing new is written when the disk has less than 1 GB free (it says so).
set -euo pipefail
APP="${APP:-/opt/nooi}"; DEST="${DEST:-/var/backups/nooi}"; mkdir -p "$DEST"; chmod 700 "$DEST"
STAMP="$(date +%F-%H%M%S)"; DAY="$(date +%F)"
free_mb() { df -Pm "$DEST" | awk 'NR==2{print $4}'; }

# archives from before v186 (all the media inside each): keep the newest one as a full restore point
OLD="$(ls -1t "$DEST"/nooi-2[0-9][0-9][0-9]-*.tgz 2>/dev/null | tail -n +2 || true)"
if [ -n "$OLD" ]; then n=0; for f in $OLD; do rm -f "$f"; n=$((n+1)); done; echo "$(date -Is) cleared $n old full archives (the media is now kept once, in $DEST/media)"; fi

if [ "$(free_mb)" -lt 1024 ]; then echo "$(date -Is) ⚠ backup skipped — less than 1 GB free on the disk. Free space: bash $APP/deploy/space.sh --free"; exit 0; fi

# data and settings: small, one archive each time
tar -czf "$DEST/nooi-data-$STAMP.tgz" -C "$APP" data .env 2>/dev/null || tar -czf "$DEST/nooi-data-$STAMP.tgz" -C "$APP" data
find "$DEST" -maxdepth 1 -name 'nooi-data-*.tgz' -mtime +14 -delete
ls -1t "$DEST"/nooi-data-*.tgz 2>/dev/null | tail -n +61 | xargs -r rm -f

# media: one copy — hard links where the site's file is on the same disk (no extra space); files deleted on the site kept 30 days
if [ -d "$APP/media" ]; then
  mkdir -p "$DEST/media" "$DEST/media-deleted"
  rsync -a --delete --link-dest="$APP/media/" --backup --backup-dir="$DEST/media-deleted/$DAY" "$APP/media/" "$DEST/media/"
  find "$DEST/media-deleted" -mindepth 1 -maxdepth 1 -type d -mtime +30 -exec rm -rf {} + 2>/dev/null || true
fi
echo "$(date -Is) backup ok → $DEST/nooi-data-$STAMP.tgz + $DEST/media"
# Optional off-site copy: set BACKUP_RCLONE_REMOTE in .env (e.g. "gdrive:nooi-backups") after installing rclone
REMOTE="$(grep -E '^BACKUP_RCLONE_REMOTE=' "$APP/.env" 2>/dev/null | cut -d= -f2- || true)"
if [ -n "$REMOTE" ] && command -v rclone >/dev/null; then rclone copy "$DEST/nooi-data-$STAMP.tgz" "$REMOTE" && rclone copy "$DEST/media" "$REMOTE/media" && echo "off-site copy ok"; fi
