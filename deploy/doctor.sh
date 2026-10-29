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
# v186: the backups (each update used to pack all the media again) and how full the disk is
du -sh /var/backups/nooi 2>/dev/null | awk '{print "backups:", $1, "in", $2}'
nold="$(ls -1 /var/backups/nooi/nooi-2[0-9][0-9][0-9]-*.tgz 2>/dev/null | wc -l)"; [ "$nold" -gt 1 ] && echo "⚠ $nold backup archives from before v186, each with all the media inside — the next backup keeps only the newest (or now: bash $APP/deploy/space.sh --free)"
pct="$(df -P / | awk 'NR==2{gsub("%","",$5);print $5}')"
if [ "${pct:-0}" -ge 85 ]; then echo "⚠ The disk is ${pct}% full — see what fills it: bash $APP/deploy/space.sh   · clear what nooi doesn't need: bash $APP/deploy/space.sh --free"; fi
sec "Busiest programs now"
ps -eo pid,pcpu,pmem,rss,etime,comm --sort=-pcpu 2>/dev/null | head -12
n="$(pgrep -c ffmpeg 2>/dev/null)"; echo "ffmpeg running: ${n:-0}"

sec "This server's processor (a 3-second video test — nothing is saved)"
s="$(date +%s.%N)"; if timeout 120 nice -n 10 ffmpeg -v error -f lavfi -i testsrc2=s=720x1280:r=30 -t 3 -c:v libx264 -preset veryfast -f null - 2>/dev/null; then
  echo "making 3 s of 720×1280 video took $(awk "BEGIN{printf \"%.1f\", $(date +%s.%N)-$s}") s on $(nproc) cores (under 3 s = faster than the video plays; more cores = faster)"; else echo "ffmpeg test: could not run"; fi

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

sec "Who can use the site (v182: Coming soon = the team only)"
m="$(curl -s -m 10 "http://127.0.0.1:$PORT/v1/config" | grep -o '"launch182":"[a-z]*"' | cut -d'"' -f4)"
echo "mode: ${m:-no answer} (soon = only the owners and the team in Admin → Admins & permissions; open = everyone)"
grep -qE "^NOOI_LAUNCH=." "$APP/.env" 2>/dev/null && echo "NOOI_LAUNCH: set in .env (it decides; Admin's switch can't change it)" || echo "NOOI_LAUNCH: not set (Admin's switch decides)"
grep -qE "^ADMIN_EMAILS=." "$APP/.env" 2>/dev/null && echo "owners (ADMIN_EMAILS): set" || echo "⚠ ADMIN_EMAILS is not set — no one is the owner, so you'd see the Coming soon page yourself. Add your email to $APP/.env (ADMIN_EMAILS=you@example.com) and run: systemctl restart nooi"
(cd "$APP" 2>/dev/null && node -e 'try{const d=JSON.parse(require("fs").readFileSync("data/db.json","utf8")),st=(d.settings||{});console.log("team members:",(st.team||[]).length,"· registrations kept:",((st.launch182||{}).regs||[]).length)}catch(e){}')

