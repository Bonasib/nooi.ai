// NVIDIA AI (build.nvidia.com / NVIDIA API catalog, key "nvapi-…") across the studio:
//   text & vision → integrate.api.nvidia.com/v1/chat/completions (OpenAI format; reasoning models get a thinking budget)
//   images        → FLUX.1 / Stable Diffusion 3.5 "genai" endpoints (ai.api.nvidia.com/v1/genai/<org>/<model>)
//   image edits   → FLUX.1 Kontext (picture + instruction)
//   3D            → Microsoft TRELLIS (picture or words → textured .glb)
//   video         → NVIDIA Cosmos 3 Nano (words or a first frame → clip; v176 — Cosmos Predict 1 was retired by NVIDIA)
// Every endpoint and model id can be changed in Admin → AI providers → NVIDIA AI (`cfg("nvidia")`), and each capability can be
// switched on or off ("use"). Picture / 3D / video jobs that fail on NVIDIA fall back to the site's other engine (lib/jobs.js).
// NVIDIA answers synchronously (200 + JSON with base64) or, for long jobs, 202 + NVCF-REQID → poll the NVCF status URL.
import zlib from "zlib";
import { cfg, S } from "../lib/settings.js";
import { save } from "../lib/store.js";
import { saveBuffer } from "../lib/media.js";

const DEF = {
  chat: "https://integrate.api.nvidia.com/v1", vision: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", text: "nvidia/nemotron-3-super-120b-a12b",
  image: "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev", image2: "https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-3_5-large",
  edit: "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev", trellis: "https://ai.api.nvidia.com/v1/genai/microsoft/trellis",
  video: "https://ai.api.nvidia.com/v1/cosmos/nvidia/cosmos3-nano", status: "https://api.nvcf.nvidia.com/v2/nvcf/pexec/status/", assets: "https://api.nvcf.nvidia.com/v2/nvcf/assets"
};
// what NVIDIA runs by default when the key is saved (video stays opt-in: Cosmos is made for physical-world clips, not ads)
const USE_DEFAULT = { text: true, vision: true, image: true, edit: true, "3d": true, video: false };
// v176: NVIDIA retired Cosmos Predict 1 / Cosmos 1.0 (their hosted endpoints answer 404) — a Video URL saved in Admin for one of them
// is read as the new default, Cosmos 3 Nano
const RETIRED176 = /cosmos-predict1|cosmos-1\.0-/i;
const videoUrl176 = (c) => (c.videoUrl && !RETIRED176.test(c.videoUrl) ? c.videoUrl : DEF.video);
export const nvCfg = () => { const c = cfg("nvidia"); let use = {}; try { use = typeof c.use === "string" ? (c.use.trim().startsWith("{") ? JSON.parse(c.use) : Object.fromEntries(c.use.split(/[,;\s]+/).filter(Boolean).map((x) => x.split(":")).map(([k, v]) => [k.trim().toLowerCase(), !/^(off|no|false|0)$/i.test((v || "on").trim())]))) : c.use || {}; } catch { use = {}; }
  return { key: c.apiKey || "", chat: (c.baseUrl || DEF.chat).replace(/\/$/, ""), vision: c.model || DEF.vision, text: c.textModel || DEF.text,
    image: c.imageUrl || DEF.image, image2: c.image2Url || DEF.image2, edit: c.editUrl || DEF.edit, trellis: c.trellisUrl || DEF.trellis, video: videoUrl176(c), status: c.statusUrl || process.env.NVIDIA_STATUS_URL || DEF.status, assets: c.assetsUrl || process.env.NVIDIA_ASSETS_URL || DEF.assets, use: { ...USE_DEFAULT, ...use, ...off176(c) } }; };
