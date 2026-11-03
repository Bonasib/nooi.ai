#!/bin/bash
# v221 (v224): install ONLY the editor — nooi Studio at /studio, and the site's "Edit" opening it — on a running nooi.ai.
# Nothing else changes: no data, media, .env, packages, settings or other pages. Paste into hPanel → VPS → Browser terminal (root):
#
#   curl -fsSL https://raw.githubusercontent.com/Bonasib/nooi.ai/claude/festive-brahmagupta-08tfzr/deploy/editor-update.sh | bash
#
#   or with the package:   bash editor-update.sh /root/nooi-editor-update.zip
#   undo it:               bash /opt/nooi/deploy/editor-update.sh --rollback
#
# Safety: every file it replaces must still be the version it expects (nooi.ai v216, an earlier editor update, or this one) — if one was
# changed since, it stops without touching anything (use the full update then). It keeps a backup, checks the code, restarts, checks
# the home page, the API and /studio/, and puts everything back by itself if one of them fails.
set -u
# run from a copy: the update (or a roll-back) replaces this very file
if [ -f "$0" ] && [ -z "${EDITOR_UPDATE_COPY:-}" ]; then c="$(mktemp)"; cp "$0" "$c"; EDITOR_UPDATE_COPY=1 exec bash "$c" "$@"; fi
APP="${APP:-/opt/nooi}"; BR="${BRANCH:-claude/festive-brahmagupta-08tfzr}"; REPO="https://github.com/Bonasib/nooi.ai"
BK="/var/backups/nooi"; ok() { echo "  ✓ $*"; }; die() { echo "  ✗ $*"; exit 1; }
[ "$(id -u)" = 0 ] || die "run it as root"
[ -f "$APP/server.js" ] || die "$APP/server.js not found — nooi isn't installed here"
PORT="$(grep -E '^PORT=' "$APP/.env" 2>/dev/null | tail -1 | cut -d= -f2-)"; PORT="${PORT:-8080}"
# the files the editor needs (everything else is left as it is)
FILES="server.js public/index.html lib/studio219.js lib/static124.js lib/projects139.js lib/collab196.js lib/edit148.js deploy/doctor.sh deploy/render.sh deploy/editor-update.sh"
DIRS="public/studio studio"
# the same files as nooi.ai v216 has them (sha256) — what this update was made for
declare -A BASE=(
  [server.js]=d048ca04c7aa47a1f52550e325660ffe3b61b7f9a0c0af544bb5228ad7d36bc5
  [public/index.html]=b0c3a1f74d95c8b34ce95af9784c538b51a81ead833f6682d9e6644f3c3718f4
  [lib/static124.js]=8e86cd04b0c1955340c304d61ccc2833d8c6703c3f38fbfb94a66cdc5c18435f
  [lib/projects139.js]=4d996d8ad8071144a82f8bb0cecfe6b29a004bedb472b071aec6d0f93b9e1ce8
  [lib/collab196.js]=b88aa389f4836513002fbbdba29221cd81a69a56d9fce4edc4131feecdcb0bbe
  [lib/edit148.js]=bfe9f60af35a564c4408bb97bdecf9c8053348c8a910750c8c42133ffd435346
)
# the same files as earlier editor updates (v219–v223) left them — fine too
PREV=" eb86ab59fbfb093ceb76dbf0108c4b4220423a9e077f290fdced05dcd1537229 723727ed405743dd2c29722b75c0b926bdc8beacb0eb1205fc84a88a7e7682fe c087ffeaf92121398cb1b30ce98aafad2d13d4be4a818e39b991b0fe3a797336 a70ebb1f5f691e5edc8a0fc21136ca823bc3032cb4ae1335c07395ad45d4a9d8 010f82d9f329bbb78199ae2e71e664a1f06de66faa26e7f6e33dd1f0d1ef5388 9ad22b8cebbc4a28e5d54fead1767e649baa509b8c0b854294b6374431bbad17 0b4903812a16421a8c587dd911cc79dd5053fa15ccfa00d9b8610d1aa432b242 5570bf7cdf4b58239de0d2caa3eecfabc48de63ba4652eed0dff371b52610d44 59aee63f25820646d3511de7c9763a4b60d494bcc2e645c739086636b2e5186f 53ef7b7c1de5312695e0b7b1944442a84ef3734369d1502e1e3875011b4cde51 "
health() {   # the home page, the API and the editor answer
  local i; for i in $(seq 1 30); do curl -fsS --max-time 3 "http://127.0.0.1:$PORT/v1/health" >/dev/null 2>&1 && break; sleep 2; done
  curl -fsS --max-time 5 "http://127.0.0.1:$PORT/v1/health" | grep -q '"ok":true' || return 1
  curl -fsS --max-time 10 -o /dev/null "http://127.0.0.1:$PORT/" || return 1
  [ "${1:-}" = "base" ] && return 0
  curl -fsS --max-time 10 "http://127.0.0.1:$PORT/studio/" | grep -q "nooi Studio Editor" || return 1
}
restore() {   # put back a backup made by this script
  local b="$1"; [ -f "$b" ] || die "backup $b not found"
  rm -rf "$APP/public/studio" "$APP/studio"; tar -xzf "$b" -C "$APP"
  for nf in "$APP/.editor-new-files" "$APP/.editor-new-files.done"; do [ -f "$nf" ] && while read -r f; do [ -n "$f" ] && rm -f "$APP/$f"; done < "$nf"; rm -f "$nf"; done
  chown -R nooi:nooi "$APP" 2>/dev/null; systemctl restart nooi; sleep 4
}

