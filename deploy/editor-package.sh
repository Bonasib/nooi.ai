#!/bin/bash
# v221: build the editor-only package for deploy/editor-update.sh — only the files the editor needs.
# Usage: bash deploy/editor-package.sh [out.zip] [--worktree]   (default: from the last commit; --worktree: from the files as they are)
set -eu
cd "$(dirname "$0")/.."; OUT="${1:-nooi-editor-update.zip}"; case "$OUT" in /*) ;; *) OUT="$PWD/$OUT";; esac
PATHS="server.js public/index.html lib/studio219.js lib/static124.js lib/projects139.js lib/collab196.js lib/edit148.js deploy/doctor.sh deploy/render.sh deploy/editor-update.sh public/studio studio"
rm -f "$OUT"
if [ "${2:-}" = "--worktree" ]; then T="$(mktemp -d)"; mkdir -p "$T/nooi-editor-update"
  for p in $PATHS; do mkdir -p "$T/nooi-editor-update/$(dirname "$p")"; rsync -a --exclude node_modules --exclude dist --exclude .data --exclude src/generated --exclude 'src-tauri/binaries' --exclude 'src-tauri/target' --exclude 'mobile/android' --exclude 'mobile/ios' "$p" "$T/nooi-editor-update/$(dirname "$p")/"; done
  (cd "$T" && zip -qr "$OUT" nooi-editor-update); rm -rf "$T"
else git archive --format=zip --prefix=nooi-editor-update/ -o "$OUT" HEAD $PATHS; fi
echo "$OUT ($(du -h "$OUT" | cut -f1))"
