// Seedance (ByteDance · BytePlus ModelArk), Kling AI, Qwen/Wan (Alibaba DashScope).
// ⚠ Confirm endpoints, model ids and parameters against each provider's current docs in sandbox.
import crypto from "crypto";
import { cfg, configured, S as settingsS } from "../lib/settings.js";
import { elevenlabs } from "./elevenlabs.js";
import { nanoBanana, midjourney, gptImage } from "./images2.js";
import { kie, kieDefault, kieAuto } from "./kie.js";
import { nvRoute, nvAdapter } from "./nvidia.js";
import { gen3dRoute, GEN3D } from "./gen3d.js";
// Flagship models → provider + API model id set by the admin (Admin → Models)
const FLAGSHIP = { kling40: "kling", kling30: "kling", seedance25: "seedance", seedance20: "seedance", hailuoh3: "minimax" };
const makers = () => ({ kling, seedance, minimax });
function flagship(id) { const prov = FLAGSHIP[id]; if (!prov) return null; const apiModel = (settingsS().modelCat || {})[id]?.apiModel; if (!apiModel) throw Object.assign(new Error(`Set the API model id for ${id} in Admin → Models before using it`), { code: 503 }); return { key: prov + "@" + apiModel, a: makers()[prov](apiModel) }; }
const j = async (r, name) => { const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = { raw: t }; } if (!r.ok) throw new Error(`${name} ${r.status}: ${d.error?.message || d.message || d.msg || t.slice(0, 200)}`); return d; };
const ratio = (a) => ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"].includes(a) ? a : "16:9";
const fullPrompt = (p) => [p.prompt, p.character && `Main character: ${p.character.description}`, ...(p.meta?.refs || []).map((r) => `${r.type}: ${r.description}`), p.camera && `Camera: ${p.camera}`].filter(Boolean).join("\n");
const startImg = (p) => p.inputs?.startImage || p.inputs?.vStart || undefined;

export const seedance = (mo) => { const c = cfg("seedance"); const base = (c.baseUrl || "https://ark.ap-southeast.bytepluses.com/api/v3").replace(/\/$/, ""); const h = { Authorization: "Bearer " + c.apiKey, "Content-Type": "application/json" };
  return { name: "Seedance", configured: configured("seedance"),
    async submit(p) { const content = [{ type: "text", text: `${fullPrompt(p)} --rt ${ratio(p.aspect)} --dur ${p.dur >= 10 ? 10 : 5}` }]; if (startImg(p)) content.push({ type: "image_url", image_url: { url: startImg(p) } });
      const d = await j(await fetch(base + "/contents/generations/tasks", { method: "POST", headers: h, body: JSON.stringify({ model: mo || c.model || "seedance-1-0-pro-250528", content }) }), "Seedance"); return { remoteId: d.id }; },
    async poll(id) { const d = await j(await fetch(base + "/contents/generations/tasks/" + id, { headers: h }), "Seedance"); const s = d.status;
      return s === "succeeded" ? { status: "done", url: d.content?.video_url } : s === "failed" || s === "cancelled" ? { status: "failed", error: d.error?.message || "Seedance failed" } : { status: s === "queued" ? "queued" : "rendering" }; } }; };

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function klingToken(ak, sk) { const now = Math.floor(Date.now() / 1000); const h = b64u({ alg: "HS256", typ: "JWT" }), pl = b64u({ iss: ak, exp: now + 1800, nbf: now - 5 }); return `${h}.${pl}.${crypto.createHmac("sha256", sk).update(h + "." + pl).digest("base64url")}`; }
export const kling = (mo) => { const c = cfg("kling"); const base = (c.baseUrl || "https://api.klingai.com").replace(/\/$/, ""); const h = () => ({ Authorization: "Bearer " + klingToken(c.accessKey, c.secretKey), "Content-Type": "application/json" });
  return { name: "Kling", configured: !!(c.accessKey && c.secretKey),
    async submit(p) { const img = startImg(p); const type = img ? "image2video" : "text2video";
      const d = await j(await fetch(`${base}/v1/videos/${type}`, { method: "POST", headers: h(), body: JSON.stringify({ model_name: mo || c.model || "kling-v1", prompt: fullPrompt(p), negative_prompt: p.meta?.neg, duration: p.dur >= 10 ? "10" : "5", aspect_ratio: ratio(p.aspect), ...(img ? { image: img } : {}) }) }), "Kling");
      return { remoteId: type + ":" + d.data?.task_id }; },
    async poll(rid) { const [type, id] = rid.split(":"); const d = await j(await fetch(`${base}/v1/videos/${type}/${id}`, { headers: h() }), "Kling"); const s = d.data?.task_status;
      return s === "succeed" ? { status: "done", url: d.data?.task_result?.videos?.[0]?.url } : s === "failed" ? { status: "failed", error: d.data?.task_status_msg || "Kling failed" } : { status: s === "submitted" ? "queued" : "rendering" }; } }; };

