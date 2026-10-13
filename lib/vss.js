// Video intelligence — the workflows of NVIDIA's "Video Search and Summarization" (VSS) blueprint, built into nooi:
//   · long-video summarization: the video is cut into chunks, a few frames of each chunk go to the vision AI as one
//     contact sheet → dense captions with timestamps, objects and the events you asked for → one summary, highlights,
//     a timeline and a report (VSS "LVS": chunking + caption aggregation)
//   · Q&A over a video: the captions closest to the question are retrieved and the text AI answers with timestamps (VSS CA-RAG chat)
//   · natural-language search across every analysed video → the matching moments (VSS video search)
//   · alerts: events you list are checked in every chunk; live frames (camera / a playing video) can be checked on a timer (VSS RT alerts)
//   · alert verification: one clip + one alert → confirmed / rejected with the reason (VSS VLM-as-verifier)
// When an admin connects a real NVIDIA VSS server (Admin → AI providers → NVIDIA VSS: its REST URL, e.g. http://host:38111,
// and its token), summaries and Q&A run there instead (POST /v1/summarize with enable_qa, POST /v1/chat/completions).
// Records live in the user's data (`u.vss`), at most 60; frames are temporary files.
import fs from "fs"; import os from "os"; import path from "path"; import { spawn } from "child_process";
import { user, save, uid } from "./store.js";
import { requireUser } from "./auth.js";
import { isStaff } from "./admin.js";
import { charge } from "./billing.js";
import { cfg } from "./settings.js";
import { MEDIA_DIR, localPath, download } from "./media.js";
import { llmJson, llmConfigured } from "../providers/anthropic.js";
import { nvChat, nvReady, nvOn, nvCfg } from "../providers/nvidia.js";
import { transcribeFile, sttReady, publicHost, locPrice } from "./localize.js";

