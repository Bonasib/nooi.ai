#!/usr/bin/env bash
# v186: what fills the server's disk, and (with --free) clearing what nooi doesn't need. It never touches the site's data, media,
# .env or the newest backups.
#   bash /opt/nooi/deploy/space.sh          → shows where the space went (nothing is changed)
#   bash /opt/nooi/deploy/space.sh --free   → clears: backup archives from before v186 except the newest (each held all the media
#     again — the usual cause of a full disk), the site's temporary files more than a day old, system logs over 300 MB, rotated logs
#     older than a week, the npm and apt download caches, crash dumps, old update copies. Then it shows the disk again.
# v188: it works on a disk that is 100 % full (it writes nothing before it has cleared), it also finds big single files and space
# held by programs that still have deleted files open (that space comes back only when the program restarts — nooi and the system
# log are restarted for it), and two modes for the server's own timer (/etc/cron.d/nooi-space, put in place by the update):
#   --json   → writes what fills the disk to /opt/nooi/data/space188.json (Admin shows it: "What fills the disk")
#   --auto   → every 5 minutes: clears when Admin asked for it ("Free space now") or when the disk is 90 % full (at most every 6
#              hours), and refreshes the report every hour
set -uo pipefail
APP="${APP:-/opt/nooi}"; BK="${BK:-/var/backups/nooi}"; ROOT="${SPACE_ROOT:-/}"; MODE="report"
case "${1:-}" in --free) MODE=free ;; --json) MODE=json ;; --auto) MODE=auto ;; esac
DATA="$APP/data"; JSON="$DATA/space188.json"; FLAG="$DATA/space188.free"; STAMP="$DATA/.space188.auto"
QUIET=0; [ "$MODE" = "report" ] || [ "$MODE" = "free" ] || QUIET=1
say() { [ "$QUIET" -eq 1 ] || echo "$@"; }
sz() { du -sh "$@" 2>/dev/null | sort -rh; }
pct() { df -P "$ROOT" | awk 'NR==2{gsub("%","",$5);print $5}'; }
availk() { df -Pk "$ROOT" | awk 'NR==2{print $4}'; }
je() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\000-\037'; }
OLD="$(ls -1t "$BK"/nooi-2[0-9][0-9][0-9]-*.tgz 2>/dev/null | tail -n +2)"; NOLD=$(printf '%s' "$OLD" | grep -c . || true)
# programs holding deleted files open: "<kB> <program>" per program (only those over 50 MB)
held() { for fd in /proc/[0-9]*/fd/*; do l="$(readlink "$fd" 2>/dev/null)" || continue; case "$l" in *"(deleted)") ;; *) continue ;; esac
  s="$(stat -L -c %s "$fd" 2>/dev/null)" || continue; p="${fd#/proc/}"; p="${p%%/*}"; echo "$s $(cat "/proc/$p/comm" 2>/dev/null || echo '?')@$(stat -c %U "/proc/$p" 2>/dev/null || echo '?')"; done \
  | awk '{k[$2]+=$1} END {for (n in k) if (k[n] > 52428800) printf "%d %s\n", k[n]/1024, n}' | sort -rn; }

FREED=""; FREED_GB=0
clear_space() {   # what nooi doesn't need; FREED says what was done
  local a0 n TMPS h; a0="$(availk)"
  # 1. the backup archives from before v186 (all the media inside each) — first, so the rest has room to work
  if [ "$NOLD" -gt 0 ]; then for f in $OLD; do rm -f "$f"; done; FREED="$FREED old backup archives: $NOLD;"; say "✓ $NOLD old backup archives removed (the newest one is kept)"; NOLD=0; fi
  # 2. the site's own temporary files more than a day old (its private /tmp, nooi-* in the shared /tmp)
  TMPS="$(ls -d /tmp/systemd-private-*-nooi.service-*/tmp /tmp/systemd-private-*-nooi-stage.service-*/tmp 2>/dev/null)"
  n=$( { for d in $TMPS; do find "$d" -mindepth 1 -maxdepth 1 -mmin +1440; done; find /tmp -maxdepth 1 -name 'nooi-*' -mmin +1440; } 2>/dev/null | wc -l)
  for d in $TMPS; do find "$d" -mindepth 1 -maxdepth 1 -mmin +1440 -exec rm -rf {} + 2>/dev/null; done
  find /tmp -maxdepth 1 -name 'nooi-*' -mmin +1440 -exec rm -rf {} + 2>/dev/null
  [ "$n" -gt 0 ] && FREED="$FREED temporary files: $n;"; say "✓ $n old temporary files of the site removed"
  # 3. crash dumps, the copies a deploy makes (made again by the next one), old copies of .env (the newest 5 kept)
  n=$(find /var/crash /var/lib/systemd/coredump -type f -mmin +1440 2>/dev/null | wc -l)
  find /var/crash /var/lib/systemd/coredump -type f -mmin +1440 -delete 2>/dev/null
  [ "$n" -gt 0 ] && { FREED="$FREED crash dumps: $n;"; say "✓ $n crash dumps removed"; }
  for f in /root/nooi-git /root/nooi-update.zip; do
    if [ -e "$f" ] && [ -n "$(find "$f" -maxdepth 0 -mmin +1440 2>/dev/null)" ]; then rm -rf "$f"; FREED="$FREED $f;"; say "✓ $f removed (the next update makes it again)"; fi; done
  ls -1t "$APP"/.env.bak.* 2>/dev/null | tail -n +6 | xargs -r rm -f
  # 4. system logs, download caches
  command -v journalctl >/dev/null && journalctl --vacuum-size=300M >/dev/null 2>&1 && say "✓ system logs kept to 300 MB"
  find /var/log -type f \( -name '*.gz' -o -name '*.[0-9]' \) -mtime +7 -delete 2>/dev/null && say "✓ rotated logs older than a week removed"
  npm cache clean --force >/dev/null 2>&1; id nooi >/dev/null 2>&1 && sudo -u nooi -H npm cache clean --force >/dev/null 2>&1; say "✓ npm download cache cleared"
  command -v apt-get >/dev/null && apt-get clean >/dev/null 2>&1 && say "✓ apt download cache cleared"
  [ -d /var/lib/snapd/cache ] && find /var/lib/snapd/cache -type f -delete 2>/dev/null
  # 5. space held by deleted files still open: nooi and the system log give it back when restarted
  h="$(held)"
  while read -r k p; do [ -n "${k:-}" ] || continue
    case "$p" in
      node@nooi) if command -v systemctl >/dev/null && systemctl restart nooi 2>/dev/null; then FREED="$FREED nooi restarted ($((k / 1024)) MB held);"; say "✓ nooi restarted — it held $((k / 1024)) MB of deleted files"; fi ;;
      systemd-journal@*) if command -v systemctl >/dev/null && systemctl restart systemd-journald 2>/dev/null; then FREED="$FREED system log restarted ($((k / 1024)) MB held);"; say "✓ the system log restarted — it held $((k / 1024)) MB"; fi ;;
    esac; done <<< "$h"
  FREED_GB="$(awk -v a="$a0" -v b="$(availk)" 'BEGIN{d=(b-a)/1048576; if (d<0) d=0; printf "%.1f", d}')"
}

