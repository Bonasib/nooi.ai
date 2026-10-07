// Kie AI (https://kie.ai): one API key for many model platforms — Kling, Seedance, Wan, Hailuo/MiniMax,
// Grok Imagine, PixVerse, Veo (video) · Nano Banana, GPT Image, Seedream, Flux, Ideogram, Qwen, Imagen
// (images) · Suno (music).
//
// Transport (docs.kie.ai, cross-checked against a maintained open-source client, Oct 2026):
//   Market models  POST /api/v1/jobs/createTask {model, input}        → {code:200, data:{taskId}}
//                  GET  /api/v1/jobs/recordInfo?taskId=…              → data.state waiting|queuing|generating|success|fail,
//                                                                       data.resultJson '{"resultUrls":[…]}' (Suno: {"data":[{audio_url}]})
//   Veo 3.1        POST /api/v1/veo/generate {prompt, model: veo3|veo3_fast|veo3_lite, aspect_ratio, imageUrls}
//                  GET  /api/v1/veo/record-info?taskId=…              → data.successFlag 0 running · 1 done · ≥2 failed, data.response.resultUrls
//   Suno           market model "ai-music-api/generate", snake_case input
//   Balance        GET  /api/v1/chat/credit                           → data = remaining credits (used by the health probe)
// The model id is whatever Kie lists on the model's docs page ("kling-3.0/video", "bytedance/seedance-2",
// "nano-banana-pro", "veo3_fast", "suno:V5"…). Field names differ per model family; the common ones are mapped
// below and the admin can add/override any input field per model id (Admin → AI providers → Kie AI → Extra inputs).
import { cfg, configured } from "../lib/settings.js";

const VEO = new Set(["veo3", "veo3_fast", "veo3_lite"]);
const VEO_RATIOS = new Set(["16:9", "9:16"]);
const IMAGE_KINDS = new Set(["image", "look", "sheet"]);
const MUSIC_KINDS = new Set(["music", "sfx"]);

const fullPrompt = (p) => [p.prompt, p.character && `Main character: ${p.character.description}`, ...(p.meta?.refs || []).map((r) => `${r.type}: ${r.description}`), p.camera && `Camera: ${p.camera}`].filter(Boolean).join("\n");
const startImg = (p) => p.inputs?.startImage || p.inputs?.vStart || (p.meta?.refs || []).find((r) => r.url)?.url || undefined;
const refImg = (p) => p.inputs?.iRef || p.inputs?.skImg || p.inputs?.dmIn || p.inputs?.eRef || undefined;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const drop = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""));

// Admin-supplied per-model input overrides: JSON object keyed by model id, e.g. {"kling-3.0/video":{"mode":"pro"}}
function extraInputs(c, model) {
  if (!c.inputs) return {};
  try { const all = typeof c.inputs === "string" ? JSON.parse(c.inputs) : c.inputs; return (all && typeof all[model] === "object" && all[model]) || {}; }
  catch { return {}; }
}

