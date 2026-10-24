// v148: AI agents edit the editor projects kept on your account (Claude, ChatGPT and other MCP clients, through the same nooi
// connection and its rules). An agent reads a project's timeline, looks at a frame, and adds, trims, moves or removes clips,
// adds and changes texts, adds markers and changes the size. Each change is an operation kept beside the project and applied
// to the saved copy at once; an editor that has the project open applies the same operation live (it asks every few seconds),
// and a save from an editor that hasn't seen it yet gets it applied again on the way in — so neither side's work is lost.
// The operations are written so that applying one twice changes nothing.
//   GET /v1/projects/:id/ops?after=N → {seq, ops:[{n, op, at, by}]}
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { user, uid } from "./store.js";
import { MEDIA_DIR } from "./media.js";
import { getProject139, listProjects139, saveProject139, HOOK139 } from "./projects139.js";

const KEEP = 100;   // operations kept per project (older ones are in the saved copy already)
// v150: more operations and agent tools added by other parts (lib/motion150.js) — {op: (ed, args, doc) => …} and (uidv, name, args, ctx) => result|null
export const OPS148 = {}, EXT148 = [];
export const FORMATS148 = { reels: [1080, 1920], igstory: [1080, 1920], igfeed: [1080, 1350], igsq: [1080, 1080], tiktok: [1080, 1920], shorts: [1080, 1920], youtube: [1920, 1080],
  fbfeed: [1080, 1350], fbstory: [1080, 1920], x: [1280, 720], xsq: [1080, 1080], linkedin: [1080, 1080], linkedinw: [1920, 1080], snap: [1080, 1920], wa: [1080, 1920], cinema: [2520, 1080] };
const bad = (en, ar, code = 400) => Object.assign(new Error(en), { code, errorAr: ar });
const opsFile = (uidv, id) => path.join(path.resolve("data/projects139"), crypto.createHash("sha1").update(String(uidv)).digest("hex").slice(0, 24), id + ".ops.json");
function readOps(uidv, id) { try { const o = JSON.parse(fs.readFileSync(opsFile(uidv, id), "utf8")); return { seq: +o.seq || 0, ops: Array.isArray(o.ops) ? o.ops : [] }; } catch { return { seq: 0, ops: [] }; } }
function writeOps(uidv, id, o) { const f = opsFile(uidv, id); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + ".tmp", JSON.stringify(o)); fs.renameSync(f + ".tmp", f); }
export const opsAfter148 = (uidv, id, after) => { const o = readOps(uidv, id); return { seq: o.seq, ops: o.ops.filter((x) => x.n > (+after || 0)) }; };

