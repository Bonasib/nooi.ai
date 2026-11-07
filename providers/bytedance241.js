// v241: Seedance on the owner's own ByteDance key (BytePlus ModelArk — Admin → AI providers → Seedance). Per BytePlus's API
// reference (docs.byteplus.com/en/docs/modelark/create-video-generation-task-api, …/get-video-generation-task-api):
//   POST {base}/contents/generations/tasks  { model, content: [ {type:"text",text}, {type:"image_url",image_url:{url},role},
//        {type:"video_url",video_url:{url},role:"reference_video"}, {type:"audio_url",audio_url:{url},role:"reference_audio"} ],
//        ratio, duration, resolution, generate_audio, watermark }   → { id }
//   GET  {base}/contents/generations/tasks/{id} → { status: queued|running|succeeded|failed|expired|cancelled, content:{video_url}, error }
// Roles: first_frame / last_frame (picture-to-video), reference_image / reference_video / reference_audio (omni reference — the
// prompt names them @Image1, @Video1 …, as the site already writes them). The two kinds can't be mixed in one request.
// Pictures go as Base64 (data:image/<fmt>;base64,…) when they are on this server, so ByteDance never needs to reach it; videos and
// sounds go as a public link (BytePlus takes only a link for those). The words and references are built exactly as for Seedance on
// the AI engine (providers/kie.js kieInput), then put in BytePlus's form — every Seedance feature of the site works on the key.
// ⚠ BytePlus: Seedance 2.0 / 2.5 don't accept reference pictures or videos with real human faces (only Seedance's own outputs of
// the last 30 days, its digital characters and authorised portraits) — such a job is refused and the customer told why; nothing is
// charged.
import fs from "fs";
import path from "path";
import { cfg, configured, S as settingsS } from "../lib/settings.js";
import { kieInput, swapEngine, SWAP_MODELS } from "./kie.js";
import { MEDIA_DIR } from "../lib/media.js";

export const BD_DEFAULT241 = "https://ark.ap-southeast.bytepluses.com/api/v3";
// the site's Seedance models → BytePlus model ids (BytePlus's model list, November 2026)
export const BD_MODELS241 = { seedance25: "dreamina-seedance-2-5-260628", seedance20: "dreamina-seedance-2-0-260128", seedance: "dreamina-seedance-2-0-fast-260128",
  seedance2mini: "dreamina-seedance-2-0-mini-260615", ltxfast: "dreamina-seedance-2-0-fast-260128", auto: "dreamina-seedance-2-0-fast-260128" };
export const BD_SITE241 = { "dreamina-seedance-2-5-260628": "seedance25", "dreamina-seedance-2-0-260128": "seedance20", "dreamina-seedance-2-0-fast-260128": "seedance", "dreamina-seedance-2-0-mini-260615": "seedance2mini" };
const SEEDANCE_PICKS = new Set(["seedance", "seedance20", "seedance25", "seedance2mini", "ltxfast"]);
const VIDEO_FILE = /\.(mp4|mov|webm|mkv|m4v)(\?|$)/i;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const base = () => (cfg("seedance").baseUrl || BD_DEFAULT241).replace(/\/+$/, "");
export const bdOn241 = () => configured("seedance");