// v173: NVIDIA said its video model isn't open to this key ("Function '…': Not found for account" — a model NVIDIA retired or
// the account can't run). Until the Video URL in Admin changes or a Cosmos video is made, nooi Auto doesn't pick it (a customer
// who picks it by hand gets NVIDIA's answer in plain words, nothing charged — no other engine instead).
// v176: the same for every NVIDIA engine — pictures (FLUX.1 "image", SD 3.5 "image2"), picture edits ("edit"), 3D ("3d") and
// video — marked by a job NVIDIA refused or by Admin's free check (nvCheck176), each for the URL it was refused at.
const down173 = () => { try { return S().nvDown173 || null; } catch { return null; } };
const fresh173 = (v) => !!v && Date.now() - (v.at || 0) < 6 * 3600e3;   // (asked again after 6 hours: NVIDIA may have opened it)
const TASKS176 = ["image", "image2", "edit", "3d", "video"];
const urlOf176 = (c, t) => (t === "image" ? c.imageUrl || DEF.image : t === "image2" ? c.image2Url || DEF.image2 : t === "edit" ? c.editUrl || DEF.edit : t === "3d" ? c.trellisUrl || DEF.trellis : videoUrl176(c));
// (a down picture engine turns off nooi Auto's pictures; a down edit engine its edits; 3D and video the same)
function off176(c) { const d = down173(); if (!d) return {}; const o = {};
  for (const t of TASKS176) if (fresh173(d[t]) && d[t].url === urlOf176(c, t)) o[t === "image2" ? "_image2" : t] = false; return o; }
function markDown173(task, url, err) { if (!TASKS176.includes(task)) return; try { const st = S(); st.nvDown173 = { ...(st.nvDown173 || {}), [task]: { url, at: Date.now(), error: String(err).slice(0, 200) } }; save(); } catch {} }
function clearDown173(task) { try { const st = S(); if (st.nvDown173 && st.nvDown173[task]) { delete st.nvDown173[task]; save(); } } catch {} }
// the "not open" mark of one NVIDIA engine (for its current URL), or null
export const nvDown176 = (task) => { const d = down173(); return d && fresh173(d[task]) && d[task].url === urlOf176(cfg("nvidia"), task) ? d[task] : null; };
export const nvVideoDown173 = () => nvDown176("video");
// v181: NVIDIA Cosmos 3 Super Image2Video (picture → video) on NVIDIA's own API, at the address saved in Admin as "Picture-to-video
// URL" (default below). Admin's free check tries it; it is used for a Cosmos video that starts from a picture only once NVIDIA has
// answered that this key can run it (an "open" mark, renewed by every check and every video made there) — never anyone else's server.
const I2V181 = "https://ai.api.nvidia.com/v1/cosmos/nvidia/cosmos3-super-image2video";
const i2vUrl181 = (c) => (c && c.i2vUrl) || I2V181;
const open181 = () => { try { return S().nvOpen181 || {}; } catch { return {}; } };
function markOpen181(url) { try { const st = S(); st.nvOpen181 = { i2v: { url, at: Date.now() } }; save(); } catch {} }
function clearOpen181() { try { const st = S(); if (st.nvOpen181) { delete st.nvOpen181; save(); } } catch {} }
export const nvI2v181 = () => { if (!nvReady()) return null; const o = open181().i2v, u = i2vUrl181(cfg("nvidia")); return o && o.url === u && Date.now() - (o.at || 0) < 12 * 3600e3 ? u : null; };
// the NVIDIA engine a site model runs on, and its name for messages
export const NV_TASK176 = { nvcosmos: "video", nvflux: "image", nvsd35: "image2", nvkontext: "edit" };
export const NV_NAME176 = { nvcosmos: "NVIDIA Cosmos", nvflux: "NVIDIA FLUX.1", nvsd35: "NVIDIA SD 3.5", nvkontext: "NVIDIA FLUX Kontext", "3d": "NVIDIA TRELLIS" };
const NOTFOUND173 = /\b404\b[\s\S]*not found for account|Function '[^']+': Not found|NVIDIA AI 410\b|NVIDIA AI 404: 404 page not found/i;
export const nvReady = () => !!nvCfg().key;
export const nvOn = (what) => { const c = nvCfg(); return !!c.key && c.use[what] !== false && c.use[what] !== "false"; };
export const NV_MODELS = { image: ["nvflux", "nvsd35"], edit: ["nvkontext"], video: ["nvcosmos"] };

const hdr = (accept) => ({ Authorization: "Bearer " + nvCfg().key, Accept: accept || "application/json", "content-type": "application/json" });
async function call(url, body, ms = 120000, extra) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { method: "POST", signal: ctl.signal, headers: { ...hdr(), ...(extra || {}) }, body: JSON.stringify(body) });
    if (r.status === 202) { const id = r.headers.get("nvcf-reqid") || r.headers.get("NVCF-REQID"); if (!id) throw new Error("NVIDIA AI accepted the job without a request id"); return { pending: id }; }
    return await read(r);
  } finally { clearTimeout(t); } }