const num = (v, lo, hi, d) => { const x = +v; return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
const dur = (c) => Math.max(0.1, ((+c.out || 0) - (+c.in || 0)) / (+c.speed || 1));
const starts = (cl) => { let s = 0; return cl.map((c) => { const r = s; s += dur(c); return r; }); };
// a clip by its id or its number on the timeline (1 = the first)
function clipOf(ed, ref) { const cl = ed.clips || []; const c = cl.find((x) => x.id === String(ref)) || (/^\d+$/.test(String(ref)) ? cl[+ref - 1] : null); if (!c) throw bad("There's no clip " + ref + " — the timeline has " + cl.length + ".", "لا يوجد مقطع " + ref + " — في الخط الزمني " + cl.length + "."); return c; }

// the timeline an operation is for: the one open when the agent made it (a project can hold several — v148 in the page keeps
// the others in ed.seq148.list[].data)
function edOf(doc, tl) { const ed = doc.ed, q = ed && ed.seq148; if (!tl || !q || q.cur === tl || !Array.isArray(q.list)) return ed; const s = q.list.find((x) => x.id === tl); return s && s.data ? s.data : ed; }
// one operation applied to a project document {ed, media} — the same rules as op148 in the page
export function applyOp148(doc, op) {
  doc.media = doc.media || {}; const ed = edOf(doc, op.tl), a = op.args || {}; ed.clips = ed.clips || []; ed.texts = ed.texts || [];
  switch (op.op) {
    case "clip_add": { if (ed.clips.some((c) => c.id === a.id)) return; const c = { id: a.id, src: { k: "upload", name: String(a.name || "clip").slice(0, 80) }, in: a.in, out: a.out, speed: 1, trans: "cut", vol: 100 };
      const at = a.at == null ? ed.clips.length : Math.max(0, Math.min(ed.clips.length, +a.at)); ed.clips.splice(at, 0, c); doc.media["c_" + a.id] = { url: a.url, type: a.type, name: c.src.name }; return; }
    case "clip_trim": { const c = ed.clips.find((x) => x.id === a.id); if (!c) return; for (const k of ["in", "out", "speed", "vol"]) if (a[k] != null) c[k] = a[k]; return; }
    case "clip_remove": { ed.clips = ed.clips.filter((x) => x.id !== a.id); if (ed.sel === a.id) ed.sel = null; return; }
    case "clip_move": { const i = ed.clips.findIndex((x) => x.id === a.id); if (i < 0) return; const [c] = ed.clips.splice(i, 1); ed.clips.splice(Math.max(0, Math.min(ed.clips.length, +a.to)), 0, c); return; }
    case "text_add": { if (ed.texts.some((t) => t.id === a.id)) return; ed.texts.push({ id: a.id, text: a.text, start: a.start, end: a.end, pos: a.pos, style: a.style, size: 7, anim: "pop" }); return; }
    case "text_edit": { if (a.remove) { ed.texts = ed.texts.filter((t) => t.id !== a.id); return; } const t = ed.texts.find((x) => x.id === a.id); if (!t) return; for (const k of ["text", "start", "end", "pos"]) if (a[k] != null) t[k] = a[k]; return; }
    case "marker_add": { ed.marks146 = ed.marks146 || []; if (ed.marks146.some((m) => m.id === a.id)) return; ed.marks146.push({ id: a.id, t: a.t, n: a.n || "" }); ed.marks146.sort((x, y) => x.t - y.t); return; }
    case "format_set": { if (FORMATS148[a.format]) ed.format = a.format; return; }
    default: if (OPS148[op.op]) OPS148[op.op](ed, a, doc);
  }
}
// an agent's operation: applied to the saved copy and kept for an open editor
function commit(uidv, id, op, who) {
  const p = getProject139(uidv, id), o = readOps(uidv, id), n = o.seq + 1, q = p.doc.ed && p.doc.ed.seq148, rec = { n, op: op.op, args: op.args, at: Date.now(), by: who || "agent", ...(q && q.cur ? { tl: q.cur } : {}) };
  applyOp148(p.doc, rec); saveProject139(uidv, id, { name: p.name, doc: p.doc });
  o.seq = n; o.ops.push(rec); if (o.ops.length > KEEP) o.ops = o.ops.slice(-KEEP); writeOps(uidv, id, o); return { project: getProject139(uidv, id), n };
}
// a save from the page that hasn't seen the latest operations yet: they are applied to it on the way in
HOOK139.beforeSave = (uidv, id, body) => { const o = readOps(uidv, id), seen = +(body && body.opN) || 0; if (!body || !body.doc || !body.doc.ed) return body;
  for (const x of o.ops) if (x.n > seen) try { applyOp148(body.doc, x); } catch {} return body; };

// what an agent reads: the timeline in plain numbers
export function timeline148(p) {
  const ed = p.doc.ed, cl = ed.clips || [], st = starts(cl), f = FORMATS148[ed.format] || null;
  const nm = (c) => (p.doc.media && p.doc.media["c_" + c.id] && p.doc.media["c_" + c.id].name) || (c.src && (c.src.name || c.src.k)) || "clip";
  return { project_id: p.id, name: p.name, format: ed.format || null, size: f ? f[0] + "x" + f[1] : null, seconds: +(st.length ? st[st.length - 1] + dur(cl[cl.length - 1]) : 0).toFixed(2),
    clips: cl.map((c, i) => ({ n: i + 1, clip_id: c.id, name: nm(c), start: +st[i].toFixed(2), seconds: +dur(c).toFixed(2), trim_start: +(+c.in || 0).toFixed(2), trim_end: +(+c.out || 0).toFixed(2), speed: +c.speed || 1, volume: c.vol == null ? 100 : +c.vol, transition: c.trans || "cut" })),
    texts: (ed.texts || []).map((t) => ({ text_id: t.id, text: t.text, start: +(+t.start).toFixed(2), end: +(+t.end).toFixed(2), position: t.pos || "bottom" })),
    markers: (ed.marks146 || []).map((m) => ({ marker_id: m.id, time: m.t, name: m.n || "" })),
    motion_scenes: (ed.infos || []).filter((x) => x.type === "mg150").map((x) => ({ scene_id: x.id, kind: x.sc, start: +(+x.start).toFixed(2), end: +(+x.end).toFixed(2), title: x.t1 || "", subtitle: x.t2 || "" })),
    music: !!(p.doc.media && p.doc.media.edMusic), effects: (ed.vfx || []).length, graphics: (ed.infos || []).length, sounds: (ed.sfx || []).length, overlays: (ed.layers || []).length,
    ...(ed.seq148 && Array.isArray(ed.seq148.list) && ed.seq148.list.length > 1 ? { timeline: (ed.seq148.list.find((x) => x.id === ed.seq148.cur) || {}).name || "", other_timelines: ed.seq148.list.filter((x) => x.id !== ed.seq148.cur).map((x) => x.name), note: "Changes go to the timeline open when the project was last saved." } : {}) };
}
const run = (args) => new Promise((ok, bad2) => { const p = spawn(process.env.FFMPEG_PATH || "ffmpeg", args); let err = ""; p.stderr.on("data", (d) => (err = (err + d).slice(-400))); p.on("error", bad2); p.on("close", (c) => (c === 0 ? ok() : bad2(new Error(err.trim().split("\n").pop() || "ffmpeg failed")))); });
const fileOf = (u) => { const m = /\/media\/([A-Za-z0-9._-]+)(?:[?#].*)?$/.exec(String(u || "")); const f = m && path.join(MEDIA_DIR, m[1]); return f && fs.existsSync(f) ? f : null; };
// one frame of the timeline (the clip's own picture at that moment; texts and effects are drawn by the editor, not here)
async function frame148(p, t) {
  const ed = p.doc.ed, cl = ed.clips || []; if (!cl.length) throw bad("This project has no clips yet.", "لا مقاطع في هذا المشروع بعد.");
  const st = starts(cl); let i = cl.length - 1; for (let k = 0; k < cl.length; k++) if (t < st[k] + dur(cl[k])) { i = k; break; }
  const c = cl[i], m = (p.doc.media || {})["c_" + c.id] || {}, f = fileOf(m.url || (c.src && c.src.url139));
  if (c.src && c.src.k === "demo") throw bad("This moment is the background of animated motion scenes, drawn by the editor itself — open the project in nooi to see it (nooi_timeline_read lists the scenes).", "هذه اللحظة خلفية مشاهد متحركة يرسمها المحرر نفسه — افتح المشروع في nooi لتراها.");   // (v150)
  if (!f) throw bad("This clip's file is only on the device that added it.", "ملف هذا المقطع موجود فقط على الجهاز الذي أضافه.");
  const lt = (+c.in || 0) + Math.max(0, t - st[i]) * (+c.speed || 1), out = path.join(MEDIA_DIR, uid() + "-frame148.jpg");
  try { await run(["-y", "-v", "error", ...(m.type === "image" ? [] : ["-ss", lt.toFixed(3)]), "-i", f, "-frames:v", "1", "-vf", "scale='min(640,iw)':-2", "-q:v", "4", out]); return { data: fs.readFileSync(out).toString("base64"), clip: i + 1, at: +lt.toFixed(2) }; }
  finally { fs.rm(out, { force: true }, () => {}); }
}
function probeDur(f) { return new Promise((ok) => { const p = spawn(process.env.FFPROBE_PATH || "ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]); let o = ""; p.stdout.on("data", (d) => (o += d)); p.on("error", () => ok(0)); p.on("close", () => ok(+o || 0)); }); }

// ---- the tools agents see
const P = { project_id: { type: "string", description: "From nooi_editor_projects" } }, CLIP = { clip: { type: "string", description: "The clip's clip_id, or its number on the timeline (1 = the first)" } };
export const TOOLS148 = [
  { name: "nooi_editor_projects", description: "List the video editor projects kept on the user's nooi account (newest first).", inputSchema: { type: "object", properties: {} } },
  { name: "nooi_timeline_read", description: "Read a project's timeline: size, length, clips in order (start, length, trim, speed, volume, transition), texts, markers and what else is on it.", inputSchema: { type: "object", properties: P, required: ["project_id"] } },
  { name: "nooi_preview_frame", description: "See the timeline at a moment: a picture of the clip playing then (texts and effects are drawn by the editor, not in this picture).", inputSchema: { type: "object", properties: { ...P, time: { type: "number", description: "Seconds from the start" } }, required: ["project_id", "time"] } },
  { name: "nooi_clip_add", description: "Put one of the user's finished videos or images (an id from nooi_list_assets) on the timeline.", inputSchema: { type: "object", properties: { ...P, asset_id: { type: "string" }, position: { type: "number", description: "1 = first; leave out to add at the end" }, trim_start: { type: "number" }, trim_end: { type: "number" } }, required: ["project_id", "asset_id"] } },
  { name: "nooi_clip_trim", description: "Change a clip: where it starts and ends in its own file (seconds), its speed (0.25–4) or its volume (0–100).", inputSchema: { type: "object", properties: { ...P, ...CLIP, trim_start: { type: "number" }, trim_end: { type: "number" }, speed: { type: "number" }, volume: { type: "number" } }, required: ["project_id", "clip"] } },
  { name: "nooi_clip_move", description: "Move a clip to another place in the order (1 = first).", inputSchema: { type: "object", properties: { ...P, ...CLIP, position: { type: "number" } }, required: ["project_id", "clip", "position"] } },
  { name: "nooi_clip_remove", description: "Take a clip off the timeline.", inputSchema: { type: "object", properties: { ...P, ...CLIP }, required: ["project_id", "clip"] } },
  { name: "nooi_text_add", description: "Add a text (title, caption, call to action) shown from start to end seconds.", inputSchema: { type: "object", properties: { ...P, text: { type: "string" }, start: { type: "number" }, end: { type: "number" }, position: { type: "string", enum: ["top", "center", "bottom"] }, style: { type: "string", enum: ["caption", "clean", "serif", "bold", "box"] } }, required: ["project_id", "text", "start", "end"] } },
  { name: "nooi_text_edit", description: "Change a text's words or timing, or remove it.", inputSchema: { type: "object", properties: { ...P, text_id: { type: "string" }, text: { type: "string" }, start: { type: "number" }, end: { type: "number" }, position: { type: "string", enum: ["top", "center", "bottom"] }, remove: { type: "boolean" } }, required: ["project_id", "text_id"] } },
  { name: "nooi_marker_add", description: "Put a marker (a named moment) on the ruler.", inputSchema: { type: "object", properties: { ...P, time: { type: "number" }, name: { type: "string" } }, required: ["project_id", "time"] } },
  { name: "nooi_format_set", description: "Change the project's size for a platform.", inputSchema: { type: "object", properties: { ...P, format: { type: "string", enum: Object.keys(FORMATS148) } }, required: ["project_id", "format"] } },
];
export const WRITE148 = new Set(["nooi_clip_add", "nooi_clip_trim", "nooi_clip_move", "nooi_clip_remove", "nooi_text_add", "nooi_text_edit", "nooi_marker_add", "nooi_format_set"]);
const txt = (o) => ({ content: [{ type: "text", text: typeof o === "string" ? o : JSON.stringify(o, null, 2) }] });
export async function call148(uidv, name, a) {
  if (name === "nooi_editor_projects") return txt({ projects: listProjects139(uidv).slice(0, 50).map((p) => ({ project_id: p.id, name: p.name, seconds: p.dur, clips: p.clips, format: p.format, updated: new Date(p.updated || 0).toISOString() })) });
  const id = String(a.project_id || ""), p = getProject139(uidv, id), ed = p.doc.ed;
  const done = (r, what) => txt({ ok: true, did: what, timeline: timeline148(r.project) });
  switch (name) {
    case "nooi_timeline_read": return txt(timeline148(p));
    case "nooi_preview_frame": { const t = num(a.time, 0, 36000, 0), f = await frame148(p, t); return { content: [{ type: "image", data: f.data, mimeType: "image/jpeg" }, { type: "text", text: JSON.stringify({ time: t, clip: f.clip, clip_time: f.at, note: "The clip's own picture; texts and effects are added by the editor." }) }] }; }
    case "nooi_clip_add": { const j = user(uidv).jobs[String(a.asset_id || "")]; if (!j || j.status !== "done" || !j.url || !["video", "image"].includes(j.kind === "image" ? "image" : j.kind === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(j.url) ? "video" : "")) throw bad("That isn't a finished video or image of yours — use an id from nooi_list_assets.", "هذا ليس فيديو أو صورة جاهزة لك.");
      const type = j.kind === "image" || /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(j.url) ? "image" : "video", f = fileOf(j.url), full = type === "video" ? (+j.dur || (f ? await probeDur(f) : 0) || 5) : 3;
      const s = num(a.trim_start, 0, Math.max(0, full - 0.1), 0), e = num(a.trim_end, s + 0.1, type === "video" ? full : 30, type === "video" ? Math.min(full, s + 30) : 3);
      const r = commit(uidv, id, { op: "clip_add", args: { id: uid(), url: String(j.url).replace(/^https?:\/\/[^/]+/, ""), type, name: String(j.title || j.payload?.prompt || "clip").slice(0, 80), in: +s.toFixed(2), out: +e.toFixed(2), at: a.position == null ? null : Math.max(0, +a.position - 1) } });
      return done(r, "clip added"); }
    case "nooi_clip_trim": { const c = clipOf(ed, a.clip), args = { id: c.id }; if (a.trim_start != null) args.in = +num(a.trim_start, 0, 36000, c.in).toFixed(2); if (a.trim_end != null) args.out = +num(a.trim_end, (args.in ?? c.in) + 0.1, 36000, c.out).toFixed(2);
      if (a.speed != null) args.speed = num(a.speed, 0.25, 4, 1); if (a.volume != null) args.vol = Math.round(num(a.volume, 0, 100, 100)); if ((args.in ?? c.in) >= (args.out ?? c.out)) throw bad("The clip would end before it starts.", "سينتهي المقطع قبل أن يبدأ.");
      return done(commit(uidv, id, { op: "clip_trim", args }), "clip changed"); }
    case "nooi_clip_move": { const c = clipOf(ed, a.clip); return done(commit(uidv, id, { op: "clip_move", args: { id: c.id, to: Math.max(0, Math.round(+a.position || 1) - 1) } }), "clip moved"); }
    case "nooi_clip_remove": { const c = clipOf(ed, a.clip); return done(commit(uidv, id, { op: "clip_remove", args: { id: c.id } }), "clip removed"); }
    case "nooi_text_add": { const t = String(a.text || "").trim().slice(0, 200); if (!t) throw bad("Say the words of the text.", "اكتب كلمات النص.");
      const s = num(a.start, 0, 36000, 0), e = num(a.end, s + 0.2, 36000, s + 3);
      return done(commit(uidv, id, { op: "text_add", args: { id: uid(), text: t, start: +s.toFixed(2), end: +e.toFixed(2), pos: ["top", "center", "bottom"].includes(a.position) ? a.position : "bottom", style: ["caption", "clean", "serif", "bold", "box"].includes(a.style) ? a.style : "caption" } }), "text added"); }
    case "nooi_text_edit": { const t = (ed.texts || []).find((x) => x.id === String(a.text_id)); if (!t) throw bad("There's no text " + a.text_id + ".", "لا يوجد نص " + a.text_id + ".");
      const args = { id: t.id }; if (a.remove) args.remove = true; else { if (a.text != null) args.text = String(a.text).slice(0, 200); if (a.start != null) args.start = +num(a.start, 0, 36000, t.start).toFixed(2); if (a.end != null) args.end = +num(a.end, 0, 36000, t.end).toFixed(2); if (["top", "center", "bottom"].includes(a.position)) args.pos = a.position; }
      return done(commit(uidv, id, { op: "text_edit", args }), a.remove ? "text removed" : "text changed"); }
    case "nooi_marker_add": return done(commit(uidv, id, { op: "marker_add", args: { id: uid(), t: +num(a.time, 0, 36000, 0).toFixed(2), n: String(a.name || "").slice(0, 40) } }), "marker added");
    case "nooi_format_set": { if (!FORMATS148[a.format]) throw bad("Unknown size " + a.format + ".", "مقاس غير معروف."); return done(commit(uidv, id, { op: "format_set", args: { format: a.format } }), "size changed"); }
  }
  for (const f of EXT148) { const r = await f(uidv, name, a, { p, id, ed, commit: (op) => commit(uidv, id, op), done, total: () => { const cl = ed.clips || [], st = starts(cl); return st.length ? st[st.length - 1] + dur(cl[cl.length - 1]) : 0; } }); if (r) return r; }
  return null;
}
export function registerEdit148(app, requireUser) {
  app.get("/v1/projects/:id/ops", requireUser, (req, res) => { try { getProject139(req.user.uid, req.params.id); res.json(opsAfter148(req.user.uid, req.params.id, req.query.after)); } catch (e) { res.status(e.code || 500).json({ error: e.message, errorAr: e.errorAr }); } });
}
