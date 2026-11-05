#!/bin/bash
# v238: why did the last AI jobs fail? — read-only, prints no keys. Shows which engines are connected (yes / no only), whether
# "Everything on MiniMax" is on, and the last failed jobs: what was asked, where it went, why it failed, and whether MiniMax could
# have made it (a Character Swap, Motion Control, lip-sync or a job that starts from a video can't be made by MiniMax).
# Usage (as root):  bash /opt/nooi/deploy/why.sh        (or N failed jobs:  bash /opt/nooi/deploy/why.sh 15)
APP="${APP:-/opt/nooi}"; N="${1:-8}"
cd "$APP" 2>/dev/null || { echo "✗ $APP not found"; exit 1; }
RUN="node"; id nooi >/dev/null 2>&1 && [ "$(id -u)" = 0 ] && RUN="sudo -u nooi -H node"
N="$N" $RUN --input-type=module -e '
import "dotenv/config";
const st = await import(process.cwd() + "/lib/settings.js");
let mm = {}; try { mm = await import(process.cwd() + "/providers/minimax183.js"); } catch {}
const yes = (b) => (b ? "yes" : "NO"), on = (k) => { try { return st.configured(k); } catch { return false; } };
console.log("── engines (connected?)");
console.log("  AI engine (videos, swaps, motion):", yes(on("kie")));
console.log("  MiniMax key:", yes(on("minimax")));
let m = {}; try { m = st.S().minimax183 || {}; } catch {}
console.log("  Everything on MiniMax:", yes((() => { try { return mm.mmAll237 ? mm.mmAll237() : false; } catch { return false; } })()), "· switches: videos", yes(m.video !== false), "· pictures", yes(m.image !== false), "· voices", yes(m.voice !== false), "· music", yes(m.music !== false));
let s = {}; try { s = (st.S().platform || {}).status || {}; } catch {} for (const k of ["kie", "minimax"]) if (s[k]) console.log(`  last check ${k === "kie" ? "AI engine" : "MiniMax"}: ${s[k].state || "?"} ${s[k].note ? "· " + String(s[k].note).slice(0, 90) : ""}`);
const fs = await import("fs"); const db = JSON.parse(fs.readFileSync("data/db.json", "utf8"));
const jobs = Object.values(db.users || {}).flatMap((U) => Object.values(U.jobs || {})).filter((j) => j && j.status === "failed").sort((a, b) => (b.created || 0) - (a.created || 0)).slice(0, +process.env.N || 8);
const VID = /\.(mp4|mov|webm|mkv|m4v)(\?|$)/i, mask = (x) => String(x || "").replace(/kie@/g, "engine@").replace(/Kie AI/g, "AI engine");
console.log(`\n── the last ${jobs.length} failed jobs (newest first)`);
for (const j of jobs) { const p = j.payload || {}, inp = p.inputs || {};
  const cant = /^mc(26|30|swap)$/.test(String(p.model || "")) ? "Motion Control / Character Swap" : ["lipsync", "avatar", "swap"].includes(String(p.kind || "")) ? p.kind : Object.values(inp).some((v) => VID.test(String(v || ""))) ? "starts from a video" : "";
  console.log(`• ${new Date(j.created || 0).toISOString().slice(0, 16).replace("T", " ")} · ${p.kind || j.kind} · model ${p.model || "auto"} · went to ${mask(j.prov) || "?"}${j.own185 ? " (after " + mask(j.own185) + ")" : ""}`);
  console.log(`    why: ${mask(j.error || (j.errors || []).slice(-1)[0] || "?").slice(0, 220)}`);
  console.log(`    MiniMax could make it: ${cant ? "NO — " + cant + " (needs the AI engine balance)" : "yes"}`); }
if (!jobs.length) console.log("  (none)");
'
