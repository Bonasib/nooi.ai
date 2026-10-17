#!/usr/bin/env bash
# nooi.ai server check-up — what is slowing the site down. Read-only: it changes nothing, restarts nothing, and prints no keys
# or passwords (a setting shows only whether it is set).
#
#   bash /opt/nooi/deploy/doctor.sh          → copy everything it prints and send it
APP="${APP:-/opt/nooi}"
PORT="$(grep -E '^PORT=' "$APP/.env" 2>/dev/null | tail -1 | cut -d= -f2-)"; PORT="${PORT:-8080}"
sec() { echo; echo "== $1"; }
mask() { sed -E 's/(nvapi-|sk-|AIza|Bearer |key=|token=|secret=|password=)[A-Za-z0-9._~+\/=-]{4,}/\1***/Ig'; }

echo "nooi.ai check-up · $(date -u '+%Y-%m-%d %H:%M UTC') · $(hostname)"

sec "Processor and memory"
uptime; echo "CPUs: $(nproc 2>/dev/null)"; free -m 2>/dev/null
sec "Disk"
df -h / "$APP" 2>/dev/null | awk '!seen[$0]++'
du -sh "$APP/media" "$APP/data" 2>/dev/null; ls -l "$APP/data/db.json" 2>/dev/null | awk '{print "db.json:", $5, "bytes"}'
sec "Busiest programs now"
ps -eo pid,pcpu,pmem,rss,etime,comm --sort=-pcpu 2>/dev/null | head -12
n="$(pgrep -c ffmpeg 2>/dev/null)"; echo "ffmpeg running: ${n:-0}"

sec "The site's services"
for s in nooi nooi-stage ollama; do
  st="$(systemctl show "$s" -p LoadState --value 2>/dev/null)"; [ "$st" = "loaded" ] || { echo "$s: not installed"; continue; }
  echo "$s: $(systemctl show "$s" -p ActiveState --value) · restarts $(systemctl show "$s" -p NRestarts --value) · since $(systemctl show "$s" -p ActiveEnterTimestamp --value) · memory $(( $(systemctl show "$s" -p MemoryCurrent --value 2>/dev/null | grep -E '^[0-9]+$' || echo 0) / 1048576 )) MB"
done
echo "starts of the site in the last 24 h: $(journalctl -u nooi --since '24 hours ago' --no-pager 2>/dev/null | grep -c 'Started ')"
echo "health-check restarts: $(grep -h nooi /etc/cron.d/* 2>/dev/null | grep -c 'systemctl restart') rule(s)"

sec "How fast the site answers on this server"
for p in /v1/health /v1/config; do r="$(curl -s -o /dev/null -m 20 -w '%{http_code} in %{time_total}s' "http://127.0.0.1:$PORT$p")"; case "$r" in 000*) echo "$p → no answer";; *) echo "$p → $r";; esac; done
[ -n "$(systemctl show nooi-stage -p ActiveState --value 2>/dev/null | grep -x active)" ] && echo "⚠ A preview copy is running beside the live site — remove it: bash $APP/deploy/stage.sh stop"

sec "How fast the AI services answer from this server"
for u in https://api.kie.ai https://generativelanguage.googleapis.com https://www.google.com; do
  r="$(curl -s -o /dev/null -m 15 -w '%{http_code} · connect %{time_connect}s · total %{time_total}s' "$u")"; case "$r" in 000*) echo "$u → no answer";; *) echo "$u → $r";; esac; done

sec "Settings that change the speed (set or not — no values)"
for k in MIRROR_MEDIA LOCAL_LLM_URL GPU_FEATURES PUBLIC_BASE_URL AGENTS_AUTO_LEARN NOOI_STAGE; do
  grep -qE "^$k=." "$APP/.env" 2>/dev/null && echo "$k: set" || echo "$k: not set"; done