// Kie needs public URLs: uploads come back as /media/… and get the server's public base.
const absUrl = (u) => { if (!u || /^https?:\/\//i.test(u)) return u; const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, ""); if (!base) throw Object.assign(new Error("Set PUBLIC_BASE_URL so Kie AI can read your uploaded files"), { code: 503 }); return base + (u.startsWith("/") ? u : "/" + u); };
const AR = (a) => { const [w, h] = String(a || "16:9").split(":").map(Number); return w && h ? w / h : 16 / 9; };
// closest allowed aspect ratio (Kie rejects values outside each model's list)
const snapAR = (a, list) => { if (!a) return list[0]; if (list.includes(a)) return a; const r = AR(a); return list.filter((x) => /^\d+:\d+$/.test(x)).reduce((best, x) => (Math.abs(Math.log(AR(x) / r)) < Math.abs(Math.log(AR(best) / r)) ? x : best), list.find((x) => /^\d+:\d+$/.test(x))); };
const snapDur = (d, list) => list.reduce((b, x) => (Math.abs(+x - d) < Math.abs(+b - d) ? x : b), list[0]);
const ELEVEN_VOICE = { female: "Sarah", male: "George" };
// the resolution the user picked (720P / 1080P / 2K / 4K for video, 1K / 2K / 4K for images) in each model's own spelling
const pickRes = (p, list, def) => { const r = String(p.meta?.res || "").toLowerCase(); const hit = list.find((x) => x.toLowerCase() === r) || (r === "2k" ? list.find((x) => /1080/.test(x)) : null) || (r === "4k" ? list.find((x) => /1080/.test(x)) : null); return hit || def; };
const TOOL_SCALE = (p) => (String((p.meta?.opt || {}).scale || "2x").startsWith("4") ? "4" : "2");

// Build the market `input` for a studio job — field names and allowed values follow each model's schema
// on docs.kie.ai (cross-checked with the @apicity/kie model registry). Exported for tests.
export function kieInput(model, p) {
  const m = String(model).toLowerCase(), kind = p.kind || "video", inp = p.inputs || {};
  if (/^elevenlabs\/text-to-speech/.test(m)) return drop({ text: p.prompt, voice: p.meta?.voiceId || ELEVEN_VOICE[p.meta?.gender] || "Sarah", language_code: p.meta?.lang || undefined });
  if (/^elevenlabs\/sound-effect/.test(m)) return drop({ text: p.prompt, loop: p.meta?.loop || undefined });
  if (MUSIC_KINDS.has(kind)) return drop({ prompt: p.prompt, custom_mode: false, instrumental: p.meta?.instrumental ?? kind === "sfx" });
  if (/^recraft\/remove-background/.test(m)) return { image: absUrl(inp.bgFg || refImg(p)) };
  if (/^topaz\/image-upscale/.test(m)) return { image_url: absUrl(inp.fin || refImg(p)), upscale_factor: TOOL_SCALE(p) };
  if (/^topaz\/video-upscale/.test(m)) return { video_url: absUrl(inp.fin), upscale_factor: TOOL_SCALE(p) };
  if (/^(kling\/ai-avatar|infinitalk\/)/.test(m)) return { ...drop({ image_url: absUrl(inp.lsV), audio_url: absUrl(inp.lsA), resolution: /infinitalk/.test(m) ? "720p" : undefined }), prompt: p.prompt || (/infinitalk/.test(m) ? "A person talking naturally" : "") };
  if (/^volcengine\/video-to-video-lip-sync/.test(m)) return { mode: "basic", video_url: absUrl(inp.lsV), audio_url: absUrl(inp.lsA) };
  if (IMAGE_KINDS.has(kind)) {
    const ref = refImg(p) ? absUrl(refImg(p)) : undefined, prompt = fullPrompt(p);
    if (/nano-banana-(2|pro)/.test(m)) return drop({ prompt, image_input: ref ? [ref] : undefined, aspect_ratio: snapAR(p.aspect, ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]), resolution: pickRes(p, ["1K", "2K", "4K"], "2K") });
    if (/nano-banana-edit/.test(m)) return drop({ prompt, image_urls: ref ? [ref] : undefined, aspect_ratio: snapAR(p.aspect, ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]) });
    if (/^gpt-image-2/.test(m)) return drop({ prompt, input_urls: /image-to-image/.test(m) && ref ? [ref] : undefined, aspect_ratio: snapAR(p.aspect, ["1:1", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "9:16", "16:9"]), resolution: pickRes(p, ["1K", "2K", "4K"], "2K") });
    if (/^flux-2\//.test(m)) return drop({ prompt, input_urls: /image-to-image/.test(m) && ref ? [ref] : undefined, aspect_ratio: snapAR(p.aspect, ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"]), resolution: pickRes(p, ["1K", "2K"], "2K") });
    if (/^seedream\//.test(m)) return drop({ prompt, image_urls: /edit|image-to-image/.test(m) && ref ? [ref] : undefined, aspect_ratio: snapAR(p.aspect, ["1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "21:9"]), quality: "high" });
    if (/^qwen3\//.test(m)) return drop({ prompt, image_urls: /image-to-image/.test(m) && ref ? [ref] : undefined, image_size: snapAR(p.aspect, ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"]) });
    if (/^ideogram\//.test(m)) return drop({ prompt, image_size: { "1:1": "square_hd", "16:9": "landscape_16_9", "9:16": "portrait_16_9", "4:3": "landscape_4_3", "3:4": "portrait_4_3" }[snapAR(p.aspect, ["1:1", "16:9", "9:16", "4:3", "3:4"])] });
    if (/^google\/imagen/.test(m)) return drop({ prompt, aspect_ratio: snapAR(p.aspect, ["1:1", "16:9", "9:16", "3:4", "4:3"]) });
    if (/^grok-imagine/.test(m)) return drop({ prompt, image_urls: /image-to-image/.test(m) && ref ? [ref] : undefined, aspect_ratio: snapAR(p.aspect, ["2:3", "3:2", "1:1", "16:9", "9:16"]) });
    return drop({ prompt, aspect_ratio: p.aspect || undefined, ...(ref ? { image_urls: [ref] } : {}) });
  }
  // video (and chapter / extend)
  const img0 = startImg(p), img = img0 ? absUrl(img0) : undefined, end = inp.vEnd ? absUrl(inp.vEnd) : undefined, dur = Math.round(+p.dur || 5), prompt = fullPrompt(p), audio = !!(p.meta?.audio);
  if (/^kling-3\.0\/video/.test(m)) return drop({ prompt, image_urls: img ? [img, ...(end ? [end] : [])] : undefined, sound: audio, duration: String(clamp(dur, 3, 15)), aspect_ratio: img ? undefined : snapAR(p.aspect, ["16:9", "9:16", "1:1"]), mode: /4k/i.test(p.meta?.res || "") ? "4K" : /1080|2k/i.test(p.meta?.res || "") || p.meta?.quality === "best" || +p.meta?.fps >= 60 ? "pro" : "std", multi_shots: false, multi_prompt: [], kling_elements: [] });
  if (/^kling-2\.6\/text-to-video/.test(m)) return { prompt, sound: audio, aspect_ratio: snapAR(p.aspect, ["16:9", "9:16", "1:1"]), duration: snapDur(dur, ["5", "10"]) };
  if (/^kling-2\.6\/image-to-video/.test(m)) return { prompt, image_urls: [img], sound: audio, duration: snapDur(dur, ["5", "10"]) };
  if (/kling/.test(m)) return drop({ prompt, duration: dur >= 10 ? "10" : "5", sound: p.meta?.audio ?? undefined, aspect_ratio: img ? undefined : p.aspect, ...(img ? { image_urls: [img] } : {}) });
  if (/seedance/.test(m)) return drop({ prompt, first_frame_url: img, last_frame_url: end, generate_audio: audio, resolution: pickRes(p, ["480p", "720p", "1080p", "4k"], "720p"), aspect_ratio: img ? "adaptive" : snapAR(p.aspect, ["1:1", "4:3", "3:4", "16:9", "9:16", "21:9"]), duration: clamp(dur, 4, 15), web_search: false });
  if (/minimax-h3/.test(m)) return drop({ prompt, duration: dur >= 10 ? 10 : 6, first_frame_url: img, last_frame_url: end, aspect_ratio: img ? undefined : p.aspect || "16:9" });
  if (/hailuo/.test(m)) return drop({ prompt, duration: dur >= 10 ? "10" : "6", image_url: img });
  if (/^wan\/3-0/.test(m)) return drop({ prompt, first_frame_url: img, last_frame_url: end, resolution: pickRes(p, ["480P", "720P", "1080P"], "720P"), aspect_ratio: img ? "adaptive" : snapAR(p.aspect, ["16:9", "4:3", "1:1", "3:4", "9:16"]), duration: clamp(dur, 2, 15), audio: audio || undefined });
  if (/^wan\/2-7-image-to-video/.test(m)) return drop({ prompt, first_frame_url: img, last_frame_url: end, resolution: pickRes(p, ["720p", "1080p"], "720p"), duration: clamp(dur, 2, 15) });
  if (/^wan\/2-7/.test(m)) return drop({ prompt, ratio: snapAR(p.aspect, ["16:9", "9:16", "1:1", "4:3", "3:4"]), resolution: pickRes(p, ["720p", "1080p"], "720p"), duration: clamp(dur, 2, 15) });
  if (/grok-imagine/.test(m)) return drop({ prompt, duration: clamp(dur, 6, 30), aspect_ratio: snapAR(p.aspect, ["2:3", "3:2", "1:1", "16:9", "9:16"]), ...(img ? { image_urls: [img] } : {}) });
  if (/pixverse/.test(m)) return img ? drop({ prompt, image_urls: [img], quality: pickRes(p, ["360p", "540p", "720p", "1080p"], "720p"), duration: clamp(dur, 1, 15) }) : drop({ prompt, aspect_ratio: snapAR(p.aspect, ["16:9", "4:3", "1:1", "3:4", "9:16", "2:3", "3:2", "21:9"]), quality: pickRes(p, ["360p", "540p", "720p", "1080p"], "720p"), duration: clamp(dur, 1, 15), generate_audio_switch: audio || undefined });
  return drop({ prompt, aspect_ratio: img ? undefined : p.aspect || undefined, duration: dur, audio: p.meta?.audio ?? undefined, ...(img ? { image_urls: [img] } : {}) });
}

// Pull the first output URL (or Suno track) out of a finished market record.
export function kieResult(d) {
  let rj = {};
  try { rj = typeof d.resultJson === "string" ? JSON.parse(d.resultJson || "{}") : (d.resultJson || {}); } catch { rj = {}; }
  if (Array.isArray(rj.data)) { const t = rj.data.find((x) => x && x.audio_url); if (t) return t.audio_url; }
  const urls = rj.resultUrls || rj.result_urls || [];
  return urls[0] || rj.resultObject?.url || rj.url || rj.resultImageUrl || null;
}

export const kie = (model) => {
  const c = cfg("kie"), base = (c.baseUrl || "https://api.kie.ai").replace(/\/$/, "");
  const h = { Authorization: "Bearer " + c.apiKey, "Content-Type": "application/json" };
  const call = async (path, init) => {
    const r = await fetch(base + path, { ...init, headers: h });
    const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = { raw: t }; }
    // Kie answers HTTP 200 with its own code in the body (401 bad key, 402 no credits, 422 bad input, 429 rate limit…)
    const code = !r.ok ? r.status : (d.code && d.code !== 200 ? d.code : 0);
    // 433 = Kie's own rate limit → treat like 429 so jobs retry with backoff
    if (code) throw Object.assign(new Error(`Kie AI ${code === 433 ? 429 : code}: ${d.msg || d.message || t.slice(0, 200)}`), { status: code });
    return d.data || {};
  };
  return {
    name: "Kie AI", configured: configured("kie"),
    async submit(p) {
      const mo = String(model || "").trim();
      if (!mo) throw Object.assign(new Error("Set a Kie AI model id (Admin → AI providers → Kie AI, or Admin → Models)"), { code: 503 });
      if (VEO.has(mo)) {
        const img = startImg(p);
        const d = await call("/api/v1/veo/generate", { method: "POST", body: JSON.stringify(drop({ prompt: fullPrompt(p), model: mo, aspect_ratio: VEO_RATIOS.has(p.aspect) ? p.aspect : "Auto", imageUrls: img ? [img] : undefined, ...extraInputs(c, mo) })) });
        return { remoteId: "veo:" + d.taskId };
      }
      if (mo.startsWith("mj:")) {  // Midjourney through Kie: POST /api/v1/mj/generate, GET /api/v1/mj/record-info
        const ref = refImg(p), ar = p.aspect && /^\d+:\d+$/.test(p.aspect) ? p.aspect : "1:1";
        const d = await call("/api/v1/mj/generate", { method: "POST", body: JSON.stringify(drop({ taskType: ref ? "mj_img2img" : "mj_txt2img", prompt: fullPrompt(p), speed: "fast", aspectRatio: ar, version: mo.slice(3) || "7", fileUrls: ref ? [ref] : undefined, ...extraInputs(c, mo) })) });
        return { remoteId: "mj:" + d.taskId };
      }
      // lip-sync from a typed script: make the voice with ElevenLabs on Kie first, then animate the face with it
      if (/^(kling\/ai-avatar|infinitalk\/|volcengine\/video-to-video-lip-sync)/.test(mo) && !(p.inputs || {}).lsA && p.prompt) {
        const tm = "elevenlabs/text-to-speech-multilingual-v2", t = await call("/api/v1/jobs/createTask", { method: "POST", body: JSON.stringify({ model: tm, input: kieInput(tm, { ...p, kind: "voice" }) }) });
        let audio = null;
        for (let i = 0; i < 80 && !audio; i++) { await new Promise((r) => setTimeout(r, i ? 3000 : 1200)); const d = await call("/api/v1/jobs/recordInfo?taskId=" + encodeURIComponent(t.taskId), { method: "GET" }); const st = String(d.state || "").toLowerCase();
          if (st === "success") { audio = kieResult(d); if (!audio) throw new Error("Kie AI voice finished without audio"); } else if (st === "fail") throw new Error("Voice for lip-sync failed: " + (d.failMsg || "")); }
        if (!audio) throw Object.assign(new Error("The voice for lip-sync took too long"), { code: 504 });
        p = { ...p, prompt: "", inputs: { ...(p.inputs || {}), lsA: audio } };
      }
      const suno = mo.startsWith("suno:");
      const apiModel = suno ? "ai-music-api/generate" : mo;
      const input = { ...kieInput(apiModel, p), ...(suno ? { model: mo.slice(5) || "V5" } : {}), ...extraInputs(c, mo) };
      const d = await call("/api/v1/jobs/createTask", { method: "POST", body: JSON.stringify({ model: apiModel, input }) });
      return { remoteId: "m:" + d.taskId };
    },
    async poll(rid) {
      const [type, id] = String(rid).split(/:(.+)/);
      if (type === "veo") {
        const d = await call("/api/v1/veo/record-info?taskId=" + encodeURIComponent(id), { method: "GET" });
        const f = +d.successFlag;
        return f === 1 ? { status: "done", url: (d.response?.resultUrls || [])[0] || d.response?.resultUrl || null }
          : f >= 2 ? { status: "failed", error: d.errorMessage || d.failMsg || "Veo generation failed" } : { status: "rendering" };
      }
      if (type === "mj") {
        const d = await call("/api/v1/mj/record-info?taskId=" + encodeURIComponent(id), { method: "GET" }), f = +d.successFlag;
        let ri = d.resultInfoJson; try { if (typeof ri === "string") ri = JSON.parse(ri); } catch { ri = {}; }
        const u = ((ri && ri.resultUrls) || []).map((x) => (typeof x === "string" ? x : x && x.resultUrl)).filter(Boolean)[0];
        return f === 1 ? (u ? { status: "done", url: u } : { status: "failed", error: "Midjourney finished without an image" }) : f >= 2 ? { status: "failed", error: d.errorMessage || "Midjourney generation failed" } : { status: "rendering" };
      }
      const d = await call("/api/v1/jobs/recordInfo?taskId=" + encodeURIComponent(id), { method: "GET" });
      const s = String(d.state || "").toLowerCase();
      if (s === "success") { const url = kieResult(d); return url ? { status: "done", url } : { status: "failed", error: "Kie AI finished without an output URL" }; }
      if (s === "fail") return { status: "failed", error: `${d.failMsg || "Kie AI task failed"}${d.failCode ? " (" + d.failCode + ")" : ""}` };
      return { status: s === "waiting" || s === "queuing" ? "queued" : "rendering", progress: typeof d.progress === "number" ? (d.progress > 1 ? d.progress / 100 : d.progress) : null };
    }
  };
};

// Built-in Kie model for each studio model, so every model works as soon as the Kie key is saved
// (an id set in Admin → Models, or the admin's default model, still wins). Image-to-video / edit variants are
// picked when the job carries a start frame or a reference image.
export const KIE_BUILTIN = {
  video: { kling40: "kling-3.0/video", kling30: "kling-3.0/video", kling: "kling-2.6/text-to-video", seedance25: "bytedance/seedance-2-5", seedance20: "bytedance/seedance-2",
    seedance: "bytedance/seedance-2-fast", hailuoh3: "minimax-h3/text-to-video", hailuo: "minimax-h3/text-to-video", wan30: "wan/3-0-video", wan22: "wan/2-7-text-to-video",
    qwenwan: "wan/2-7-text-to-video", hunyuan: "wan/2-7-text-to-video", ltx23: "veo3_fast", ltxfast: "bytedance/seedance-2-fast", veo: "veo3", veofast: "veo3_fast", veo31: "veo3", veo31f: "veo3_fast", grok: "grok-imagine/text-to-video", pixverse6: "pixverse-v6/text-to-video", kling26: "kling-2.6/text-to-video", wan27: "wan/2-7-text-to-video", auto: "bytedance/seedance-2-fast" },
  image: { nano: "nano-banana-2", nanopro: "nano-banana-pro", img20: "gpt-image-2-text-to-image", img25: "seedream/4.5-text-to-image", qwen: "qwen3/text-to-image", qwen2: "qwen3/text-to-image",
    flux: "flux-2/pro-text-to-image", sdxl: "seedream/4.5-text-to-image", dotimg: "nano-banana-2", mj: "mj:7", seedream5: "seedream/5-pro-text-to-image", imagen4: "google/imagen4-ultra", ideogram3: "ideogram/v3-text-to-image", grokimg: "grok-imagine/text-to-image", flux2: "flux-2/pro-text-to-image", auto: "nano-banana-2" },
};
const I2V = { "kling-2.6/text-to-video": "kling-2.6/image-to-video", "wan/2-7-text-to-video": "wan/2-7-image-to-video", "minimax-h3/text-to-video": "minimax-h3/image-to-video", "grok-imagine/text-to-video": "grok-imagine/image-to-video", "pixverse-v6/text-to-video": "pixverse-v6/image-to-video" };
const EDIT = { "gpt-image-2-text-to-image": "gpt-image-2-image-to-image", "flux-2/pro-text-to-image": "flux-2/pro-image-to-image", "seedream/4.5-text-to-image": "seedream/4.5-edit", "qwen3/text-to-image": "qwen3/image-to-image", "seedream/5-pro-text-to-image": "seedream/5-pro-image-to-image", "grok-imagine/text-to-image": "grok-imagine/image-to-image" };
export function kieAuto(cap, body = {}) {
  if (!configured("kie")) return null;
  const c = cfg("kie"), kind = body.kind || cap, inp = body.inputs || {}, isVid = (u) => /\.(mp4|mov|webm|mkv|m4v)(\?|$)/i.test(String(u || ""));
  if (cap === "tts") return kind === "voice" ? "elevenlabs/text-to-speech-multilingual-v2" : null;      // cloning / conversion need their own provider
  if (cap === "music" || MUSIC_KINDS.has(kind)) return kind === "sfx" ? "elevenlabs/sound-effect-v2" : c.musicModel || "suno:V5";
  if (cap === "matting") return isVid(inp.bgFg) ? null : "recraft/remove-background";
  if (cap === "enhance") { const tool = body.meta?.tool || "upscale"; return tool !== "upscale" ? null : isVid(inp.fin) || body.meta?.isVideo ? "topaz/video-upscale" : "topaz/image-upscale"; }
  if (cap === "lipsync") return isVid(inp.lsV) ? "volcengine/video-to-video-lip-sync" : "kling/ai-avatar-standard";
  if (!["video", "image"].includes(cap)) return null;
  const img = IMAGE_KINDS.has(kind) || cap === "image";
  let m = KIE_BUILTIN[img ? "image" : "video"][body.model] || (img ? c.imageModel || KIE_BUILTIN.image.auto : c.videoModel || KIE_BUILTIN.video.auto);
  if (img) { if (refImg(body) && EDIT[m]) m = EDIT[m]; }
  else if (startImg(body) && I2V[m]) m = I2V[m];
  return m;
}

// Default Kie model for a capability, if the admin set one (used when no direct provider is connected).
export function kieDefault(cap, kind) {
  if (!configured("kie")) return null;
  const c = cfg("kie");
  return cap === "video" ? c.videoModel || null : cap === "image" ? c.imageModel || null : cap === "music" || MUSIC_KINDS.has(kind) ? c.musicModel || null : null;
}