sec "Jobs (read from the data file)"
cd "$APP" 2>/dev/null && node -e '
const fs = require("fs"); let db; try { db = JSON.parse(fs.readFileSync("data/db.json", "utf8")); } catch (e) { console.log("cannot read data/db.json:", e.message); process.exit(0); }
const now = Date.now(), jobs = []; for (const u of Object.values(db.users || {})) for (const j of Object.values(u.jobs || {})) jobs.push(j);
const med = (a) => { a = a.filter((x) => x >= 0).sort((x, y) => x - y); return a.length ? Math.round(a[Math.floor(a.length / 2)] / 1000) + " s" : "—"; };
const kind = (j) => (/^mcswap$/.test(j.payload?.model || "") ? "swap" : /^mc(26|30)$/.test(j.payload?.model || "") ? "motion" : j.kind);
console.log("users:", Object.keys(db.users || {}).length, "· jobs:", jobs.length, "· largest job:", Math.max(0, ...jobs.map((j) => JSON.stringify(j).length)), "bytes");
const pend = jobs.filter((j) => ["queued", "rendering"].includes(j.status));
console.log("being made now:", pend.length, pend.length ? "· oldest " + Math.round((now - Math.min(...pend.map((j) => j.created || now))) / 60e3) + " min" : "", JSON.stringify(pend.reduce((a, j) => { const st = j.stage || (j.remoteId ? "engine" : j.status), k = kind(j) + ":" + (st === "engine" && j.remoteId && j.sentAt ? (j.genAt ? "engine making" : "engine line") : st); a[k] = (a[k] || 0) + 1; return a; }, {})));
const day = jobs.filter((j) => j.created && now - j.created < 864e5 && !j.parent), by = {};
for (const j of day) { const k = (by[kind(j)] = by[kind(j)] || { done: 0, failed: 0, other: 0, total: [], before: [], engine: [], words: [], fetch: [] }), t = j.times || {};
  if (j.status === "done") { k.done++; if (j.doneAt) k.total.push(j.doneAt - j.created + (t.words || 0) * 1e3); if (j.sentAt) { k.before.push(j.sentAt - j.created + (t.words || 0) * 1e3); k.engine.push(j.doneAt - j.sentAt - ((t.fetch || 0) + (t.after || 0)) * 1e3); }
    if (t.words != null) k.words.push(t.words * 1e3); if (t.fetch != null) k.fetch.push(t.fetch * 1e3); } else if (j.status === "failed") k.failed++; else k.other++; }
console.log("last 24 h (usual time · our part before the engine · the engine · the words step · bringing the result here):");
for (const [k, v] of Object.entries(by)) console.log(" ", k, "· done", v.done, "· failed", v.failed, "· waiting", v.other, "·", med(v.total), "·", med(v.before), "·", med(v.engine), "·", med(v.words), "·", med(v.fetch));
// v119: would a bigger server help? The AI engine (its line, making, the lip sync) does not change with this server; preparing
// videos, the sound, 60/120 fps and joining parts run here
let eng = 0, own = 0, tot = 0; for (const j of day) { const t = j.times || {}; if (j.status !== "done" || !j.doneAt || !j.sentAt) continue;
  tot += j.doneAt - j.created + (t.words || 0) * 1e3; eng += Math.max(0, j.doneAt - j.sentAt - ((t.fetch || 0) + (t.after || 0)) * 1e3) + (t.lips || 0) * 1e3; own += ((t.prep || 0) + Math.max(0, (t.after || 0) - (t.lips || 0)) + (t.join || 0)) * 1e3; }
if (tot) console.log("would a bigger server help? the AI engine own time:", Math.round((eng / tot) * 100) + "%", "· this server own work:", Math.round((own / tot) * 100) + "%", "→",
  own / tot >= 0.25 ? "yes — more cores make that part faster" : eng / tot >= 0.6 ? "no — the engine time does not change with this server" : "not clear yet");
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

