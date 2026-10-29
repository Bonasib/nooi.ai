#!/usr/bin/env bash
# v186: what fills the server's disk, and (with --free) clearing what nooi doesn't need. It never touches the site's data, media,
# .env or the newest backups.
#   bash /opt/nooi/deploy/space.sh          → shows where the space went (nothing is changed)
#   bash /opt/nooi/deploy/space.sh --free   → clears: backup archives from before v186 except the newest (each held all the media
#     again — the usual cause of a full disk), the site's temporary files more than a day old, system logs over 300 MB, rotated logs
#     older than a week, the npm and apt download caches. Then it shows the disk again.
set -uo pipefail
APP="${APP:-/opt/nooi}"; BK="${BK:-/var/backups/nooi}"; FREE=0; [ "${1:-}" = "--free" ] && FREE=1
sz() { du -sh "$@" 2>/dev/null | sort -rh; }
echo "== The disk"; df -h / | awk 'NR==1||NR==2'
echo; echo "== nooi's folders"; sz "$APP/media" "$APP/data" "$APP/node_modules" "$APP-prev" "$APP-stage" "$APP-stage.zip" "$BK" /root/nooi-git /root/nooi-update.zip
OLD="$(ls -1t "$BK"/nooi-2[0-9][0-9][0-9]-*.tgz 2>/dev/null | tail -n +2)"; NOLD=$(printf '%s' "$OLD" | grep -c . || true)
if [ "$NOLD" -gt 0 ]; then echo "  backup archives from before v186 (each with all the media inside): $NOLD besides the newest — $(du -ch $OLD 2>/dev/null | tail -1 | cut -f1)"; fi
echo; echo "== Elsewhere"; sz /tmp /tmp/systemd-private-*-nooi*.service-* /var/log /var/lib/docker /var/lib/containerd /root/.npm /home/nooi/.npm /var/cache/apt
echo; echo "== The biggest folders on the disk (a minute at most)"
timeout 90 du -xh --max-depth=2 / 2>/dev/null | sort -rh | head -15
if [ "$FREE" -ne 1 ]; then echo; echo "Nothing was changed. To clear what nooi doesn't need: bash $APP/deploy/space.sh --free"; exit 0; fi   # (a fixed path: the script may come through a pipe)

echo; echo "== Clearing"
if [ "$NOLD" -gt 0 ]; then for f in $OLD; do rm -f "$f"; done; echo "✓ $NOLD old backup archives removed (the newest one is kept)"; fi
# the site's own temporary files: its private /tmp (the service runs with PrivateTmp) — anything there more than a day old — and
# nooi-* left in the shared /tmp by the update scripts
TMPS="$(ls -d /tmp/systemd-private-*-nooi.service-*/tmp /tmp/systemd-private-*-nooi-stage.service-*/tmp 2>/dev/null)"
n=$( { for d in $TMPS; do find "$d" -mindepth 1 -maxdepth 1 -mmin +1440; done; find /tmp -maxdepth 1 -name 'nooi-*' -mmin +1440; } 2>/dev/null | wc -l)
for d in $TMPS; do find "$d" -mindepth 1 -maxdepth 1 -mmin +1440 -exec rm -rf {} + 2>/dev/null; done
find /tmp -maxdepth 1 -name 'nooi-*' -mmin +1440 -exec rm -rf {} + 2>/dev/null; echo "✓ $n old temporary files of the site removed"
command -v journalctl >/dev/null && journalctl --vacuum-size=300M >/dev/null 2>&1 && echo "✓ system logs kept to 300 MB"
find /var/log -type f \( -name '*.gz' -o -name '*.[0-9]' \) -mtime +7 -delete 2>/dev/null && echo "✓ rotated logs older than a week removed"
npm cache clean --force >/dev/null 2>&1; id nooi >/dev/null 2>&1 && sudo -u nooi -H npm cache clean --force >/dev/null 2>&1; echo "✓ npm download cache cleared"
command -v apt-get >/dev/null && apt-get clean >/dev/null 2>&1 && echo "✓ apt download cache cleared"
echo; echo "== The disk now"; df -h / | awk 'NR==1||NR==2'
[ -d /var/lib/docker ] && echo "(Docker's folder is not touched — if it is big, it belongs to something else on this server.)"
exit 0