export const VSS_PRICE = { chunk: 1, summary: 2, ask: 1, search: 1, verify: 1, watch: 1 };
const FF = () => process.env.FFMPEG_PATH || "ffmpeg", FP = () => process.env.FFPROBE_PATH || "ffprobe";
const MAX_CHUNKS = 40;
// NVIDIA hosted models (build.nvidia.com API key "nvapi-…"): Admin → AI providers → NVIDIA AI. Two URL styles:
//   · OpenAI-compatible (default https://integrate.api.nvidia.com/v1 → /chat/completions with a model id)
//   · one model's own VLM endpoint, e.g. https://ai.api.nvidia.com/v1/vlm/google/paligemma (posted to as is, no model id)
// Pictures go inline as data URLs (NVIDIA's inline limit is ~180 KB base64 — contact sheets are shrunk to fit).
const aiReady = () => llmConfigured() || nvReady();
const parseJson = (t) => { const s = t.indexOf("{"), e = t.lastIndexOf("}"); if (s < 0 || e < 0) return null; try { return JSON.parse(t.slice(s, e + 1)); } catch { return null; } };
// the vision step: Claude/Qwen when connected, otherwise NVIDIA; a model that answers in plain words still gives a caption
async function visionJson(prompt, img, opts = {}) {
  if (!nvOn("vision")) return llmJson(prompt, { images: [img], ...opts });
  const t = await nvChat(prompt + "\n\nRespond with only the JSON object.", { image: img, maxTokens: opts.maxTokens || 900, timeoutMs: opts.timeoutMs });
  return parseJson(t) || { caption: t.trim().slice(0, 900), reason: t.trim().slice(0, 300), plain: true };
}
async function textJson(prompt, opts = {}) {
  if (!nvOn("text")) return llmJson(prompt, opts);
  if (/\/vlm\//.test(nvCfg().chat)) throw new Error("no text model");
  const j = parseJson(await nvChat(prompt + "\n\nRespond with only the JSON object — no prose, no code fences.", { maxTokens: opts.maxTokens || 2000, timeoutMs: opts.timeoutMs }));
  if (!j) throw new Error("The text model did not return JSON"); return j;
}
const vssCfg = () => { const c = cfg("vss"); return { url: (c.baseUrl || "").replace(/\/$/, ""), key: c.apiKey || "", model: c.model || "" }; };
export const vssServer = () => !!vssCfg().url;
const run = (bin, args, out) => new Promise((res, rej) => { const p = spawn(bin, args); let o = "", e = ""; p.stdout.on("data", (d) => { o += d; }); p.stderr.on("data", (d) => { e += d; }); p.on("error", rej); p.on("close", (c) => (c === 0 ? res(out ? o : null) : rej(new Error((bin.includes("probe") ? "ffprobe" : "ffmpeg") + " failed: " + e.slice(-200))))); });
const recs = (uidv) => { const u = user(uidv); if (!u.vss) u.vss = {}; return u.vss; };
const pub = (r) => r && ({ id: r.id, title: r.title, src: r.src, job: r.job || null, status: r.status, progress: r.progress, error: r.error || null, created: r.created, dur: r.dur, chunk: r.chunk, by: r.by, audio: !!r.audio, speechBy: r.speechBy || null, speechError: r.speechError || null,
  scenario: r.scenario || "", events: r.events || [], summary: r.summary || null, chunks: (r.chunks || []).map((c) => ({ s: c.s, e: c.e, caption: c.caption, speech: c.speech || "", objects: c.objects, tags: c.tags, events: c.events })), chat: (r.chat || []).slice(-20) });
const mmss = (t) => { t = Math.max(0, Math.round(t)); return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0"); };
const words = (s) => String(s || "").toLowerCase().normalize("NFKC").split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);
function score(q, text) { const qs = new Set(words(q)); if (!qs.size) return 0; const ws = words(text); let n = 0; for (const w of ws) if (qs.has(w)) n++; for (const w of qs) if (ws.some((x) => x !== w && (x.startsWith(w) || w.startsWith(x)) && Math.min(x.length, w.length) > 3)) n += 0.5; return n / Math.sqrt(ws.length + 4); }
const chunkText = (c) => [c.caption, c.speech || "", (c.objects || []).join(" "), (c.tags || []).join(" "), (c.events || []).filter((e) => e.present).map((e) => e.name + " " + (e.detail || "")).join(" ")].join(" ");

async function sourceFile(src) {
  const u = String(src || ""); if (!u) throw Object.assign(new Error("Pick a video first"), { code: 400 });
  if (u.startsWith("/media/")) { const f = path.join(MEDIA_DIR, path.basename(u)); if (fs.existsSync(f)) return f; }
  const lp = localPath(u); if (lp && fs.existsSync(lp)) return lp;
  if (/^https?:\/\//.test(u)) { if (!publicHost(u)) throw Object.assign(new Error("That address can't be used"), { code: 400 }); return (await download(u)).file; }
  throw Object.assign(new Error("Video not found"), { code: 404 });
}
async function duration(file) { const o = await run(FP(), ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], true); const d = parseFloat(o); if (!(d > 0)) throw new Error("Couldn't read the video length"); return d; }
// 4 frames of one chunk as a single 2×2 contact sheet (one picture per vision call)
async function sheet(file, s, e) { const d = Math.max(.5, e - s);
  for (const [w, q] of [[448, 5], [320, 8], [240, 12]]) { const tmp = path.join(os.tmpdir(), "vss-" + uid() + ".jpg");
    await run(FF(), ["-v", "error", "-y", "-ss", String(s), "-t", String(d), "-i", file, "-vf", `fps=${(4 / d).toFixed(4)},scale=${w}:-2,tile=2x2`, "-frames:v", "1", "-q:v", String(q), tmp]);
    const b = fs.readFileSync(tmp); fs.unlink(tmp, () => {}); const u = "data:image/jpeg;base64," + b.toString("base64"); if (u.length < 175000 || w === 240) return u; } }
const pickChunk = (dur, want) => { const c = +want > 0 ? +want : dur <= 30 ? 5 : dur <= 120 ? 10 : dur <= 600 ? 30 : 60; return Math.max(c, Math.ceil(dur / MAX_CHUNKS)); };

function langLine(lang) { return lang === "ar" ? "Write every text value in Arabic." : "Write every text value in English."; }
async function captionChunk(img, s, e, r, said) {
  const ev = (r.events || []).length ? `\nEvents to check (answer for each, even if absent): ${JSON.stringify(r.events)}` : "";
  const ob = (r.objects || []).length ? `\nObjects of interest: ${JSON.stringify(r.objects)}` : "";
  return visionJson(`The picture is a 2×2 contact sheet of 4 frames, in time order (left→right, top→bottom), from ${mmss(s)} to ${mmss(e)} of a video.${r.scenario ? "\nScenario: " + r.scenario : ""}${said ? "\nWhat is said in this part (speech-to-text): \"" + said + "\"" : ""}${ev}${ob}
Describe what happens in this part like a dense video caption: people (no names), actions, objects, place, text on screen, camera, changes between frames. Do not invent anything not visible.
Return {"caption":"2-4 sentences","objects":["visible objects"],"tags":["short search tags"],"events":[{"name":"event from the list","present":true|false,"confidence":0-1,"detail":"what shows it"}]}. ${langLine(r.lang)}`,
    { maxTokens: 900, tier: "quick", timeoutMs: 90000 });
}
async function aggregate(r) {
  const lines = r.chunks.map((c) => `[${mmss(c.s)}–${mmss(c.e)}] ${c.caption}${c.speech ? ` 🗣 "${c.speech.slice(0, 400)}"` : ""}${(c.events || []).filter((x) => x.present).map((x) => ` ⚑ ${x.name}: ${x.detail || ""}`).join("")}`).join("\n");
  return textJson(`These are time-stamped captions of a ${Math.round(r.dur)} s video${r.scenario ? " (" + r.scenario + ")" : ""}:\n${lines}\n${r.prompt ? "\nThe user wants: " + r.prompt + "\n" : ""}
Aggregate them. Return {"title":"short title","summary":"one clear paragraph","highlights":[{"t":seconds,"text":"key moment"}],"timeline":[{"s":seconds,"e":seconds,"text":"what happens"}],"alerts":[{"t":seconds,"event":"name","detail":"why"}],"report":"a short markdown report with headings: Overview, Key moments, Events, Notes"}. Use only facts from the captions. ${langLine(r.lang)}`,
    { maxTokens: 3500, tier: "default", timeoutMs: 120000 });
}
const fetchVss = async (p, body, ms) => { const c = vssCfg(); const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms || 600000);
  try { const r = await fetch(c.url + p, { method: "POST", signal: ctl.signal, headers: { "content-type": "application/json", ...(c.key ? { Authorization: "Bearer " + c.key } : {}) }, body: JSON.stringify(body) });
    const txt = await r.text(); let d; try { d = JSON.parse(txt); } catch { d = { raw: txt }; } if (!r.ok) throw new Error("VSS server " + r.status + ": " + (d.detail?.[0]?.msg || d.detail || d.message || txt.slice(0, 160))); return d; } finally { clearTimeout(t); } };