write_json() {   # what fills the disk, for Admin
  local tmp top files hl first; mkdir -p "$DATA" 2>/dev/null; tmp="$JSON.tmp"
  top="$(timeout 120 du -xk --max-depth=3 "$ROOT" 2>/dev/null | sort -rn | awk -v r="${ROOT%/}" '$2!=r && $2!=r"/"' | head -20)"
  files="$(timeout 60 find "$ROOT" -xdev -type f -size +300M -printf '%k %p\n' 2>/dev/null | sort -rn | head -10)"
  hl="$(held)"
  { printf '{"at":%s,"disk":{"pct":%s,"freeGb":%s,"totalGb":%s},' "$(date +%s)000" "$(pct)" \
      "$(df -Pk "$ROOT" | awk 'NR==2{printf "%.1f", $4/1048576}')" "$(df -Pk "$ROOT" | awk 'NR==2{printf "%.0f", $2/1048576}')"
    printf '"oldArchives":%s,"top":[' "$NOLD"; first=1
    while read -r k p; do [ -n "${k:-}" ] || continue; [ $first -eq 1 ] || printf ','; first=0; printf '{"path":"%s","gb":%s}' "$(je "$p")" "$(awk -v k="$k" 'BEGIN{printf "%.2f", k/1048576}')"; done <<< "$top"
    printf '],"files":['; first=1
    while read -r k p; do [ -n "${k:-}" ] || continue; [ $first -eq 1 ] || printf ','; first=0; printf '{"path":"%s","gb":%s}' "$(je "$p")" "$(awk -v k="$k" 'BEGIN{printf "%.2f", k/1048576}')"; done <<< "$files"
    printf '],"held":['; first=1
    while read -r k p; do [ -n "${k:-}" ] || continue; [ $first -eq 1 ] || printf ','; first=0; printf '{"program":"%s","gb":%s}' "$(je "$p")" "$(awk -v k="$k" 'BEGIN{printf "%.2f", k/1048576}')"; done <<< "$hl"
    printf ']'
    [ -n "${FREED_AT:-}" ] && printf ',"cleared":{"at":%s,"gb":%s,"what":"%s"}' "$FREED_AT" "${FREED_GB:-0}" "$(je "$FREED")"
    printf '}\n'; } > "$tmp" 2>/dev/null && mv -f "$tmp" "$JSON" && chmod 644 "$JSON" 2>/dev/null
  rm -f "$tmp" 2>/dev/null; return 0
}