async function read(r) {
  const type = r.headers.get("content-type") || "", buf = Buffer.from(await r.arrayBuffer());
  if (!r.ok) { let d = {}; try { d = JSON.parse(buf.toString()); } catch {} const e = new Error("NVIDIA AI " + r.status + ": " + (d.detail || d.title || d.error?.message || d.message || buf.toString().slice(0, 160))); e.status = r.status; if (r.status === 401 || r.status === 403) e.noFallback = false; throw e; }
  if (/json/.test(type) || buf[0] === 0x7b) return { json: JSON.parse(buf.toString()) };
  return { bin: buf, type };
}
async function status(id) { const r = await fetch(nvCfg().status + id, { headers: hdr() }); if (r.status === 202) return { pending: id }; return read(r); }
// the first base64 payload in any of NVIDIA's response shapes
function b64Of(d) { if (!d || typeof d !== "object") return null;
  const a = d.artifacts?.[0]; if (a) { if (a.finishReason && /CONTENT_FILTERED|ERROR/i.test(a.finishReason)) throw Object.assign(new Error("NVIDIA AI blocked this request (" + a.finishReason + ")"), { noFallback: true }); if (a.base64) return a.base64; }
  for (const k of ["image", "b64_image", "b64_json", "b64_video", "video", "glb", "data", "output"]) { const v = d[k]; if (typeof v === "string" && v.length > 24) { const x = v.replace(/^data:[^,]+,/, ""); if (/^[A-Za-z0-9+/=\r\n]+$/.test(x.slice(0, 400))) return x; } if (Array.isArray(v) && v[0]) { const x = b64Of(v[0]); if (x) return x; } if (v && typeof v === "object") { const x = b64Of(v); if (x) return x; } }
  return null; }
// NVCF can return a zip of the outputs: take the first file with the wanted extension
function unzipFirst(buf, ext) { let i = 0; while (i + 30 < buf.length && buf.readUInt32LE(i) === 0x04034b50) {
  const method = buf.readUInt16LE(i + 8), csize = buf.readUInt32LE(i + 18), nlen = buf.readUInt16LE(i + 26), xlen = buf.readUInt16LE(i + 28), name = buf.slice(i + 30, i + 30 + nlen).toString(), s = i + 30 + nlen + xlen, data = buf.slice(s, s + csize);
  if (name.toLowerCase().endsWith(ext)) return method === 8 ? zlib.inflateRawSync(data) : data; i = s + csize; } return null; }
function payload(res, ext) { if (res.bin) { if (res.bin[0] === 0x50 && res.bin[1] === 0x4b) { const f = unzipFirst(res.bin, ext); if (f) return f; const j = unzipFirst(res.bin, ".json"); if (j) return payload({ json: JSON.parse(j.toString()) }, ext); throw new Error("NVIDIA AI returned an archive without a " + ext + " file"); } return res.bin; }
  const b = b64Of(res.json); if (!b) throw new Error("NVIDIA AI returned no " + ext.slice(1) + " (" + Object.keys(res.json || {}).join(", ").slice(0, 80) + ")"); return Buffer.from(b, "base64"); }

// NVIDIA's hosted picture models (TRELLIS, FLUX Kontext, Cosmos) don't take a picture inline ("Expected: example_id, got: base64"):
// the picture is uploaded to the NVCF asset store first, then passed as "data:<type>;asset_id,<id>" + the NVCF-INPUT-ASSET-REFERENCES header.
export async function nvAsset(dataUrl) {
  const m = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl || ""); if (!m) throw new Error("NVIDIA AI needs a picture");
  const mime = /png|jpeg|jpg|webp/.test(m[1]) ? m[1].replace("jpg", "jpeg") : "image/png", buf = Buffer.from(m[2], "base64"), desc = "nooi-input";
  const r = await fetch(nvCfg().assets, { method: "POST", headers: hdr(), body: JSON.stringify({ contentType: mime, description: desc }) });
  const d = (await read(r)).json || {}; if (!d.uploadUrl || !d.assetId) throw new Error("NVIDIA AI asset upload gave no upload URL");
  const u = await fetch(d.uploadUrl, { method: "PUT", headers: { "Content-Type": mime, "x-amz-meta-nvcf-asset-description": desc }, body: buf });
  if (!u.ok) throw new Error("NVIDIA AI asset upload failed (" + u.status + ")");
  return { ref: `data:${mime};asset_id,${d.assetId}`, headers: { "NVCF-INPUT-ASSET-REFERENCES": d.assetId } };
}