// which BytePlus model a job runs on: Admin → Models (the model's API id) wins, then the id on the Seedance card when it is a
// Seedance 2.x id and the plain Seedance was picked, then the site's own table
export function bdModel241(body = {}) {
  const pick = String(body.model || "auto"), own = (settingsS().modelCat || {})[pick]?.apiModel, card = String(cfg("seedance").model || "");
  if (own && /seedance/i.test(own)) return own;
  if (["seedance", "auto"].includes(pick) && /^dreamina-seedance-2/.test(card)) return card;
  return BD_MODELS241[pick] || (body.meta?.edit135 ? BD_MODELS241.seedance20 : BD_MODELS241.seedance);
}
// does the owner's ByteDance key take this job? A Seedance model picked (any task: words, a picture, references, editing a video's
// seconds — Edit with words, Replace things, Extend), or a plain "Auto" video while MiniMax doesn't take every video. Never a
// Character Swap, Motion Control or lip-sync (other engines), and never a job that isn't a video.
export function bdRoute241(cap, body = {}, { mmAll = false } = {}) {
  if (cap !== "video" || !bdOn241()) return null;
  const kind = String(body.kind || ""), model = String(body.model || "");
  // v246: a Character Swap while the swap engine is Seedance goes to the owner's key first (BytePlus refuses a real person's face —
  // then the job moves on to the AI engine, see swapBack246)
  if (model === "mcswap" && ["seedance", "seedancefast"].includes(swapEngine())) { const m = swapEngine() === "seedance" ? BD_MODELS241.seedance20 : BD_MODELS241.seedance; return { key: "bd@" + m, a: bytedance241(m) }; }
  if (/^mc(26|30|swap)$/.test(model) || body.meta?.swap93 || ["lipsync", "avatar", "swap", "upscale"].includes(kind)) return null;
  const edit = !!body.meta?.edit135, readsVideo = Object.values(body.inputs || {}).some((v) => VIDEO_FILE.test(String(v || "")));
  const auto = (model === "auto" || !model) && !mmAll && ["video", "chapter", ""].includes(kind) && !readsVideo;
  if (!SEEDANCE_PICKS.has(model) && !auto && !edit) return null;
  const m = bdModel241(body); return { key: "bd@" + m, a: bytedance241(m) };
}
// a picture on this server → Base64 (a link to anywhere else is sent as it is)
function picture(u) {
  const s = String(u || ""); if (!s) return s; if (/^data:image\//.test(s)) return s;
  const pub = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, ""), loc = pub && s.startsWith(pub) ? s.slice(pub.length) : s;
  const m = /^\/media\/([A-Za-z0-9._-]+\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif))$/i.exec(loc);
  if (m) { try { const f = path.join(MEDIA_DIR, m[1]), st = fs.statSync(f);
    if (st.size < 9 * 1024 * 1024) { const e = m[2].toLowerCase(), ext = e === "jpg" ? "jpeg" : e === "tif" ? "tiff" : e; return `data:image/${ext};base64,${fs.readFileSync(f).toString("base64")}`; } } catch {} }
  return /^https?:\/\//i.test(s) ? s : (pub ? pub + (loc.startsWith("/") ? loc : "/" + loc) : s);
}
const link = (u) => { const s = String(u || ""); if (/^https?:\/\//i.test(s)) return s; const pub = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, ""); return pub ? pub + (s.startsWith("/") ? s : "/" + s) : s; };
const RATIOS = ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"];
// the site's Seedance request (the AI engine's form) → BytePlus's form
export function bdBody241(model, p) {
  const k = kieInput(/edit135/.test(JSON.stringify(p.meta || {})) || p.model === "mcswap" ? "bytedance/seedance-2" : "bytedance/seedance-2-fast", p) || {}, m = String(model);
  const v25 = /2-5/.test(m), small = /fast|mini/.test(m), content = [];
  const text = String(k.prompt || p.prompt || "").trim(); if (text) content.push({ type: "text", text });
  const refs = [...(k.reference_image_urls || [])], vids = [...(k.reference_video_urls || [])], auds = [...(k.reference_audio_urls || [])];
  if (refs.length || vids.length || auds.length) {   // omni reference (can't be mixed with a first / last frame)
    if (k.first_frame_url) refs.unshift(k.first_frame_url);
    for (const u of refs.slice(0, v25 ? 30 : 9)) content.push({ type: "image_url", image_url: { url: picture(u) }, role: "reference_image" });
    for (const u of vids.slice(0, v25 ? 10 : 3)) content.push({ type: "video_url", video_url: { url: link(u) }, role: "reference_video" });
    for (const u of auds.slice(0, v25 ? 10 : 3)) content.push({ type: "audio_url", audio_url: { url: link(u) }, role: "reference_audio" });
  } else {
    if (k.first_frame_url) content.push({ type: "image_url", image_url: { url: picture(k.first_frame_url) }, role: "first_frame" });
    if (k.first_frame_url && k.last_frame_url) content.push({ type: "image_url", image_url: { url: picture(k.last_frame_url) }, role: "last_frame" });
  }
  const framed = !!(k.first_frame_url || vids.length);
  let ratio = RATIOS.includes(k.aspect_ratio) ? k.aspect_ratio : RATIOS.includes(p.aspect) ? p.aspect : "adaptive";
  if (framed && (v25 || vids.length)) ratio = "adaptive";   // (2.5: editing, extending and picture-to-video keep the source's shape)
  const editing = !!(p.meta?.edit135 && vids.length);
  let duration = clamp(Math.round(+k.duration || +p.dur || 5), 4, v25 ? 30 : 15); if (v25 && editing) duration = -1;   // (2.5 edits: the video's own length)
  const res = String(k.resolution || "720p").toLowerCase(), okRes = small ? ["480p", "720p"] : v25 ? ["480p", "720p", "1080p"] : ["480p", "720p", "1080p", "4k"];
  return { model: m, content, ratio, duration, resolution: okRes.includes(res) ? res : "720p", generate_audio: k.generate_audio === undefined ? !!p.meta?.audio : !!k.generate_audio, watermark: false };
}
const FACES = /real (human )?(face|person|people)|portrait|PrivacyInformation|SensitiveContent.*(face|person)|face.*(not supported|detected)/i;
async function call(pathName, init) {
  const r = await fetch(base() + pathName, { ...init, headers: { Authorization: "Bearer " + cfg("seedance").apiKey, "Content-Type": "application/json", ...(init && init.headers) } });
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = { raw: t }; }
  if (!r.ok) { const msg = (d.error && (d.error.message || d.error.code)) || d.message || t.slice(0, 200), code = String((d.error && d.error.code) || ""), e = new Error(`Seedance (ByteDance) ${r.status}: ${msg}`); e.status = r.status;
    if (FACES.test(msg + " " + code)) Object.assign(e, { userMsg: "ByteDance doesn't accept photos or videos of real people's faces for this — nothing was charged. Try it without a real face, or with one of your characters made on the site.", userMsgAr: "لا تقبل بايت دانس صور أو فيديوهات وجوه أشخاص حقيقيين لهذا — لم يُخصم شيء. جرّبه دون وجه حقيقي، أو بإحدى شخصياتك المصنوعة في الموقع.", noFallback: true });
    throw e; }
  return d;
}
export const bytedance241 = (model) => ({ name: "Seedance (ByteDance)", configured: bdOn241(),
  async submit(p) { const d = await call("/contents/generations/tasks", { method: "POST", body: JSON.stringify(bdBody241(model || bdModel241(p), p)) }); if (!d.id) throw new Error("Seedance (ByteDance): no task id"); return { remoteId: d.id }; },
  async poll(id) { const d = await call("/contents/generations/tasks/" + encodeURIComponent(id), { method: "GET" }), s = String(d.status || "");
    if (s === "succeeded") return d.content && d.content.video_url ? { status: "done", url: d.content.video_url } : { status: "failed", error: "Seedance (ByteDance): no video in the answer" };
    if (["failed", "expired", "cancelled"].includes(s)) { const why = (d.error && (d.error.message || d.error.code)) || s, code = String((d.error && d.error.code) || ""); return { status: "failed", error: FACES.test(why + " " + code) ? "ByteDance doesn't accept photos or videos of real people's faces for this. (" + String(why).slice(0, 160) + ")" : "Seedance (ByteDance): " + why }; }
    return { status: s === "queued" ? "queued" : "rendering" }; } });

// v246: a Character Swap ByteDance turned down because of a real person's face → the same swap on the AI engine, once — unless the
// engine is switched off (Only my MiniMax key) or is known to be out of credits; then the customer is told ByteDance's reason
export const BD_FACE246 = /ByteDance doesn't accept photos or videos of real people's faces/;
export function swapBack246(job, msg, { engineOk = true } = {}) {
  const m = String((msg && (msg.userMsg || msg.message)) || msg || "");
  if (!String(job.prov || "").startsWith("bd@") || job.payload?.model !== "mcswap" || job.triedEngine246 || !engineOk || !BD_FACE246.test(m)) return null;
  return "kie@" + (SWAP_MODELS[swapEngine()] || SWAP_MODELS.seedancefast);
}