# v138: what in all of the above needs the owner, in plain words
sec "What needs you"
J="$(journalctl -u nooi --since '24 hours ago' --no-pager -o cat 2>/dev/null)"
cnt() { printf '%s\n' "$J" | grep -ciE "$1" || true; }
nq="$(cnt 'credits insufficient|insufficient (credits|balance)|balance isn.t enough')"; ne="$(cnt 'EACCES')"; nb="$(cnt 'try again later|internal error')"; np="$(cnt 'previous part failed')"; need=0
# v139: when the last refusal was (the time of its line) — after a top-up the old ones still count for 24 h
LASTQ="$(journalctl -u nooi --since '24 hours ago' --no-pager -o short-unix 2>/dev/null | grep -iE 'credits insufficient|insufficient (credits|balance)|balance isn.t enough' | tail -1 | awk '{print $1}' | grep -E '^[0-9]+(\.[0-9]+)?$' || true)"
lq=""; [ -n "$LASTQ" ] && lq=" The last one was at $(date -d "@${LASTQ%.*}" '+%H:%M' 2>/dev/null) ($(( ( $(date +%s) - ${LASTQ%.*} ) / 60 )) min ago)."
# v186: a nearly full disk (every update used to pack all the media into a new backup)
dpct="$(df -P / | awk 'NR==2{gsub("%","",$5);print $5}')"
if [ "${dpct:-0}" -ge 85 ]; then need=1
  echo "⚠ The server's disk is ${dpct}% full — when it fills, new videos, pictures and saves fail."
  echo "  → See what fills it: bash $APP/deploy/space.sh   · clear what nooi doesn't need (never the site's data or media): bash $APP/deploy/space.sh --free"; fi
if [ "${nq:-0}" -gt 0 ]; then need=1
  echo "⚠ The AI engine account ran out of credits — it refused $nq request(s) in the last 24 h.$lq Pictures, videos and sounds fail until it is topped up;"
  pp=""; [ "${np:-0}" -gt 0 ] && pp=" $np film part(s) stopped because the part before them failed the same way."
  echo "  customers were not charged (their credits came back).$pp"
  echo "  → Top up the engine account on its website (kie.ai → Billing), then the site: Admin → Models → Connections & live status → Test all."; fi
if [ "${ne:-0}" -gt 0 ]; then need=1
  echo "⚠ $ne time(s) the site couldn't open its own folder (EACCES) — this happens for a few seconds while an update copies the new version."
  echo "  → Nothing to do: from v138 the update keeps the folder open to the site the whole time."; fi
if [ "${nb:-0}" -gt 0 ]; then
  echo "• The engine failed on its own side $nb time(s) (\"Internal Error, please try again later\"). From v138 voices, sounds and other engine steps are asked again"
  echo "  twice before a job fails; if it keeps happening, it is the engine's side — check its status page."; fi
cd "$APP" 2>/dev/null && LASTQ="$LASTQ" node -e '
const fs = require("fs"); let db = {}; try { db = JSON.parse(fs.readFileSync("data/db.json", "utf8")); } catch {}
const st = (db.settings || {}).status || {}, al = (db.settings || {}).alerts138 || {}, ago = (t) => Math.round((Date.now() - t) / 60e3) + " min ago";
for (const [k, a] of Object.entries(al)) if (a && a.type === "quota") console.log("⚠ The site has marked the AI engine (" + k + ") out of credits since " + ago(a.since) + " · " + a.count + " job(s) failed · it clears itself when a job is made again, or at the engine check the site makes every 15 min once the engine shows credits.");
const e = st.kie; if (e) console.log("AI engine connection (last check " + ago(e.checked || 0) + "): " + e.state + (e.note ? " · " + e.note : ""));
// v169: a balance the check could not read cannot show a top-up — say how the mark goes then
if (e && /balance not read/.test(e.note || "") && Object.values(al).some((a) => a && a.type === "quota"))
  console.log("  The site couldn’t read the engine’s balance (above), so it can’t see a top-up by itself: after topping up, Admin → Models → Connections & live status → Test on the AI engine takes the mark away (or the next picture or video made).");
// v139: checked after the last refusal and answering normally, with nothing marked → most likely topped up already
const lq = +process.env.LASTQ * 1000 || 0;
if (lq && e && e.state === "online" && (e.checked || 0) > lq && !Object.values(al).some((a) => a && a.type === "quota"))
  console.log("✓ The engine answered normally at its last check, after the last refusal — if you topped up, this is already solved (the count above is for the whole 24 h).");
' 2>/dev/null | mask
[ "$need" = 0 ] && echo "✓ Nothing above needs you."
echo; echo "Done — nothing was changed."