// ── text & vision ─────────────────────────────────────────────
export async function nvChat(prompt, { image, images, system, maxTokens = 1500, timeoutMs = 120000, vision } = {}) {
  const c = nvCfg(), vlm = /\/vlm\//.test(c.chat), url = vlm ? c.chat : c.chat + "/chat/completions", imgs = images || (image ? [image] : []);
  const model = vlm ? null : imgs.length || vision ? c.vision : c.text, reasoning = /reason|thinking|-r1\b/i.test(model || "");
  const content = imgs.length ? [{ type: "text", text: prompt }, ...imgs.map((u) => ({ type: "image_url", image_url: { url: u } }))] : prompt;
  const body = { messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content }], max_tokens: reasoning ? maxTokens + 3072 : maxTokens, temperature: reasoning ? 0.6 : 0.3, top_p: reasoning ? 0.95 : 0.9, stream: false, ...(model ? { model } : {}), ...(reasoning ? { reasoning_budget: 2048 } : {}) };
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeoutMs);
  try { const r = await fetch(url, { method: "POST", signal: ctl.signal, headers: hdr(), body: JSON.stringify(body) });
    const txt = await r.text(); let d; try { d = JSON.parse(txt); } catch { d = {}; }
    if (!r.ok) throw new Error("NVIDIA AI " + r.status + ": " + (d.detail || d.title || d.error?.message || txt.slice(0, 160)));
    const m = d.choices?.[0]?.message || {}; let out = String(m.content || "").replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*<\/think>/i, "").trim();
    if (!out && m.reasoning_content) out = String(m.reasoning_content).trim(); if (!out) throw new Error("NVIDIA AI returned no text"); return out;
  } finally { clearTimeout(t); } }

// ── pictures, edits, 3D, video ────────────────────────────────
const SIZES = { "1:1": [1024, 1024], "16:9": [1344, 768], "9:16": [768, 1344], "4:3": [1152, 896], "3:4": [896, 1152], "3:2": [1216, 832], "2:3": [832, 1216], "4:5": [896, 1120], "5:4": [1120, 896], "21:9": [1536, 640] };
const toDataUrl = async (u) => { if (!u) return null; if (u.startsWith("data:")) return u; const r = await fetch(u); if (!r.ok) throw new Error("Couldn't read the reference picture"); const b = Buffer.from(await r.arrayBuffer()); return "data:" + (r.headers.get("content-type") || "image/png").split(";")[0] + ";base64," + b.toString("base64"); };
const fullPrompt = (p) => [p.prompt, p.character && `Main character: ${p.character.description}`, ...(p.meta?.refs || []).map((r) => `${r.type}: ${r.description}`), !p.meta?.words96 && p.meta?.style && `Style: ${p.meta.style}`].filter(Boolean).join("\n").slice(0, 2000);
const refOf = (p) => { const i = p.inputs || {}; return i.iRef || i.skImg || i.chRef || i.eRef || i.dmIn || i.s3dImg || i.s3dCap || i.frame || null; };
function imageBody(url, p) { const [w, h] = SIZES[p.aspect] || SIZES["1:1"], seed = Math.abs(+p.seed || 0) % 4294967295;
  if (/stable-diffusion-xl|sdxl/i.test(url)) return { text_prompts: [{ text: fullPrompt(p), weight: 1 }], width: w, height: h, cfg_scale: 5, sampler: "K_DPM_2_ANCESTRAL", seed, steps: 30 };
  if (/stable-diffusion-3/i.test(url)) return { prompt: fullPrompt(p), negative_prompt: p.meta?.neg || "", aspect_ratio: SIZES[p.aspect] ? p.aspect : "1:1", cfg_scale: 5, seed, steps: 40 };
  return { prompt: fullPrompt(p), mode: "base", cfg_scale: 3.5, width: w, height: h, seed, steps: 30 }; }
