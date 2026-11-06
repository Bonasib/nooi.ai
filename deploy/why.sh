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
const only = (() => { try { return st.mmOnly240 ? st.mmOnly240() : false; } catch { return false; } })(), kieKey = (() => { try { return !!st.cfg("kie").apiKey; } catch { return false; } })();
console.log("  AI engine (videos, swaps, motion):", only ? (kieKey ? "OFF (key saved, not used: Only my MiniMax key is on)" : "OFF (Only my MiniMax key is on)") : yes(on("kie")));
console.log("  MiniMax key:", yes(on("minimax")));
console.log("  ByteDance key (Seedance, BytePlus ModelArk):", yes(on("seedance")));
// v241b: every key saved in Admin, AI providers: saved yes/no (never the key). One that is saved but cannot be read means the
// SECRET_KEY in the server .env was changed after it was saved
try { const sec = await import(process.cwd() + "/lib/secrets.js"), P = st.S().providers || {}, saved = [], unread = [];
  for (const [k, v] of Object.entries(P)) { if (!v || !v.enc) continue; const d = sec.decrypt(v.enc) || {}; if (!Object.keys(d).length) unread.push(k); else if (d.apiKey || d.secretKey || d.accessKey || d.clientId) saved.push(k); }
  const nm = (k) => (k === "kie" ? "AI engine" : k);
  console.log("  keys saved in Admin:", saved.length ? saved.map(nm).join(", ") : "none");
  if (unread.length) console.log("  WARNING saved but can NOT be read (was SECRET_KEY in .env changed?):", unread.map(nm).join(", ")); } catch (e) { console.log("  keys saved in Admin: (could not check)"); }
console.log("  Only my MiniMax key (the AI engine never used):", yes(only));
let m = {}; try { m = st.S().minimax183 || {}; } catch {}
console.log("  Everything on MiniMax:", yes((() => { try { return mm.mmAll237 ? mm.mmAll237() : false; } catch { return false; } })()), "· switches: videos", yes(m.video !== false), "· pictures", yes(m.image !== false), "· voices", yes(m.voice !== false), "· music", yes(m.music !== false));
let s = {}; try { s = (st.S().platform || {}).status || {}; } catch {} for (const k of ["kie", "minimax"]) if (s[k]) console.log(`  last check ${k === "kie" ? "AI engine" : "MiniMax"}: ${s[k].state || "?"} ${s[k].note ? "· " + String(s[k].note).slice(0, 90) : ""}`);
const fs = await import("fs"); const db = JSON.parse(fs.readFileSync("data/db.json", "utf8"));
const jobs = Object.values(db.users || {}).flatMap((U) => Object.values(U.jobs || {})).filter((j) => j && j.status === "failed").sort((a, b) => (b.created || 0) - (a.created || 0)).slice(0, +process.env.N || 8);
const VID = /\.(mp4|mov|webm|mkv|m4v)(\?|$)/i, mask = (x) => String(x || "").replace(/kie@/g, "engine@").replace(/^bd@/, "ByteDance@").replace(/Kie AI/g, "AI engine");
console.log(`\n── the last ${jobs.length} failed jobs (newest first)`);
for (const j of jobs) { const p = j.payload || {}, inp = p.inputs || {};
  const cant = /^mc(26|30|swap)$/.test(String(p.model || "")) ? "Motion Control / Character Swap" : ["lipsync", "avatar", "swap"].includes(String(p.kind || "")) ? p.kind : Object.values(inp).some((v) => VID.test(String(v || ""))) ? "starts from a video" : "";
  console.log(`• ${new Date(j.created || 0).toISOString().slice(0, 16).replace("T", " ")} · ${p.kind || j.kind} · model ${p.model || "auto"} · went to ${mask(j.prov) || "?"}${j.own185 ? " (after " + mask(j.own185) + ")" : ""}`);
  console.log(`    why: ${mask(j.error || (j.errors || []).slice(-1)[0] || "?").slice(0, 220)}`);
  console.log(`    MiniMax could make it: ${cant ? "NO — " + cant + " (needs the AI engine balance)" : "yes"}`);
  if (j.mmWhy239) console.log(`    why MiniMax did not take over: ${j.mmWhy239}`); }
if (!jobs.length) console.log("  (none)");
'
