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

// Build the market `input` for a studio job. Exported for tests.
export function kieInput(model, p) {
  const m = String(model).toLowerCase(), kind = p.kind || "video";
  if (MUSIC_KINDS.has(kind)) return drop({ prompt: p.prompt, custom_mode: false, instrumental: p.meta?.instrumental ?? kind === "sfx" });
  if (IMAGE_KINDS.has(kind)) {
    const ref = refImg(p);
    return drop({ prompt: fullPrompt(p), aspect_ratio: p.aspect || undefined,
      ...(ref ? (/nano-banana/.test(m) ? { image_input: [ref] } : { image_urls: [ref] }) : {}) });
  }
  // video (and chapter / extend) — start-image field and duration type differ per family
  const img = startImg(p), end = p.inputs?.vEnd, dur = Math.round(+p.dur || 5);
  // image-to-video models take the frame's shape, and reject aspect_ratio
  const base = { prompt: fullPrompt(p), aspect_ratio: img && /image-to-video/.test(m) ? undefined : p.aspect || undefined };
  if (/kling/.test(m)) return drop({ ...base, duration: dur >= 10 ? "10" : "5", sound: p.meta?.audio ?? undefined, ...(img ? { image_urls: [img] } : {}) });
  if (/seedance/.test(m)) return drop({ ...base, duration: clamp(dur, 4, 15), generate_audio: p.meta?.audio ?? undefined, first_frame_url: img, last_frame_url: end });
  if (/minimax-h3/.test(m)) return drop({ ...base, duration: dur >= 10 ? 10 : 6, first_frame_url: img, last_frame_url: end });
  if (/hailuo/.test(m)) return drop({ ...base, duration: dur >= 10 ? "10" : "6", image_url: img });
  if (/grok-imagine/.test(m)) return drop({ ...base, duration: String(dur), ...(img ? { image_urls: [img] } : {}) });
  if (/wan\/2-7/.test(m)) return drop({ ...base, duration: String(dur), image_url: img });
  return drop({ ...base, duration: dur, audio: p.meta?.audio ?? undefined, ...(img ? { image_urls: [img] } : {}) });
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
      const d = await call("/api/v1/jobs/recordInfo?taskId=" + encodeURIComponent(id), { method: "GET" });
      const s = String(d.state || "").toLowerCase();
      if (s === "success") { const url = kieResult(d); return url ? { status: "done", url } : { status: "failed", error: "Kie AI finished without an output URL" }; }
      if (s === "fail") return { status: "failed", error: `${d.failMsg || "Kie AI task failed"}${d.failCode ? " (" + d.failCode + ")" : ""}` };
      return { status: s === "waiting" || s === "queuing" ? "queued" : "rendering", progress: typeof d.progress === "number" ? (d.progress > 1 ? d.progress / 100 : d.progress) : null };
    }
  };
};

// Default Kie model for a capability, if the admin set one (used when no direct provider is connected).
export function kieDefault(cap, kind) {
  if (!configured("kie")) return null;
  const c = cfg("kie");
  return cap === "video" ? c.videoModel || null : cap === "image" ? c.imageModel || null : cap === "music" || MUSIC_KINDS.has(kind) ? c.musicModel || null : null;
}