// one adapter per task, same interface as the other engines: submit → { done, url } or { remoteId }, poll → status
// v176: Cosmos 3 (cosmos3-nano / -super / -edge — NVIDIA's Cosmos 3 NIM API): model_mode text2video, or image2video with the first
// frame as a data URL in input_reference; resolution as a preset ("720_16_9", "720_9_16", "720_1_1", "720_4_3", "720_3_4"), 25–197
// frames at 720p, fps, seed; the answer is b64_video. (Cosmos Predict 1 — the old body with video_params — for a URL still on it.)
const RES176 = { "16:9": "720_16_9", "21:9": "720_16_9", "9:16": "720_9_16", "1:1": "720_1_1", "4:3": "720_4_3", "5:4": "720_4_3", "3:2": "720_4_3", "3:4": "720_3_4", "4:5": "720_3_4", "2:3": "720_3_4" };
export const COSMOS3_176 = /\/cosmos3[-_]/i;
export function cosmos3Body176(p, ref) {
  return { model_mode: ref ? "image2video" : "text2video", prompt: fullPrompt(p), ...(ref ? { input_reference: ref } : {}), resolution: RES176[p.aspect] || "720_16_9",
    num_frames: Math.max(25, Math.min(197, Math.round((+p.dur || 5) * 24) + 1)), fps: 24, seed: Math.abs(+p.seed || 0) % 4294967295 }; }
// Cosmos 3 sends VP9 in MP4 — not every phone plays it (iPhones): made H.264 here (the sound kept), or kept as it came if that fails
async function h264_176(buf) {
  const fs = await import("fs"), os = await import("os"), path = await import("path"), { spawn } = await import("child_process");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-nv176-")), a = path.join(dir, "in.mp4"), b = path.join(dir, "out.mp4");
  try { fs.writeFileSync(a, buf);
    await new Promise((ok, bad) => { const pr = spawn(process.env.FFMPEG_PATH || "ffmpeg", ["-v", "error", "-y", "-i", a, "-map", "0:v:0", "-map", "0:a:0?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", b]);
      let err = ""; pr.stderr.on("data", (d) => (err += d)); const t = setTimeout(() => pr.kill("SIGKILL"), 180000); pr.on("error", bad); pr.on("close", (code) => { clearTimeout(t); code === 0 ? ok() : bad(new Error(err.slice(0, 200) || "ffmpeg " + code)); }); });
    return fs.readFileSync(b);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); } }
