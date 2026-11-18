#!/bin/bash
# v220: the nooi Studio render service on this VPS (Docker Compose, beside the site): server exports, resumable uploads, live status.
#   1. Docker (installed if missing)   2. its folder and settings (/opt/nooi-render/.env with a random database password — never shown)
#   3. PostgreSQL + Redis + the API + a render worker (+ ClamAV with --scan)   4. the site passes /render-api/* to it (RENDER_API_URL)
#   5. a check through the site
# Usage (as root):  bash /opt/nooi/deploy/render.sh           → set up / update and start
#                   bash /opt/nooi/deploy/render.sh --scan    → also scan every upload with ClamAV (needs ~1.5 GB of memory)
#                   bash /opt/nooi/deploy/render.sh --off     → stop it (the studio then exports on the device only)
set -u
APP="${APP:-/opt/nooi}"; ENV="$APP/.env"; DIR="${RENDER_DIR:-/opt/nooi-render}"; RENV="$DIR/.env"
COMPOSE="$APP/studio/infra/docker-compose.yml"; PROJ=nooi-render
ok() { echo "  ✓ $*"; }; warn() { echo "  ⚠ $*"; }; die() { echo "  ✗ $*"; exit 1; }
[ -f "$ENV" ] || die "$ENV not found — install nooi first (deploy/install.sh)"
[ -f "$COMPOSE" ] || die "$COMPOSE not found — update nooi to the newest package first"
get_env() { grep -E "^$1=" "$2" 2>/dev/null | tail -1 | cut -d= -f2-; }
set_env() { local k="$1" v="$2" f="$3" tmp; tmp="$(mktemp)"; grep -vE "^$k=" "$f" > "$tmp" 2>/dev/null; printf '%s=%s\n' "$k" "$v" >> "$tmp"; cat "$tmp" > "$f"; rm -f "$tmp"; }
del_env() { local tmp; tmp="$(mktemp)"; grep -vE "^$1=" "$2" > "$tmp" 2>/dev/null; cat "$tmp" > "$2"; rm -f "$tmp"; }
PORT="$(get_env PORT "$ENV")"; PORT="${PORT:-8080}"
dc() { RENDER_ENV_FILE="$RENV" docker compose -f "$COMPOSE" --env-file "$RENV" -p "$PROJ" "$@"; }

if [ "${1:-}" = "--off" ]; then
  echo "▶ stopping the render service"
  command -v docker >/dev/null && [ -f "$RENV" ] && dc --profile scan down && ok "stopped (its data stays in $DIR and the Docker volumes)"
  cp "$ENV" "$ENV.bak.$(date +%s)"; del_env RENDER_API_URL "$ENV"; systemctl restart nooi 2>/dev/null; ok "the site no longer passes /render-api — exports on the device only"; exit 0
fi

echo "▶ 1/5 Docker"
if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then ok "$(docker --version | cut -d, -f1) with Compose"; else
  curl -fsSL https://get.docker.com | sh >/dev/null 2>&1 && systemctl enable --now docker >/dev/null 2>&1 && ok "Docker installed" || die "couldn't install Docker — see https://docs.docker.com/engine/install/"; fi

echo "▶ 2/5 folder and settings"
mkdir -p "$DIR/data/uploads" "$DIR/data/renders"; chown -R 1000:1000 "$DIR/data"   # the containers run as user node (1000)
if [ ! -f "$RENV" ]; then cp "$APP/studio/infra/.env.example" "$RENV"; set_env PG_PASSWORD "$(openssl rand -hex 24)" "$RENV"; ok "settings written to $RENV (database password made at random)"; else ok "settings kept: $RENV"; fi
set_env NOOI_APP_URL "http://host.docker.internal:$PORT" "$RENV"
CPUS="$(nproc 2>/dev/null || echo 2)"; [ -n "$(get_env RENDER_CONCURRENCY "$RENV")" ] || set_env RENDER_CONCURRENCY "$(( CPUS >= 8 ? 2 : 1 ))" "$RENV"
if [ "${1:-}" = "--scan" ]; then set_env CLAMAV_HOST clamav "$RENV"; PROF="--profile scan"; ok "uploads will be virus-scanned (ClamAV)"; else
  [ "$(get_env CLAMAV_HOST "$RENV")" = "clamav" ] && PROF="--profile scan" || PROF=""; fi
chmod 600 "$RENV"
# the media folder must be readable by the containers' user (the site writes it as user nooi)
chmod o+rx "$APP/media" 2>/dev/null || true

echo "▶ 3/5 start (the first build takes a few minutes)"
# shellcheck disable=SC2086
dc $PROF up -d --build --remove-orphans || die "docker compose failed — run: docker compose -p $PROJ logs --tail 80"
for _ in $(seq 1 60); do curl -fsS --max-time 2 http://127.0.0.1:8790/health >/dev/null 2>&1 && break; sleep 2; done
curl -fsS --max-time 3 http://127.0.0.1:8790/health >/dev/null 2>&1 && ok "render API answering on 127.0.0.1:8790" || die "the render API isn't answering — run: docker compose -p $PROJ logs --tail 80 render-api"

echo "▶ 4/5 the site passes /render-api to it"
cp "$ENV" "$ENV.bak.$(date +%s)"; set_env RENDER_API_URL "http://127.0.0.1:8790" "$ENV"; chmod 600 "$ENV"
systemctl restart nooi && sleep 4 && ok "nooi restarted"

echo "▶ 5/5 check"
if curl -fsS --max-time 5 "http://127.0.0.1:$PORT/render-api/health" | grep -q '"ok":true'; then ok "server exports are on: Studio → Export → nooi server"; else warn "the site doesn't reach it yet — run: bash $APP/deploy/doctor.sh"; fi
echo "  renders are kept $(get_env RENDER_KEEP_DAYS "$RENV") days · $(get_env RENDER_CONCURRENCY "$RENV") at a time · logs: docker compose -p $PROJ logs -f"