const absUrl = (u) => /^https?:/.test(u) ? u : (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "") + u;

async function analyse(uidv, r, staff) {
  const done = (msg) => { r.status = msg ? "failed" : "complete"; if (msg) r.error = msg; r.progress = 1; save(); };
  try {
    if (r.by === "vss") {        // a connected NVIDIA VSS server does the whole job
      const d = await fetchVss("/v1/summarize", { url: absUrl(r.src), model: vssCfg().model || undefined, prompt: r.prompt || undefined, chunk_duration: r.chunk || undefined, scenario: r.scenario || undefined, events: r.events?.length ? r.events : undefined, objects_of_interest: r.objects?.length ? r.objects : undefined, enable_qa: true, enable_audio: !!r.audio });
      const txt = d.choices?.[0]?.message?.content || ""; r.remote = d.video_id || d.id; r.summary = { title: r.title, summary: txt, highlights: [], timeline: [], alerts: [], report: txt }; r.chunks = []; return done();
    }
    const file = await sourceFile(r.src); r.dur = await duration(file); r.chunk = pickChunk(r.dur, r.chunk); const n = Math.ceil(r.dur / r.chunk); r.chunks = []; save();
    // the speech too (VSS "enable_audio"): one transcript from the localization tools, shared out over the parts
    let speech = []; if (r.audio && sttReady()) { try { if (!staff) charge(uidv, locPrice().stt * Math.max(1, Math.ceil(r.dur / 60)), "Video intelligence · speech"); const t = await transcribeFile(file, null); speech = t.lines || []; r.speechBy = t.by; } catch (e) { r.speechError = String(e.message || e).slice(0, 160); } }
    for (let i = 0; i < n; i++) {
      const s = i * r.chunk, e = Math.min(r.dur, s + r.chunk); if (e - s < .4) break;
      if (!staff) charge(uidv, VSS_PRICE.chunk, "Video intelligence · chunk");
      const said = speech.filter((l) => l.e > s && l.s < e).map((l) => l.text).join(" ").slice(0, 900);
      let c; try { c = await captionChunk(await sheet(file, s, e), s, e, r, said); } catch (err) { c = { caption: "", objects: [], tags: [], events: [], error: err.message }; }
      r.chunks.push({ s: +s.toFixed(2), e: +e.toFixed(2), caption: String(c.caption || "").slice(0, 900), speech: said, objects: (c.objects || []).slice(0, 20).map(String), tags: (c.tags || []).slice(0, 15).map(String), events: (c.events || []).slice(0, 12).map((x) => ({ name: String(x.name || ""), present: x.present === true || +x.confidence >= .6, confidence: +(+x.confidence || 0).toFixed(2), detail: String(x.detail || "").slice(0, 200) })) });
      r.progress = +((i + 1) / (n + 1)).toFixed(3); save();
    }
    if (!r.chunks.some((c) => c.caption)) return done("The vision AI couldn't read this video");
    if (!staff) charge(uidv, VSS_PRICE.summary, "Video intelligence · summary");
    let a; try { a = await aggregate(r); } catch (e) { const cs = r.chunks.filter((c) => c.caption);
      a = { title: r.title, summary: cs.slice(0, 4).map((c) => c.caption).join(" "), highlights: cs.slice(0, 8).map((c) => ({ t: c.s, text: c.caption.split(/[.!?]/)[0] })), timeline: cs.map((c) => ({ s: c.s, e: c.e, text: c.caption })),
        alerts: r.chunks.flatMap((c) => (c.events || []).filter((x) => x.present).map((x) => ({ t: c.s, event: x.name, detail: x.detail }))), report: cs.map((c) => `- ${mmss(c.s)}–${mmss(c.e)} ${c.caption}`).join("\n") }; } r.summary = { title: String(a.title || r.title).slice(0, 80), summary: String(a.summary || ""), highlights: (a.highlights || []).slice(0, 12), timeline: (a.timeline || []).slice(0, 30), alerts: (a.alerts || []).slice(0, 30), report: String(a.report || "") };
    if (a.title) r.title = r.summary.title; done();
  } catch (e) { done(e.message); }
}