const VP9_176 = Buffer.from("vp09");
// one adapter per task, same interface as the other engines: submit → { done, url } or { remoteId }, poll → status
export function nvAdapter(task) {
  const c = nvCfg(), ext = task === "3d" ? ".glb" : task === "video" ? ".mp4" : ".jpg";
  const finish = async (res) => { let buf = payload(res, ext); if (task === "video" && buf.indexOf(VP9_176) >= 0) buf = await h264_176(buf).catch((e) => { console.warn("NVIDIA video kept as VP9:", e.message); return buf; });
    const kind = ext === ".jpg" && buf[0] === 0x89 ? ".png" : ext; return { done: true, url: saveBuffer(buf, kind).url }; };
  const keyOf = (p) => (task === "image" && p && p.model === "nvsd35" ? "image2" : task);
  return { name: "NVIDIA AI", configured: !!c.key,
    async submit(p) { const k = keyOf(p), ctx = {}; try { const r = await this.submit0(p, ctx); if (r.done) { if (ctx.i2v) markOpen181(ctx.i2v); else clearDown173(k); } return r; }
      catch (e) { if (ctx.i2v && NOTFOUND173.test(e.message || "")) { clearOpen181(); e.type = "input"; e.retryable = false;   // (v181: Cosmos 3 Super closed again)
          e.message += " — this NVIDIA key can't run Cosmos 3 Super Image2Video at " + ctx.i2v + " any more. Press Check NVIDIA engines in Admin.";
          e.userMsg = "NVIDIA Cosmos isn't open to this site right now — nothing was charged. Pick another engine or nooi Auto."; e.userMsgAr = "NVIDIA Cosmos غير متاح لهذا الموقع الآن — لم يُخصم شيء. اختر محركاً آخر أو nooi تلقائي."; throw e; }
        if (NOTFOUND173.test(e.message || "")) { const url = urlOf176(cfg("nvidia"), k), nm = NV_NAME176[p?.model] || NV_NAME176[{ video: "nvcosmos", image: "nvflux", image2: "nvsd35", edit: "nvkontext" }[k]] || NV_NAME176["3d"];
          markDown173(k, url, e.message); e.type = "input"; e.retryable = false;   // (kept as it is through the retry wrapper: no retry, its own words)
          e.message += " — this NVIDIA key can't run the model at " + url + ". Set Admin → AI providers → NVIDIA AI → " + (k === "video" ? "Video URL" : "its URL") + " to a model the key can run (build.nvidia.com), or press Check NVIDIA engines.";
          e.userMsg = nm + " isn't open to this site right now — nothing was charged. Pick another engine or nooi Auto."; e.userMsgAr = nm + " غير متاح لهذا الموقع الآن — لم يُخصم شيء. اختر محركاً آخر أو nooi تلقائي."; }
        throw e; } },
    async submit0(p, ctx) { let res;
      if (task === "image") { const url = p.model === "nvsd35" ? c.image2 : c.image; res = await call(url, imageBody(url, p)); }
      else if (task === "edit") { const ref = await toDataUrl(refOf(p)); if (!ref) throw new Error("Add the picture to edit"); const a = await nvAsset(ref);
        res = await call(c.edit, { prompt: fullPrompt(p), image: a.ref, aspect_ratio: p.meta?.world360 || p.meta?.keepAspect === false ? (SIZES[p.aspect] ? p.aspect : "16:9") : "match_input_image", cfg_scale: 3.5, steps: 30, seed: Math.abs(+p.seed || 0) % 4294967295 }, 180000, a.headers); }
      else if (task === "3d") { const ref = await toDataUrl(refOf(p)); const a = ref ? await nvAsset(ref) : null;
        res = await call(c.trellis, a ? { mode: "image", image: a.ref, output_format: "glb", seed: 0, ss_sampling_steps: 25, slat_sampling_steps: 25, ss_cfg_strength: 7.5, slat_cfg_strength: 3 } : { mode: "text", prompt: fullPrompt(p), output_format: "glb", seed: 0, ss_sampling_steps: 25, slat_sampling_steps: 25 }, 300000, a?.headers); }
      else if (task === "video" && (COSMOS3_176.test(c.video) || ((p.inputs?.startImage || p.inputs?.vStart) && nvI2v181()))) { const ref = await toDataUrl(p.inputs?.startImage || p.inputs?.vStart), i2v = ref ? nvI2v181() : null;
        if (ctx) ctx.i2v = i2v; res = await call(i2v || c.video, cosmos3Body176(p, ref), 900000); if (i2v && res.pending) res.pending = "i2v181:" + res.pending; }
      else if (task === "video") { const ref = await toDataUrl(p.inputs?.startImage || p.inputs?.vStart); const a = ref ? await nvAsset(ref) : null; res = await call(c.video, { prompt: fullPrompt(p), seed: Math.abs(+p.seed || 0) % 4294967295, ...(a ? { image: a.ref } : {}), video_params: { height: p.aspect === "9:16" ? 1280 : 704, width: p.aspect === "9:16" ? 704 : 1280, frames_count: 121, frames_per_sec: 24 } }, 600000, a?.headers); }
      else throw new Error("Unknown NVIDIA task " + task);
      return res.pending ? { remoteId: res.pending } : await finish(res); },
    async poll(id0) { const i2v = /^i2v181:/.test(String(id0)), id = String(id0).replace(/^i2v181:/, ""); const res = await status(id); if (res.pending) return { status: "rendering" };
      try { const u = (await finish(res)).url; if (i2v) { const x = nvI2v181(); if (x) markOpen181(x); } else clearDown173(task); return { status: "done", url: u }; } catch (e) { return { status: "failed", error: e.message }; } } }; }