export const dashscope = (what) => { const c = cfg("qwen"); const base = (c.baseUrl || "https://dashscope-intl.aliyuncs.com/api/v1").replace(/\/$/, ""); const h = { Authorization: "Bearer " + c.apiKey, "Content-Type": "application/json", "X-DashScope-Async": "enable" };
  return { name: "Qwen · DashScope", configured: configured("qwen"),
    async submit(p) { const video = what === "video"; const url = base + (video ? "/services/aigc/video-generation/video-synthesis" : "/services/aigc/text2image/image-synthesis");
      const size = video ? (p.aspect === "9:16" ? "720*1280" : p.aspect === "1:1" ? "960*960" : "1280*720") : (p.aspect === "9:16" ? "768*1344" : p.aspect === "16:9" ? "1344*768" : "1024*1024");
      const body = { model: video ? (c.videoModel || "wan2.1-t2v-turbo") : (c.imageModel || "wanx2.1-t2i-turbo"), input: { prompt: fullPrompt(p), ...(video && startImg(p) ? { img_url: startImg(p) } : {}) }, parameters: video ? { size } : { size, n: 1 } };
      const d = await j(await fetch(url, { method: "POST", headers: h, body: JSON.stringify(body) }), "DashScope"); return { remoteId: d.output?.task_id }; },
    async poll(id) { const d = await j(await fetch(base + "/tasks/" + id, { headers: { Authorization: "Bearer " + c.apiKey } }), "DashScope"); const o = d.output || {}; const s = o.task_status;
      return s === "SUCCEEDED" ? { status: "done", url: o.video_url || o.results?.[0]?.url } : s === "FAILED" || s === "CANCELED" ? { status: "failed", error: o.message || "DashScope failed" } : { status: s === "PENDING" ? "queued" : "rendering" }; } }; };
// MiniMax Hailuo (video) — ⚠ verify endpoints/model id in the MiniMax docs before launch
export const minimax = (mo) => { const c = cfg("minimax"); const base = (c.baseUrl || "https://api.minimax.io/v1").replace(/\/$/, ""); const h = { Authorization: "Bearer " + c.apiKey, "Content-Type": "application/json" };
  return { name: "MiniMax Hailuo", configured: configured("minimax"),
    async submit(p) { const body = { model: mo || c.model || "MiniMax-Hailuo-02", prompt: fullPrompt(p), duration: p.dur >= 10 ? 10 : 6, resolution: "1080P" }; if (startImg(p)) body.first_frame_image = startImg(p);
      const d = await j(await fetch(base + "/video_generation", { method: "POST", headers: h, body: JSON.stringify(body) }), "MiniMax"); if (d.base_resp && d.base_resp.status_code) throw new Error("MiniMax: " + d.base_resp.status_msg); return { remoteId: d.task_id }; },
    async poll(id) { const d = await j(await fetch(base + "/query/video_generation?task_id=" + encodeURIComponent(id), { headers: h }), "MiniMax"); const s = String(d.status || "").toLowerCase();
      if (s === "success" && d.file_id) { const f = await j(await fetch(base + "/files/retrieve?file_id=" + encodeURIComponent(d.file_id), { headers: h }), "MiniMax"); return { status: "done", url: f.file && f.file.download_url }; }
      return s === "fail" || s === "failed" ? { status: "failed", error: (d.base_resp && d.base_resp.status_msg) || "MiniMax failed" } : { status: s === "queueing" ? "queued" : "rendering" }; } }; };
