#!/bin/bash
# Turn on every nooi.ai feature on this server, step by step, without touching your data:
#   1. ffmpeg / ffprobe (video intelligence, exports, frames)      2. the public https address (engines read uploads from it)
#   3. your NVIDIA key (asked hidden — never typed on the command line, never shown)     4. a live test of the key from this server
#   5. restart + a report of what is on and what still needs a key.
# Usage (as root):  bash /opt/nooi/deploy/activate.sh
set -u
APP="${APP:-/opt/nooi}"; ENV="$APP/.env"
[ -f "$ENV" ] || { echo "✗ $ENV not found — install nooi first (deploy/install.sh)"; exit 1; }
cp "$ENV" "$ENV.bak.$(date +%s)"; chmod 600 "$ENV"
get_env() { grep -E "^$1=" "$ENV" | tail -1 | cut -d= -f2-; }
set_env() { local k="$1" v="$2" tmp; tmp="$(mktemp)"; grep -vE "^$k=" "$ENV" > "$tmp"; printf '%s=%s\n' "$k" "$v" >> "$tmp"; cat "$tmp" > "$ENV"; rm -f "$tmp"; }
ok() { echo "  ✓ $*"; }; warn() { echo "  ⚠ $*"; }

echo "▶ 1/5 ffmpeg"
if command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null; then ok "ffmpeg is installed"; else
  apt-get update -qq && apt-get install -y -qq ffmpeg >/dev/null && ok "ffmpeg installed" || warn "couldn't install ffmpeg — run: apt-get install -y ffmpeg"; fi

echo "▶ 2/5 public address"
PB="$(get_env PUBLIC_BASE_URL)"
if [[ "$PB" == https://* ]]; then ok "PUBLIC_BASE_URL=$PB"; else
  read -rp "  Your site address, starting with https:// (e.g. https://nooi.ai): " PB; PB="${PB%/}"
  if [[ "$PB" == https://* ]]; then set_env PUBLIC_BASE_URL "$PB"; ok "saved"; else warn "not an https address — uploads to the AI engines need https"; fi; fi

echo "▶ 3/5 NVIDIA key"
read -rsp "  Paste your NEW NVIDIA key (nvapi-…) and press Enter — or just Enter to keep the current one: " K; echo
K="$(printf '%s' "$K" | tr -d '[:space:]')"
if [ -n "$K" ]; then [[ "$K" == nvapi-* ]] || warn "NVIDIA keys usually start with nvapi-"; set_env NVIDIA_API_KEY "$K"; ok "saved in $ENV (only root can read it)"; fi
K="$(get_env NVIDIA_API_KEY)"

echo "▶ 4/5 testing the NVIDIA key from this server"
if [ -z "$K" ]; then warn "no NVIDIA key — NVIDIA features stay off"; else
  test_model() { curl -s -o /tmp/nooi-nv.json -w '%{http_code}' -m 90 https://integrate.api.nvidia.com/v1/chat/completions \
      -H "Authorization: Bearer $K" -H 'Content-Type: application/json' -H 'Accept: application/json' \
      -d "{\"model\":\"$1\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with OK\"}],\"max_tokens\":${2:-64},\"stream\":false}"; }
  for M in nvidia/nemotron-3-super-120b-a12b nvidia/nemotron-3-nano-omni-30b-a3b-reasoning; do
    C="$(test_model "$M" 1200)"
    case "$C" in
      200) ok "$M answers" ;;
      401|403) warn "$M: the key was rejected ($C) — make a new key at build.nvidia.com" ;;
      404) warn "$M: not available to this key ($C) — pick another model in Admin → AI providers → NVIDIA AI" ;;
      429) warn "$M: rate limit / out of free credits ($C)" ;;
      000) warn "$M: no connection from this server to integrate.api.nvidia.com" ;;
      *) warn "$M: HTTP $C — $(head -c 200 /tmp/nooi-nv.json)" ;;
    esac; done
  rm -f /tmp/nooi-nv.json; fi

echo "▶ 5/5 restart"
PORT="$(get_env PORT)"; PORT="${PORT:-8080}"
if command -v systemctl >/dev/null; then systemctl restart nooi && sleep 5; else warn "systemctl not found — restart nooi yourself"; fi
CFG="$(curl -s -m 10 "http://127.0.0.1:$PORT/v1/config")"
if [ -z "$CFG" ]; then warn "nooi didn't answer on port $PORT — check: journalctl -u nooi -n 50"; exit 1; fi
node -e '
const c = JSON.parse(process.argv[1]), p = c.providers || {}, on = (x) => (x ? "✓ on " : "✗ off");
console.log("\n  nooi is running. What is on:");
const nv = p.nvUse || {};
console.log("  " + on(p.nvidia) + "  NVIDIA AI" + (p.nvidia ? " — text " + on(nv.text !== false) + " · vision " + on(nv.vision !== false) + " · pictures " + on(nv.image !== false) + " · edits " + on(nv.edit !== false) + " · 3D " + on(nv["3d"] !== false) + " · video " + on(!!nv.video) : ""));
console.log("  " + on(c.llm) + "  Text AI (stories, storyboards, bots, captions, video intelligence)" + (c.llm ? " → " + c.llm.provider + " · " + c.llm.model : ""));
for (const [k, n] of [["image", "Pictures"], ["video", "Video"], ["music", "Music"], ["tts", "Voice"], ["lipsync", "Lip-sync"], ["matting", "Background removal"], ["enhance", "Upscale"]]) console.log("  " + on(p[k]) + "  " + n);
console.log("  " + on(p.auth) + "  Sign-in (Firebase)");
console.log("  " + on(p.billing) + "  Payments");
const off = [["image", "pictures"], ["video", "video"], ["music", "music"], ["tts", "voice"]].filter(([k]) => !p[k]).map(([, n]) => n);
if (off.length) console.log("\n  Still off: " + off.join(", ") + " — add the AI engine key in Admin → AI providers (or turn NVIDIA video on there).");
console.log("\n  Video on NVIDIA Cosmos is off by default. To use it for nooi Auto: Admin → AI providers → NVIDIA AI → \"Use NVIDIA for\" = text:on vision:on image:on edit:on 3d:on video:on");
' "$CFG"
echo; echo "  Note: a key saved in Admin → AI providers wins over the .env key. If you saved an old NVIDIA key there, paste the new one there too."