// v176: Admin → Check NVIDIA engines — each NVIDIA engine this site uses is sent an empty request: NVIDIA answers 400 / 422 (it
// wants a prompt) when the key can run it, 404 when it can't ("Not found for account", a retired model), 401 / 403 when the key is
// refused. Nothing is made, so nothing is spent. Engines found closed are marked (nooi Auto leaves them; picked by hand they're
// refused at once with a plain message); open ones lose an old mark. Cosmos 3 Super is checked too, as another video engine.
export async function nvCheck176() {
  const raw = cfg("nvidia"), c = nvCfg(); if (!c.key) return { ok: false, error: "No NVIDIA key saved" };
  const rows = [["video", "NVIDIA Cosmos (video)", urlOf176(raw, "video")], ["image", "NVIDIA FLUX.1 (pictures)", urlOf176(raw, "image")], ["image2", "NVIDIA SD 3.5 (pictures)", urlOf176(raw, "image2")],
    ["edit", "NVIDIA FLUX Kontext (picture edits)", urlOf176(raw, "edit")], ["3d", "NVIDIA TRELLIS (3D)", urlOf176(raw, "3d")]];
  // (v177: other Cosmos 3 addresses on the same host — NVIDIA's own pages disagree about the hosted path, and an address that
  // doesn't exist answers a bare "404 page not found" — the first one that answers is offered)
  const vu = urlOf176(raw, "video"), base = /\/cosmos3-nano$/.test(vu) ? vu : DEF.video;
  for (const [t, label, u] of [["video-super", "NVIDIA Cosmos 3 Super (video)", base.replace(/cosmos3-nano$/, "cosmos3-super")], ["video-edge", "NVIDIA Cosmos 3 Edge (video)", base.replace(/cosmos3-nano$/, "cosmos3-edge")],
    ["video-genai", "NVIDIA Cosmos 3 Nano · another address (video)", base.replace("/v1/cosmos/", "/v1/genai/")]]) if (u !== vu) rows.push([t, label, u]);
  rows.push(["i2v", "NVIDIA Cosmos 3 Super Image2Video (picture to video)", i2vUrl181(raw)]);   // (v181)
  const one = async ([task, label, url]) => { const t0 = Date.now(), ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 20000);
    try { const r = await fetch(url, { method: "POST", signal: ctl.signal, headers: hdr(), body: "{}" }), txt = (await r.text()).slice(0, 400), st = r.status;
      const state = st === 400 || st === 422 || st === 429 || (st >= 200 && st < 300) ? "open" : st === 404 || st === 410 ? "closed" : st === 401 || st === 403 ? "key" : st === 402 ? "credits" : "error";
      if (TASKS176.includes(task)) { if (state === "open") clearDown173(task); else if (state === "closed") markDown173(task, url, "NVIDIA AI " + st + ": " + txt); }
      if (task === "i2v") { if (state === "open") markOpen181(url); else if (state === "closed" || state === "key") clearOpen181(); }
      return { task, label, url, state, status: st, ms: Date.now() - t0, note: state === "open" ? "" : txt.replace(/\s+/g, " ").slice(0, 200) };
    } catch (e) { return { task, label, url, state: "unreachable", status: 0, ms: Date.now() - t0, note: e.name === "AbortError" ? "Timed out" : String(e.message).slice(0, 160) }; }
    finally { clearTimeout(to); } };
  const out = await Promise.all(rows.map(one)), v = out.find((r) => r.task === "video"), a2 = out.find((r) => /^video-/.test(r.task) && r.state === "open");
  return { ok: true, at: Date.now(), engines: out, ...(v && v.state !== "open" && a2 ? { suggest: { videoUrl: a2.url, label: a2.label.replace(/ \(video\)$/, "") } } : {}) };
}
// which NVIDIA task (if any) runs this job: explicit NVIDIA models always; "nooi Auto" when that capability is switched on
export function nvRoute(cap, body) {
  if (!nvReady() || body.noNv) return null; const m = body.model || "", auto = !m || m === "auto" || m === "dotimg";
  const hasRef = !!(body.inputs && (body.inputs.iRef || body.inputs.skImg || body.inputs.chRef || body.inputs.dmIn || body.inputs.eRef));
  if (cap === "image" && ["image", "look", "sheet"].includes(body.kind || "image")) {
    if (NV_MODELS.edit.includes(m) || (hasRef && (NV_MODELS.image.includes(m) || auto) && nvOn("edit"))) return "edit";
    if (NV_MODELS.image.includes(m) || (auto && !hasRef && nvOn("image"))) return "image"; return null; }
  if (cap === "edit" && nvOn("edit")) return "edit";
  if (cap === "sam3d" && body.kind === "3d" && body.meta?.mode !== "scene" && (body.meta?.engine === "trellis" || nvOn("3d"))) return "3d";
  if (cap === "video" && body.kind === "video" && (NV_MODELS.video.includes(m) || (auto && nvOn("video")))) return "video";
  return null; }