sec "Jobs (read from the data file)"
cd "$APP" 2>/dev/null && node -e '
const fs = require("fs"); let db; try { db = JSON.parse(fs.readFileSync("data/db.json", "utf8")); } catch (e) { console.log("cannot read data/db.json:", e.message); process.exit(0); }
const now = Date.now(), jobs = []; for (const u of Object.values(db.users || {})) for (const j of Object.values(u.jobs || {})) jobs.push(j);
const med = (a) => { a = a.filter((x) => x >= 0).sort((x, y) => x - y); return a.length ? Math.round(a[Math.floor(a.length / 2)] / 1000) + " s" : "—"; };
const kind = (j) => (/^mcswap$/.test(j.payload?.model || "") ? "swap" : /^mc(26|30)$/.test(j.payload?.model || "") ? "motion" : j.kind);
console.log("users:", Object.keys(db.users || {}).length, "· jobs:", jobs.length, "· largest job:", Math.max(0, ...jobs.map((j) => JSON.stringify(j).length)), "bytes");
const pend = jobs.filter((j) => ["queued", "rendering"].includes(j.status));
console.log("being made now:", pend.length, pend.length ? "· oldest " + Math.round((now - Math.min(...pend.map((j) => j.created || now))) / 60e3) + " min" : "", JSON.stringify(pend.reduce((a, j) => { const k = kind(j) + ":" + (j.stage || (j.remoteId ? "engine" : j.status)); a[k] = (a[k] || 0) + 1; return a; }, {})));
const day = jobs.filter((j) => j.created && now - j.created < 864e5 && !j.parent), by = {};
for (const j of day) { const k = (by[kind(j)] = by[kind(j)] || { done: 0, failed: 0, other: 0, total: [], before: [], engine: [], words: [], fetch: [] }), t = j.times || {};
  if (j.status === "done") { k.done++; if (j.doneAt) k.total.push(j.doneAt - j.created + (t.words || 0) * 1e3); if (j.sentAt) { k.before.push(j.sentAt - j.created + (t.words || 0) * 1e3); k.engine.push(j.doneAt - j.sentAt - ((t.fetch || 0) + (t.after || 0)) * 1e3); }
    if (t.words != null) k.words.push(t.words * 1e3); if (t.fetch != null) k.fetch.push(t.fetch * 1e3); } else if (j.status === "failed") k.failed++; else k.other++; }
console.log("last 24 h (usual time · our part before the engine · the engine · the words step · bringing the result here):");
for (const [k, v] of Object.entries(by)) console.log(" ", k, "· done", v.done, "· failed", v.failed, "· waiting", v.other, "·", med(v.total), "·", med(v.before), "·", med(v.engine), "·", med(v.words), "·", med(v.fetch));
// the last Replace the person / Make it move jobs, step by step (seconds): our steps, then the engine line and its making
const sec = (v) => (v == null ? "—" : Math.round(+v) + " s");
const mc = jobs.filter((j) => !j.parent && /^mc(26|30|swap)$/.test(j.payload?.model || "") && j.status === "done").sort((a, b) => b.created - a.created).slice(0, 5);
if (mc.length) console.log("last Replace the person / Make it move (video length · parts · prepare · text AI look · engine line · engine making · bringing here · total):");
for (const j of mc) { const t = j.times || {}, v = j.payload?.meta?.mcVideo || {};
  console.log(" ", kind(j), Math.round((now - j.created) / 36e5) + " h ago ·", sec(v.dur), "·", v.parts || 1, "·", sec(t.prep), "·", sec(t.look), "·", sec(t.queue), "·", sec(t.making), "·", sec(t.fetch), "·", sec(j.doneAt && (j.doneAt - j.created) / 1000)); }
const fails = day.filter((j) => j.status === "failed").slice(-8).map((j) => kind(j) + ": " + String(j.error || "").slice(0, 120));
if (fails.length) console.log("last failures:\n  " + fails.join("\n  "));
' 2>&1 | mask

sec "Warnings in the last 6 hours (last 40)"
journalctl -u nooi --since '6 hours ago' --no-pager -o cat 2>/dev/null | grep -iE 'warn|error|fail|timed out|poll|mirror|save|restart|ENOSPC|heap' | tail -40 | cut -c1-240 | mask
echo; echo "Done — nothing was changed."