export function registerVss(app) {
  // 3D Studio: "find the car in my photo" → a box the on-device SAM turns into an exact cut-out (1 credit)
  // render review: one contact sheet (FRONT · SIDE · REAR views of a 3D model) → what's wrong, as codes the studio can fix (1 credit)
  app.post("/v1/vision/review", requireUser, async (req, res) => {
    try { if (!aiReady()) return res.status(501).json({ error: "Connect a vision AI in Admin → AI providers (NVIDIA AI, Claude or Qwen)" });
      const img = String(req.body?.image || ""), subject = String(req.body?.subject || "object").replace(/[^\p{L}\p{N} \-]/gu, "").slice(0, 60) || "object", cat = String(req.body?.category || "object").replace(/[^a-z]/g, "").slice(0, 20);
      if (!img.startsWith("data:image/") || img.length > 6e6) return res.status(400).json({ error: "Send a picture" });
      const video = req.body?.mode === "video", brief = String(req.body?.brief || "").slice(0, 400);
      charge(req.user.uid, VSS_PRICE.verify, (video ? "AI review · video " : "AI review · 3D ") + subject);
      const CODES = video ? ["black_frames", "frozen", "text_cut_off", "wrong_aspect", "visual_glitch", "off_brief", "wrong_order", "other"] : ["front_on_back", "faces_backwards", "floating", "sunken", "wrong_scale", "broken_shape", "missing_parts", "wrong_colors", "other"];
      const r = await visionJson(video ? `You are a strict video editor checking a finished render before it is delivered. The picture is a contact sheet of frames in time order (left→right, top→bottom), each labelled with its time.${brief ? ` The brief: "${brief}".` : ""}
Look for real problems only: black or empty frames, a picture that stops moving, text cut off at the edges, the wrong aspect (stretched, letterboxed by mistake), glitches or broken frames, scenes in an order that doesn't make sense, or a result that doesn't match the brief.
Return {"ok":true|false,"issues":[{"code":one of ${JSON.stringify(CODES)},"view":"time of the frame or empty","note":"one short sentence"}],"summary":"one sentence"}. Empty "issues" when it is fine.`
        : `You are a strict 3D artist checking a render of a 3D model of a ${subject} (${cat}). The picture has three labelled views of the same model: FRONT, SIDE and REAR.
Check that it makes physical sense: the front is only at the front (a car's grille and headlights must not appear on its back), it stands on the ground (not floating or sunk), its proportions are plausible, the shape is not broken, no big parts are missing, and its colours are consistent.
Return {"ok":true|false,"issues":[{"code":one of ${JSON.stringify(CODES)},"view":"front"|"side"|"rear","note":"one short sentence"}],"summary":"one sentence"}. Empty "issues" when it looks right.`, img, { maxTokens: 600, tier: "quick", timeoutMs: 90000 });
      const issues = (Array.isArray(r && r.issues) ? r.issues : []).filter((i) => i && CODES.includes(i.code)).slice(0, 8).map((i) => ({ code: i.code, view: String(i.view || "").slice(0, 12), note: String(i.note || "").slice(0, 200) }));
      res.json({ ok: !!(r && r.ok !== false) && !issues.length, issues, summary: String((r && (r.summary || r.caption)) || "").slice(0, 300) });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });
  app.post("/v1/vision/locate", requireUser, async (req, res) => {
    try { if (!aiReady()) return res.status(501).json({ error: "Connect a vision AI in Admin → AI providers (NVIDIA AI, Claude or Qwen)" });
      const img = String(req.body?.image || ""), label = String(req.body?.label || "main object").replace(/[^\p{L}\p{N} \-]/gu, "").slice(0, 60) || "main object";
      if (!img.startsWith("data:image/") || img.length > 6e6) return res.status(400).json({ error: "Send a picture" });
      charge(req.user.uid, VSS_PRICE.verify, "AI vision · find " + label);
      const r = await visionJson(`Find the ${label} in the picture. Return {"found":true|false,"box":[x0,y0,x1,y1]} where the box tightly surrounds the ${label}, given as fractions of the picture's width and height (0 to 1, x0<x1, y0<y1).`, img, { maxTokens: 300, tier: "quick", timeoutMs: 60000 });
      let b = r && Array.isArray(r.box) && r.box.length === 4 && r.box.every((v) => typeof v === "number" && isFinite(v)) ? r.box : null;
      if (b && b.some((v) => v > 1)) b = b.map((v) => v / (Math.max(...b) > 1000 ? Math.max(...b) : 1000)); // some models answer in 0–1000
      if (b) b = b.map((v) => Math.min(1, Math.max(0, +v.toFixed(4))));
      res.json({ found: !!(b && r.found !== false && b[2] > b[0] && b[3] > b[1]), box: b });
    } catch (e) { res.status(502).json({ error: e.message }); }
  });
  app.get("/v1/vss", requireUser, (req, res) => res.json({ items: Object.values(recs(req.user.uid)).sort((a, b) => b.created - a.created).map(pub), server: vssServer(), ai: aiReady(), nvidia: nvReady(), price: VSS_PRICE }));
  app.get("/v1/vss/:id", requireUser, (req, res) => { const r = recs(req.user.uid)[req.params.id]; r ? res.json(pub(r)) : res.status(404).json({ error: "Not found" }); });
  app.delete("/v1/vss/:id", requireUser, (req, res) => { delete recs(req.user.uid)[req.params.id]; save(); res.json({ ok: true }); });
  app.post("/v1/vss", requireUser, (req, res) => {
    const b = req.body || {}, by = vssServer() && b.engine !== "nooi" ? "vss" : "nooi";
    if (by === "nooi" && !aiReady()) return res.status(501).json({ error: "Connect a vision AI in Admin → AI providers (NVIDIA AI, Claude or Qwen) to analyse videos" });
    if (!b.src) return res.status(400).json({ error: "Pick a video first" });
    const all = recs(req.user.uid), keys = Object.keys(all).sort((x, y) => all[x].created - all[y].created); while (keys.length >= 60) delete all[keys.shift()];
    const list = (v) => (Array.isArray(v) ? v : String(v || "").split(/[,،\n]/)).map((x) => String(x).trim()).filter(Boolean).slice(0, 12);
    const r = { id: uid(), title: String(b.title || "Video").slice(0, 80), src: String(b.src), job: b.job || null, status: "running", progress: 0, created: Date.now(), by, chunk: +b.chunk || 0,
      scenario: String(b.scenario || "").slice(0, 300), prompt: String(b.prompt || "").slice(0, 600), events: list(b.events), objects: list(b.objects), lang: b.lang === "ar" ? "ar" : "en", audio: !!b.audio, chat: [] };
    all[r.id] = r; save(); analyse(req.user.uid, r, isStaff(req.user)); res.json(pub(r));
  });
  // Q&A over one video
  app.post("/v1/vss/:id/ask", requireUser, async (req, res) => {
    try { const r = recs(req.user.uid)[req.params.id]; if (!r || r.status !== "complete") return res.status(404).json({ error: "Analyse the video first" });
      const q = String(req.body?.q || "").trim().slice(0, 500); if (!q) return res.status(400).json({ error: "Ask a question" });
      if (!isStaff(req.user)) charge(req.user.uid, VSS_PRICE.ask, "Video intelligence · question");
      let ans;
      if (r.by === "vss") { const d = await fetchVss("/v1/chat/completions", { id: r.remote, model: vssCfg().model || undefined, messages: [...(r.chat || []).slice(-6).flatMap((m) => [{ role: "user", content: m.q }, { role: "assistant", content: m.a }]), { role: "user", content: q }] }, 180000); ans = { answer: d.choices?.[0]?.message?.content || "", moments: [] }; }
      else { const top = r.chunks.map((c) => [score(q, chunkText(c)), c]).sort((a, b) => b[0] - a[0]).slice(0, 10).map((x) => x[1]).sort((a, b) => a.s - b.s);
        const ctx = (top.length < r.chunks.length ? top : r.chunks).map((c) => `[${mmss(c.s)}–${mmss(c.e)}] ${chunkText(c)}`).join("\n");
        const a = await textJson(`Video summary: ${r.summary?.summary || ""}\nCaptions:\n${ctx}\n\nEarlier questions: ${(r.chat || []).slice(-4).map((m) => "Q: " + m.q + " A: " + m.a).join(" | ") || "none"}\n\nQuestion: ${q}\nAnswer only from the captions; if they don't say, say so. Return {"answer":"…","moments":[{"t":seconds,"why":"…"}]}. ${langLine(/[؀-ۿ]/.test(q) ? "ar" : r.lang)}`, { maxTokens: 1200, tier: "quick", timeoutMs: 90000 });
        ans = { answer: String(a.answer || ""), moments: (a.moments || []).slice(0, 6).map((m) => ({ t: +m.t || 0, why: String(m.why || "") })) }; }
      r.chat = (r.chat || []).concat({ q, a: ans.answer, moments: ans.moments, t: Date.now() }).slice(-30); save(); res.json(ans);
    } catch (e) { res.status(e.code || 500).json({ error: e.message }); }
  });
  // natural-language search across every analysed video
  app.post("/v1/vss/search", requireUser, async (req, res) => {
    try { const q = String(req.body?.q || "").trim().slice(0, 300); if (!q) return res.status(400).json({ error: "Type what to find" });
      const all = Object.values(recs(req.user.uid)).filter((r) => r.status === "complete");
      let hits = all.flatMap((r) => (r.chunks || []).map((c) => ({ id: r.id, title: r.title, src: r.src, job: r.job, s: c.s, e: c.e, caption: c.caption, speech: c.speech || "", sc: score(q, chunkText(c)) })))
        .concat(all.filter((r) => r.by === "vss").map((r) => ({ id: r.id, title: r.title, src: r.src, job: r.job, s: 0, e: r.dur || 0, caption: (r.summary?.summary || "").slice(0, 400), sc: score(q, r.summary?.summary) })));
      hits.sort((a, b) => b.sc - a.sc); let pool = hits.slice(0, 30);
      if (aiReady() && pool.length) { if (!isStaff(req.user)) charge(req.user.uid, VSS_PRICE.search, "Video intelligence · search");
        try { const r = await textJson(`Search query: "${q}"\nCandidate video moments:\n${pool.map((h, i) => `${i}. ${h.title} [${mmss(h.s)}–${mmss(h.e)}] ${h.caption}${h.speech ? ` (said: "${h.speech.slice(0, 200)}")` : ""}`).join("\n")}\nPick the moments that really match the query (meaning, not just words), best first. Return {"matches":[{"i":index,"score":0-1,"why":"short"}]}.`, { maxTokens: 900, tier: "quick", timeoutMs: 60000 });
          const m = (r.matches || []).filter((x) => pool[x.i] && +x.score >= .35); pool = m.map((x) => ({ ...pool[x.i], sc: +(+x.score).toFixed(2), why: String(x.why || "") })); } catch { pool = pool.filter((h) => h.sc > 0); } }
      else pool = pool.filter((h) => h.sc > 0);
      res.json({ results: pool.slice(0, 20) });
    } catch (e) { res.status(e.code || 500).json({ error: e.message }); }
  });
  // alert verification (one clip) and live checks (one frame from a camera or a playing video)
  app.post("/v1/vss/verify", requireUser, async (req, res) => {
    try { if (!aiReady()) return res.status(501).json({ error: "Connect a vision AI first (Admin → AI providers: NVIDIA AI, Claude or Qwen)" });
      const b = req.body || {}, alert = String(b.alert || "").trim().slice(0, 200); if (!alert) return res.status(400).json({ error: "Describe the alert" });
      let img;
      if (b.frame && /^data:image\/(jpeg|png|webp);base64,/.test(b.frame) && b.frame.length < 4e6) img = b.frame;
      else { const file = await sourceFile(b.src); const d = await duration(file), s = Math.max(0, Math.min(d - .5, +b.s || 0)), e = Math.min(d, Math.max(s + .5, +b.e || s + 6)); img = await sheet(file, s, e); }
      if (!isStaff(req.user)) charge(req.user.uid, b.frame ? VSS_PRICE.watch : VSS_PRICE.verify, "Video intelligence · " + (b.frame ? "live check" : "alert check"));
      const r = await visionJson(`${b.frame ? "This is one live frame from a camera or video." : "The picture is a 2×2 contact sheet of 4 frames in time order from one short clip."}\nAlert to verify: "${alert}".\nIs the alert really happening in the picture? Be strict: false alarms are costly. Return {"verdict":"confirmed"|"rejected"|"unsure","confidence":0-1,"reason":"one sentence","seen":"what is visible"}. ${langLine(/[؀-ۿ]/.test(alert) ? "ar" : "en")}`, { maxTokens: 500, tier: "quick", timeoutMs: 60000 });
      if (r.plain) { const t = (r.reason || "").toLowerCase(); r.verdict = /^\s*(yes|true|confirmed)/.test(t) ? "confirmed" : /^\s*(no|false|rejected)/.test(t) ? "rejected" : "unsure"; }
      res.json({ verdict: ["confirmed", "rejected", "unsure"].includes(r.verdict) ? r.verdict : "unsure", confidence: +(+r.confidence || 0).toFixed(2), reason: String(r.reason || ""), seen: String(r.seen || "") });
    } catch (e) { res.status(e.code || 500).json({ error: e.message }); }
  });
}
