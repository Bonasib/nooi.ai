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
// v249: what the server uses right now for the video makers (no keys): Admin wins over .env, and a change in Admin is used at once
// (no restart) — it is kept, encrypted, in data/db.json, so it is NOT in the .env file
try { const sec = await import(process.cwd() + "/lib/secrets.js"), P = st.S().providers || {};
  let bd = {}; try { bd = await import(process.cwd() + "/providers/bytedance241.js"); } catch {}
  console.log("── what the server uses right now (Admin wins over .env; saved in data/db.json, used at once, no restart)");
  for (const [k, nm] of [["seedance", "ByteDance (Seedance)"], ["kie", "AI engine"], ["minimax", "MiniMax"]]) {
    const adm = P[k] && P[k].enc ? sec.decrypt(P[k].enc) || {} : {}, c = st.cfg(k), from = (f) => (adm[f] ? "Admin" : c[f] ? ".env" : "-");
    let model = c.model || "", base = c.baseUrl || "";
    if (k === "seedance") { model = !model ? "(each Seedance model its own)" : /seedance/i.test(model) ? model : "IGNORED (" + String(model).slice(0, 40) + " is not a Seedance model id - put - in the field and save to clear it)"; base = bd.bdBase248 ? bd.bdBase248(c.baseUrl) : base; }
    if (k === "seedance") { const off = bd.notOpen250 ? bd.notOpen250() : []; if (off.length) console.log("  ⚠ NOT activated in your BytePlus account: " + off.join(", ") + " -> BytePlus console, ModelArk, model activation: activate it (BytePlus asks for a balance above USD 30, a Savings Plan or a Seedance resource pack); then Admin, AI providers, Seedance, Test. Meanwhile jobs use your other Seedance models."); }
    console.log("  " + nm + ": key " + (c.apiKey ? "yes (" + from("apiKey") + ")" : "NO") + " · model " + (model || "-") + (c.model ? " (" + from("model") + ")" : "") + " · address " + (base || "(default)") + (c.baseUrl ? " (" + from("baseUrl") + ")" : "")); } } catch (e) { console.log("  (could not read the settings: " + e.message + ")"); }
let m = {}; try { m = st.S().minimax183 || {}; } catch {}
console.log("  Everything on MiniMax:", yes((() => { try { return mm.mmAll237 ? mm.mmAll237() : false; } catch { return false; } })()), "· switches: videos", yes(m.video !== false), "· pictures", yes(m.image !== false), "· voices", yes(m.voice !== false), "· music", yes(m.music !== false));
let s = {}; try { s = (st.S().platform || {}).status || {}; } catch {} for (const k of ["kie", "minimax"]) if (s[k]) console.log(`  last check ${k === "kie" ? "AI engine" : "MiniMax"}: ${s[k].state || "?"} ${s[k].note ? "· " + String(s[k].note).slice(0, 90) : ""}`);
const fs = await import("fs"); const db = JSON.parse(fs.readFileSync("data/db.json", "utf8"));
const jobs = Object.values(db.users || {}).flatMap((U) => Object.values(U.jobs || {})).filter((j) => j && j.status === "failed").sort((a, b) => (b.created || 0) - (a.created || 0)).slice(0, +process.env.N || 8);
const VID = /\.(mp4|mov|webm|mkv|m4v)(\?|$)/i, mask = (x) => String(x || "").replace(/kie@/g, "engine@").replace(/^bd@/, "ByteDance@").replace(/Kie AI/g, "AI engine");
console.log(`\n── the last ${jobs.length} failed jobs (newest first)`);
for (const j of jobs) { const p = j.payload || {}, inp = p.inputs || {};
  const cant = /^mc(26|30|swap)$/.test(String(p.model || "")) ? "Motion Control / Character Swap" : ["lipsync", "avatar", "swap"].includes(String(p.kind || "")) ? p.kind : Object.values(inp).some((v) => VID.test(String(v || ""))) ? "starts from a video" : "";
  const ago = (t) => { const m = Math.round((Date.now() - (t || 0)) / 60000); return m < 60 ? m + " min ago" : m < 2880 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " days ago"; };
  console.log(`• ${new Date(j.created || 0).toISOString().slice(0, 16).replace("T", " ")} UTC (${ago(j.created)}) · ${p.kind || j.kind} · model ${p.model || "auto"} · went to ${mask(j.prov) || "?"}${j.own185 ? " (after " + mask(j.own185) + ")" : ""}`);
  console.log(`    why: ${mask(j.error || (j.errors || []).slice(-1)[0] || "?").slice(0, 220)}`);
  // v252: what the maker itself said (the customer sees the short line above) — keys never shown
  { const raw = [...(j.errors || []), j.errorDetail ? (j.prov || "") + ": " + j.errorDetail : ""].filter(Boolean).slice(-3).map((x) => mask(x).replace(/(Bearer\s+|api[_-]?key["=: ]+)[A-Za-z0-9._-]{8,}/gi, "$1…").slice(0, 260));
    if (raw.length) console.log(`    what the maker said: ${raw.join(" | ")}`); }
  console.log(`    MiniMax could make it: ${cant ? "NO — " + cant + (p.model === "mcswap" ? " (from v246 the ByteDance key takes Character Swaps first; a real face then needs the AI engine balance)" : " (needs the AI engine balance)") : "yes"}`);
  if (j.mmWhy239) console.log(`    why MiniMax did not take over: ${j.mmWhy239}`); }
if (!jobs.length) console.log("  (none)");
// v252: the jobs still being made — how long each has waited and where (Seedance usually 2-8 min; a long video is made in parts)
{ const live = Object.values(db.users || {}).flatMap((U) => Object.values(U.jobs || {})).filter((j) => j && ["queued", "rendering"].includes(j.status)).sort((a, b) => (a.created || 0) - (b.created || 0));
  console.log(`\n── jobs being made now: ${live.length}`);
  for (const j of live.slice(-12)) { const p = j.payload || {}, min = Math.round((Date.now() - (j.created || 0)) / 60000);
    console.log(`• ${p.kind || j.kind} · model ${p.model || "auto"} · ${j.status}${j.stage ? " (" + j.stage + ")" : ""} · at ${mask(j.prov) || "?"} · ${min} min${j.partsTotal ? " · parts " + (j.partsDone || 0) + "/" + j.partsTotal : ""}${j.remoteId ? "" : " · not sent yet"}${min > 20 ? "  ⚠ longer than usual" : ""}`); } }
'
