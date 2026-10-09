// NVIDIA AI (build.nvidia.com / NVIDIA API catalog, key "nvapi-…") across the studio:
//   text & vision → integrate.api.nvidia.com/v1/chat/completions (OpenAI format; reasoning models get a thinking budget)
//   images        → FLUX.1 / Stable Diffusion 3.5 "genai" endpoints (ai.api.nvidia.com/v1/genai/<org>/<model>)
//   image edits   → FLUX.1 Kontext (picture + instruction)
//   3D            → Microsoft TRELLIS (picture or words → textured .glb)
//   video         → NVIDIA Cosmos (words or a first frame → clip)
// Every endpoint and model id can be changed in Admin → AI providers → NVIDIA AI (`cfg("nvidia")`), and each capability can be
// switched on or off ("use"). Picture / 3D / video jobs that fail on NVIDIA fall back to the site's other engine (lib/jobs.js).
// NVIDIA answers synchronously (200 + JSON with base64) or, for long jobs, 202 + NVCF-REQID → poll the NVCF status URL.
import zlib from "zlib";
import { cfg } from "../lib/settings.js";
import { saveBuffer } from "../lib/media.js";

const DEF = {
  chat: "https://integrate.api.nvidia.com/v1", vision: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", text: "nvidia/nemotron-3-super-120b-a12b",
  image: "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev", image2: "https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-3_5-large",
  edit: "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev", trellis: "https://ai.api.nvidia.com/v1/genai/microsoft/trellis",
  video: "https://ai.api.nvidia.com/v1/cosmos/nvidia/cosmos-predict1-7b", status: "https://api.nvcf.nvidia.com/v2/nvcf/pexec/status/", assets: "https://api.nvcf.nvidia.com/v2/nvcf/assets"
};
// what NVIDIA runs by default when the key is saved (video stays opt-in: Cosmos is made for physical-world clips, not ads)
const USE_DEFAULT = { text: true, vision: true, image: true, edit: true, "3d": true, video: false };
export const nvCfg = () => { const c = cfg("nvidia"); let use = {}; try { use = typeof c.use === "string" ? (c.use.trim().startsWith("{") ? JSON.parse(c.use) : Object.fromEntries(c.use.split(/[,;\s]+/).filter(Boolean).map((x) => x.split(":")).map(([k, v]) => [k.trim().toLowerCase(), !/^(off|no|false|0)$/i.test((v || "on").trim())]))) : c.use || {}; } catch { use = {}; }
  return { key: c.apiKey || "", chat: (c.baseUrl || DEF.chat).replace(/\/$/, ""), vision: c.model || DEF.vision, text: c.textModel || DEF.text,
    image: c.imageUrl || DEF.image, image2: c.image2Url || DEF.image2, edit: c.editUrl || DEF.edit, trellis: c.trellisUrl || DEF.trellis, video: c.videoUrl || DEF.video, status: c.statusUrl || process.env.NVIDIA_STATUS_URL || DEF.status, assets: c.assetsUrl || process.env.NVIDIA_ASSETS_URL || DEF.assets, use: { ...USE_DEFAULT, ...use } }; };
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
  for (const k of ["image", "b64_json", "b64_video", "video", "glb", "data", "output"]) { const v = d[k]; if (typeof v === "string" && v.length > 24) { const x = v.replace(/^data:[^,]+,/, ""); if (/^[A-Za-z0-9+/=\r\n]+$/.test(x.slice(0, 400))) return x; } if (Array.isArray(v) && v[0]) { const x = b64Of(v[0]); if (x) return x; } if (v && typeof v === "object") { const x = b64Of(v); if (x) return x; } }
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
const fullPrompt = (p) => [p.prompt, p.character && `Main character: ${p.character.description}`, ...(p.meta?.refs || []).map((r) => `${r.type}: ${r.description}`), p.meta?.style && `Style: ${p.meta.style}`].filter(Boolean).join("\n").slice(0, 2000);
const refOf = (p) => { const i = p.inputs || {}; return i.iRef || i.skImg || i.chRef || i.eRef || i.dmIn || i.s3dImg || i.s3dCap || i.frame || null; };
function imageBody(url, p) { const [w, h] = SIZES[p.aspect] || SIZES["1:1"], seed = Math.abs(+p.seed || 0) % 4294967295;
  if (/stable-diffusion-xl|sdxl/i.test(url)) return { text_prompts: [{ text: fullPrompt(p), weight: 1 }], width: w, height: h, cfg_scale: 5, sampler: "K_DPM_2_ANCESTRAL", seed, steps: 30 };
  if (/stable-diffusion-3/i.test(url)) return { prompt: fullPrompt(p), negative_prompt: p.meta?.neg || "", aspect_ratio: SIZES[p.aspect] ? p.aspect : "1:1", cfg_scale: 5, seed, steps: 40 };
  return { prompt: fullPrompt(p), mode: "base", cfg_scale: 3.5, width: w, height: h, seed, steps: 30 }; }
// one adapter per task, same interface as the other engines: submit → { done, url } or { remoteId }, poll → status
export function nvAdapter(task) {
  const c = nvCfg(), ext = task === "3d" ? ".glb" : task === "video" ? ".mp4" : ".jpg";
  const finish = (res) => { const buf = payload(res, ext); const kind = ext === ".jpg" && buf[0] === 0x89 ? ".png" : ext; return { done: true, url: saveBuffer(buf, kind).url }; };
  return { name: "NVIDIA AI", configured: !!c.key,
    async submit(p) { let res;
      if (task === "image") { const url = p.model === "nvsd35" ? c.image2 : c.image; res = await call(url, imageBody(url, p)); }
      else if (task === "edit") { const ref = await toDataUrl(refOf(p)); if (!ref) throw new Error("Add the picture to edit"); const a = await nvAsset(ref);
        res = await call(c.edit, { prompt: fullPrompt(p), image: a.ref, aspect_ratio: p.meta?.world360 || p.meta?.keepAspect === false ? (SIZES[p.aspect] ? p.aspect : "16:9") : "match_input_image", cfg_scale: 3.5, steps: 30, seed: Math.abs(+p.seed || 0) % 4294967295 }, 180000, a.headers); }
      else if (task === "3d") { const ref = await toDataUrl(refOf(p)); const a = ref ? await nvAsset(ref) : null;
        res = await call(c.trellis, a ? { mode: "image", image: a.ref, output_format: "glb", seed: 0, ss_sampling_steps: 25, slat_sampling_steps: 25, ss_cfg_strength: 7.5, slat_cfg_strength: 3 } : { mode: "text", prompt: fullPrompt(p), output_format: "glb", seed: 0, ss_sampling_steps: 25, slat_sampling_steps: 25 }, 300000, a?.headers); }
      else if (task === "video") { const ref = await toDataUrl(p.inputs?.startImage || p.inputs?.vStart); const a = ref ? await nvAsset(ref) : null; res = await call(c.video, { prompt: fullPrompt(p), seed: Math.abs(+p.seed || 0) % 4294967295, ...(a ? { image: a.ref } : {}), video_params: { height: p.aspect === "9:16" ? 1280 : 704, width: p.aspect === "9:16" ? 704 : 1280, frames_count: 121, frames_per_sec: 24 } }, 600000, a?.headers); }
      else throw new Error("Unknown NVIDIA task " + task);
      return res.pending ? { remoteId: res.pending } : finish(res); },
    async poll(id) { const res = await status(id); if (res.pending) return { status: "rendering" }; try { return { status: "done", url: finish(res).url }; } catch (e) { return { status: "failed", error: e.message }; } } }; }
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