// Pick the adapter for a job: video models can be routed to Seedance / Kling / Qwen / MiniMax, or to Kie AI
export function adapterFor(cap, body, PROVIDERS) {
  // NVIDIA AI first when it handles this job (explicit NVIDIA model, or "nooi Auto" with that capability switched on)
  const nt = nvRoute(cap, body); if (nt) return { key: "nv@" + nt, a: nvAdapter(nt) };
  // 3D objects on Tripo3D / Meshy, 360° worlds on Blockade Labs Skybox
  const g = gen3dRoute(cap, body); if (g) return g;
  // Any studio model with a Kie model id set in Admin → Models runs on Kie AI
  const km = body.model && (settingsS().modelCat || {})[body.model]?.kieModel;
  if (km) return { key: "kie@" + km, a: kie(km) };
  let r;
  try { r = directAdapter(cap, body, PROVIDERS); }
  catch (e) { const k = kieAuto(cap, body); if (k) return { key: "kie@" + k, a: kie(k) }; throw e; }  // flagship without its own API id
  // The model's own provider isn't connected → Kie AI (admin default for the capability first, then the built-in map)
  if (r && !(r.a && r.a.configured)) { const d = r.key === cap ? kieDefault(cap, body.kind) : null; const k = d || kieAuto(cap, body); if (k) return { key: "kie@" + k, a: kie(k) }; }
  return r;
}
function directAdapter(cap, body, PROVIDERS) {
  if (body.kind === "voice" && body.meta?.engine === "elevenlabs") return { key: "elevenlabs", a: elevenlabs() };
  if (cap === "image" && (body.model === "nano" || body.model === "nanopro")) return { key: "nano@" + body.model, a: nanoBanana(body.model) };
  if (cap === "image" && body.model === "mj") return { key: "midjourney", a: midjourney() };
  if (cap === "image" && body.model === "qwen2") return { key: "qwen-image", a: dashscope("image") };
  if (cap === "image" && body.model === "img20") return { key: "gpt@img20", a: gptImage("img20") };
  if (cap === "video" && FLAGSHIP[body.model]) return flagship(body.model);
  if (cap === "video" && body.model === "seedance") return { key: "seedance", a: seedance() };
  if (cap === "video" && body.model === "kling") return { key: "kling", a: kling() };
  if (cap === "video" && body.model === "hailuo") return { key: "minimax", a: minimax() };
  if (cap === "video" && body.model === "qwenwan") return { key: "qwen-video", a: dashscope("video") };
  if (cap === "image" && body.model === "qwen") return { key: "qwen-image", a: dashscope("image") };
  return { key: cap, a: PROVIDERS[cap] };
}
export function adapterByKey(key, PROVIDERS) { if (String(key).startsWith("nv@")) return nvAdapter(key.slice(3)); if (GEN3D[key]) return GEN3D[key](); if (String(key).startsWith("kie@")) return kie(key.slice(4)); if (String(key).startsWith("gpt@")) return gptImage(key.slice(4)); if (key === "elevenlabs") return elevenlabs(); if (key === "midjourney") return midjourney(); if (String(key).startsWith("nano@")) return nanoBanana(key.slice(5)); if (String(key).includes("@")) { const [prov, mo] = key.split("@"); return makers()[prov](mo); } return key === "minimax" ? minimax() : key === "seedance" ? seedance() : key === "kling" ? kling() : key === "qwen-video" ? dashscope("video") : key === "qwen-image" ? dashscope("image") : PROVIDERS[key]; }