if [ "${1:-}" = "--rollback" ]; then
  B="$(ls -1t "$BK"/editor-*.tgz 2>/dev/null | head -1)"; [ -n "$B" ] || die "no editor backup in $BK"
  echo "▶ putting back $B"; restore "$B"; health base && ok "the site is back as it was before the editor update" || die "the site isn't answering — run: bash $APP/deploy/doctor.sh"; exit 0
fi

echo "▶ 1/5 the editor package"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
if [ -n "${1:-}" ]; then [ -f "$1" ] || die "$1 not found"; unzip -q "$1" -d "$TMP/u" || die "couldn't open $1"; NEW="$(dirname "$(find "$TMP/u" -path '*/lib/studio219.js' | head -1)")/.."
else git clone -q --depth 1 -b "$BR" "$REPO" "$TMP/u" || die "couldn't download from GitHub"; NEW="$TMP/u"; fi
NEW="$(cd "$NEW" && pwd)"; [ -f "$NEW/lib/studio219.js" ] && [ -f "$NEW/public/studio/index.html" ] || die "this isn't the editor package"
ok "package ready ($(cd "$NEW" && git log -1 --format='%h %cs' 2>/dev/null || echo zip))"

echo "▶ 2/5 is the server the version this update is for?"
for f in "${!BASE[@]}"; do
  [ -f "$APP/$f" ] || die "$f is missing on the server — use the full update instead"
  have="$(sha256sum "$APP/$f" | cut -c1-64)"; new="$(sha256sum "$NEW/$f" | cut -c1-64)"
  [ "$have" = "${BASE[$f]}" ] || [ "$have" = "$new" ] || [[ "$PREV" == *" $have "* ]] || die "$f on the server isn't nooi.ai v216 or an editor update (it was changed) — nothing was touched. Use the full update instead."
done
ok "yes — only the editor's files will change"

echo "▶ 3/5 backup"
mkdir -p "$BK"; STAMP="$(date +%Y%m%d-%H%M%S)"; B="$BK/editor-$STAMP.tgz"; LIST=""
for f in $FILES; do [ -e "$APP/$f" ] && LIST="$LIST $f"; done; for d in $DIRS; do [ -e "$APP/$d" ] && LIST="$LIST $d"; done
(cd "$APP" && tar -czf "$B" $LIST) || die "couldn't write the backup"
rm -f "$APP/.editor-new-files.done"   # a roll-back undoes the last run only (this backup holds what earlier runs added)
: > "$TMP/newfiles"; for f in $FILES; do [ -e "$APP/$f" ] || echo "$f" >> "$TMP/newfiles"; done
ok "$B"

echo "▶ 4/5 install the editor"
for f in $FILES; do mkdir -p "$APP/$(dirname "$f")"; cp -f "$NEW/$f" "$APP/$f" || { restore "$B"; die "couldn't copy $f — put back as it was"; }; done
# the folders: a fresh copy next to the old one, then swapped in (plain cp — no rsync needed); stop at the first failure
for d in $DIRS; do rm -rf "$APP/$d.new"; mkdir -p "$(dirname "$APP/$d")"
  if ! cp -a "$NEW/$d" "$APP/$d.new"; then rm -rf "$APP/$d.new"; restore "$B"; die "couldn't copy $d — put back as it was"; fi
  rm -rf "$APP/$d.new/node_modules" "$APP/$d.new"/*/*/node_modules "$APP/$d.new/apps/desktop/src-tauri/binaries" 2>/dev/null
  rm -rf "$APP/$d"; mv "$APP/$d.new" "$APP/$d"; done
# what is on the disk now must be what the package holds (else everything goes back)
for f in $FILES public/studio/index.html; do cmp -s "$NEW/$f" "$APP/$f" || { echo "  ✗ $f didn't arrive"; restore "$B"; die "put back as it was — nothing changed"; }; done
cp "$TMP/newfiles" "$APP/.editor-new-files"; chmod +x "$APP/deploy/render.sh" "$APP/deploy/editor-update.sh" 2>/dev/null; chown -R nooi:nooi "$APP" 2>/dev/null
if ! node --check "$APP/server.js" 2>"$TMP/err" || ! node --check "$APP/lib/studio219.js" 2>>"$TMP/err"; then
  echo "  ✗ the new code doesn't load: $(tail -3 "$TMP/err")"; restore "$B"; die "put back as it was — nothing changed"; fi
ok "files in place (${FILES// /, }, public/studio/, studio/)"

echo "▶ 5/5 restart and check"
systemctl restart nooi; sleep 4
if health; then mv -f "$APP/.editor-new-files" "$APP/.editor-new-files.done" 2>/dev/null
  ok "the site and the API answer, and the new editor is at /studio/"
  echo; echo "  Done. Open https://<your site>/studio/ — the site's Edit buttons open it too (?classic=1 keeps the old editor for a while)."
  echo "  Undo: bash $APP/deploy/editor-update.sh --rollback      Server exports (optional): bash $APP/deploy/render.sh"
else
  echo "  ✗ a check failed — putting everything back"; restore "$B"
  health base && die "put back: the site is as it was before (nothing lost). Send me: bash $APP/deploy/doctor.sh" || die "the site isn't answering — run: bash $APP/deploy/doctor.sh"
fi
