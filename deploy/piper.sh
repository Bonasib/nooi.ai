#!/usr/bin/env bash
# Backup voice on this server (optional, free, no engine credits): Piper voice servers that nooi uses when the engine's voice
# fails (voiceovers and avatars). Runs on the CPU; each voice uses about 100–300 MB of memory.
#
#   bash /opt/nooi/deploy/piper.sh            # English voice (LJSpeech — public-domain recordings)
#   bash /opt/nooi/deploy/piper.sh --arabic   # also the Arabic voice ar_JO-kareem — read its licence first (see below)
#   bash /opt/nooi/deploy/piper.sh --remove   # stop and remove the backup voices
#
# The Piper program 1.2 (rhasspy/piper) is MIT-licensed; deploy/piper-server.mjs answers nooi on 127.0.0.1. Each voice has its own training data and licence: the English LJSpeech voice is
# built on public-domain recordings. The Arabic "kareem" voice's model card points to its dataset for the licence
# (https://github.com/AliMokhammad/arabicttstrain) — only add it after you have checked that commercial use is allowed.
set -euo pipefail
APP=${APP:-/opt/nooi}; DIR=${PIPER_DIR:-/opt/nooi-piper}; ENVF="$APP/.env"
HF=https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0
say(){ printf '\n▶ %s\n' "$*"; }
set_env(){ touch "$ENVF"; if grep -q "^$1=" "$ENVF"; then sed -i "s|^$1=.*|$1=$2|" "$ENVF"; else echo "$1=$2" >> "$ENVF"; fi; }
[ "$(id -u)" = 0 ] || { echo "Run as root (sudo bash $0)"; exit 1; }

if [ "${1:-}" = "--remove" ]; then
  for v in en ar; do systemctl disable --now "nooi-piper-$v" 2>/dev/null || true; rm -f "/etc/systemd/system/nooi-piper-$v.service"; done
  systemctl daemon-reload; sed -i '/^PIPER_URLS=/d' "$ENVF" 2>/dev/null || true; systemctl restart nooi 2>/dev/null || true
  echo "✓ Backup voices removed (the files stay in $DIR)"; exit 0
fi

say "1/4 The Piper program (1.2, MIT)"
apt-get update -qq && apt-get install -y -qq curl tar >/dev/null
mkdir -p "$DIR/voices"
if [ ! -x "$DIR/piper/piper" ]; then
  curl -fsSL https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz -o "$DIR/piper.tgz"
  tar -xzf "$DIR/piper.tgz" -C "$DIR" && rm -f "$DIR/piper.tgz"
fi
[ -x "$DIR/piper/piper" ] && echo "  ✓ $DIR/piper/piper"
NODE=$(command -v node || echo /usr/bin/node)

say "2/4 Voices"
get(){ local path=$1 name; name=$(basename "$path"); [ -s "$DIR/voices/$name.onnx" ] || curl -fsSL "$HF/$path.onnx?download=true" -o "$DIR/voices/$name.onnx"; [ -s "$DIR/voices/$name.onnx.json" ] || curl -fsSL "$HF/$path.onnx.json?download=true" -o "$DIR/voices/$name.onnx.json"; echo "  ✓ $name"; }
get en/en_US/ljspeech/high/en_US-ljspeech-high
URLS="en=http://127.0.0.1:5310"
if [ "${1:-}" = "--arabic" ]; then
  echo "  ⚠ The Arabic voice's licence comes from its dataset: https://github.com/AliMokhammad/arabicttstrain — check it allows commercial use."
  get ar/ar_JO/kareem/medium/ar_JO-kareem-medium; URLS="$URLS,ar=http://127.0.0.1:5311"
fi

say "3/4 Voice servers (this server only: 127.0.0.1)"
unit(){ local lang=$1 port=$2 voice=$3
  cat > "/etc/systemd/system/nooi-piper-$lang.service" <<UNIT
[Unit]
Description=nooi backup voice ($lang)
After=network.target
[Service]
ExecStart=$NODE $APP/deploy/piper-server.mjs $DIR/piper/piper $DIR/voices/$voice.onnx $port
Restart=always
User=nobody
[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload; systemctl enable --now "nooi-piper-$lang" >/dev/null; echo "  ✓ nooi-piper-$lang on 127.0.0.1:$port"; }
unit en 5310 en_US-ljspeech-high
[ "${1:-}" = "--arabic" ] && unit ar 5311 ar_JO-kareem-medium

say "4/4 Tell nooi"
set_env PIPER_URLS "$URLS"; systemctl restart nooi 2>/dev/null || true
sleep 3; if curl -fsS --max-time 30 "http://127.0.0.1:5310/?text=Hello" -o /tmp/piper-test.wav && [ -s /tmp/piper-test.wav ]; then echo "  ✓ The backup voice answers"; else echo "  ⚠ The voice server isn't answering yet — check: journalctl -u nooi-piper-en -n 50"; fi
echo "Done. PIPER_URLS=$URLS (in $ENVF). Remove with: bash $0 --remove"
