#!/usr/bin/env bash
# Restore a backup:  bash restore.sh /var/backups/nooi/nooi-2026-10-01-0310.tgz
set -euo pipefail
F="${1:-}"; APP=/opt/nooi; [ -f "$F" ] || { echo "Usage: bash restore.sh <backup.tgz>"; exit 1; }
systemctl stop nooi; tar -xzf "$F" -C "$APP"; chown -R nooi:nooi "$APP"; systemctl start nooi; echo "✅ restored $F"
