#!/usr/bin/env bash
# Restore a backup:  bash restore.sh /var/backups/nooi/nooi-data-2026-10-01-031000.tgz
# (v186: a data archive brings back data and .env; media missing on the site comes back from the one media copy beside it —
# nothing on the site is deleted. An archive from before v186 holds the media itself and is unpacked as before.)
set -euo pipefail
F="${1:-}"; APP=/opt/nooi; [ -f "$F" ] || { echo "Usage: bash restore.sh <backup.tgz>   (newest: $(ls -1t /var/backups/nooi/nooi-*.tgz 2>/dev/null | head -1))"; exit 1; }
systemctl stop nooi; tar -xzf "$F" -C "$APP"
M="$(dirname "$F")/media"; if [ -d "$M" ]; then rsync -a --ignore-existing "$M"/ "$APP/media"/; fi
chown -R nooi:nooi "$APP"; systemctl start nooi; echo "✅ restored $F"