case "$MODE" in
  json) write_json; exit 0 ;;
  auto)
    go=0; if [ -f "$FLAG" ]; then go=1; rm -f "$FLAG"; fi
    if [ "$go" -eq 0 ] && [ "$(pct)" -ge "${SPACE_AUTO_PCT:-90}" ] && [ -z "$(find "$STAMP" -mmin -360 2>/dev/null)" ]; then go=1; fi
    if [ "$go" -eq 1 ]; then clear_space; touch "$STAMP" 2>/dev/null; FREED_AT="$(date +%s)000"; write_json
    elif [ ! -f "$JSON" ] || [ -n "$(find "$JSON" -mmin +60 2>/dev/null)" ]; then write_json; fi
    exit 0 ;;
esac

if [ "$MODE" = "free" ]; then echo "== The disk"; df -h "$ROOT" | awk 'NR==1||NR==2'; echo; echo "== Clearing"; clear_space; echo "  freed about ${FREED_GB} GB"; echo; fi
echo "== The disk"; df -h "$ROOT" | awk 'NR==1||NR==2'
echo; echo "== nooi's folders"; sz "$APP/media" "$APP/data" "$APP/node_modules" "$APP-prev" "$APP-stage" "$APP-stage.zip" "$BK" /root/nooi-git /root/nooi-update.zip
if [ "$NOLD" -gt 0 ] && [ "$MODE" != "free" ]; then echo "  backup archives from before v186 (each with all the media inside): $NOLD besides the newest — $(du -ch $OLD 2>/dev/null | tail -1 | cut -f1)"; fi
echo; echo "== Elsewhere"; sz /tmp /var/log /var/lib/docker /var/lib/containerd /var/crash /root /home /var/lib/snapd /root/.npm /home/nooi/.npm /var/cache/apt /swapfile /swap.img
H="$(held)"; [ -n "$H" ] && { echo; echo "== Space held by deleted files that programs still have open (it comes back when they restart)"; echo "$H" | awk '{printf "  %.1f GB  %s\n", $1/1048576, $2}'; }
echo; echo "== The biggest folders on the disk (a minute at most)"
timeout 90 du -xh --max-depth=2 "$ROOT" 2>/dev/null | sort -rh | head -15
echo; echo "== Single files bigger than 300 MB"
timeout 60 find "$ROOT" -xdev -type f -size +300M -printf '%s %p\n' 2>/dev/null | sort -rn | head -10 | awk '{s=$1; $1=""; printf "  %.1f GB%s\n", s/1073741824, $0}'
[ -d /var/lib/docker ] && echo "(Docker's folder is not touched — if it is big, it belongs to something else on this server.)"
if [ "$MODE" = "free" ] && [ "$(pct)" -ge 90 ]; then echo; echo "⚠ Still $(pct)% full — the space is used by what the lists above show, not by nooi's leftovers. Send a picture of this screen."; fi
if [ "$MODE" = "report" ]; then echo; echo "Nothing was changed. To clear what nooi doesn't need: bash $APP/deploy/space.sh --free"; fi   # (a fixed path: the script may come through a pipe)
exit 0
