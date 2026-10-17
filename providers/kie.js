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
import { presetVoiceId } from "../lib/voicepresets.js";   // v97: the Voice page example you heard = the voice you get
import { PICTURE_WORDS } from "../lib/picturewords.js";   // v100: a picture with no words still tells the engine what to do

const VEO = new Set(["veo3", "veo3_fast", "veo3_lite"]);
const VEO_RATIOS = new Set(["16:9", "9:16"]);
const IMAGE_KINDS = new Set(["image", "look", "sheet"]);
const MUSIC_KINDS = new Set(["music", "sfx"]);

const fullPrompt = (p) => [p.prompt, p.character && `Main character: ${p.character.description}`, ...(p.meta?.refs || []).map((r) => `${r.type}: ${r.description}`), p.camera && `Camera: ${p.camera}`].filter(Boolean).join("\n");
const startImg = (p) => p.inputs?.startImage || p.inputs?.vStart || (p.meta?.refs || []).find((r) => r.url)?.url || undefined;
const refImg = (p) => p.inputs?.iRef || p.inputs?.skImg || p.inputs?.chRef || p.inputs?.dmIn || p.inputs?.eRef || p.inputs?.iRef2 || undefined;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// what the engine received, for the person who made it: the words and the settings (never keys or file addresses)
const URLK = /^(image_urls|input_urls|image_input|reference_image_urls|reference_image|video_urls|reference_video_urls|video_list|imageUrls|fileUrls|first_frame_url|last_frame_url|image_url|video_url|audio_url|image)$/;
export function sentView(input) { const o = {}; let pics = 0, vids = 0;
  for (const [k, v] of Object.entries(input || {})) { if (v == null || v === "") continue;
    if (URLK.test(k)) { const n = Array.isArray(v) ? v.length : 1; if (/video/.test(k)) vids += n; else pics += n; continue; }
    if (/^(prompt|text)$/.test(k)) o.prompt = String(v).slice(0, 4000); else if (/^(duration|aspect_ratio|ratio|image_size|aspectRatio|resolution|mode|quality|character_orientation|sound|generate_audio|negative_prompt|stability|speed|generationType|background_source)$/.test(k)) o[k] = typeof v === "object" ? JSON.stringify(v).slice(0, 80) : v; }
  if (pics) o.pictures = pics; if (vids) o.videos = vids; return o; }
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
const ELEVEN_VOICE = { female: "Sarah", male: "George", girl: "Jessica", boy: "Liam" };   // children: a young-sounding voice (the editor also lifts the pitch a little)
// The engine's ElevenLabs voices are picked by voice ID: a bare name ("Sarah") makes the engine fail with "Internal Error".
// Names map to ElevenLabs' standard voices; anything unknown gets the engine's own default voice (always present).
export const KIE_VOICE_DEFAULT = "EkK5I93UQWFDigLMpZcX";
const EL_IDS = { rachel: "21m00Tcm4TlvDq8ikWAM", aria: "9BWtsMINqrJLrRacOk9x", roger: "CwhRBWXzGAHq8TQ4Fs17", sarah: "EXAVITQu4vr4xnSDxMaL", laura: "FGY2WhTYpPnrIDTdsKH5",
  charlie: "IKne3meq5aSn9XLyUdCD", george: "JBFqnCBsd6RMkjVDRZzb", callum: "N2lVS1w4EtoT3dr4eOWO", river: "SAz9YHcvj6GT2YYXdXww", liam: "TX3LPaxmHKxFdv7VOQHJ", charlotte: "XB0fDUnXU5powFXDhCwa",
  alice: "Xb7hH8MSUJpSbSDYk0k2", matilda: "XrExE9yKIg1WjnnlVkGX", will: "bIHbv24MWmeRgasZH58o", jessica: "cgSgspJ2msm6clMCkdW9", eric: "cjVigY5qzO86Huf0OWal", chris: "iP95p4xoKVk53GoZ742B",
  brian: "nPczCjzI2devNBz1zQrb", daniel: "onwK4e9ZLuTAKqWW03F9", lily: "pFZP5JQG7iQjIQuC4Bku", bill: "pqHfZKP75CvOlQylNhV4", adam: "pNInz6obpgDQGcFmaJgB", james: KIE_VOICE_DEFAULT };
export const elVoiceId = (v) => { const s = String(v || "").trim(); return /^[A-Za-z0-9]{18,}$/.test(s) ? s : EL_IDS[s.toLowerCase()] || null; };
const ttsVoice = (p) => elVoiceId(p.meta?.voiceId) || presetVoiceId(p.meta) || elVoiceId(p.meta?.age === "child" ? ELEVEN_VOICE[p.meta?.gender === "male" ? "boy" : "girl"] : ELEVEN_VOICE[p.meta?.gender]) || elVoiceId("Sarah");
// v96: the Voice page's Tone and Speed reach the voice: tone → how steady / expressive (ElevenLabs stability · style), speed
// 0.7–1.2. If the engine refuses these settings, the same voice is asked for again without them (see submit).
const TONE_FEEL = { warm: [.46, .3], deep: [.6, .15], energetic: [.32, .55], calm: [.62, .1], whisper: [.5, .4], narrator: [.66, .18], dramatic: [.3, .6],
  excited: [.32, .55], serious: [.66, .18], sad: [.55, .35], angry: [.3, .6], funny: [.36, .5] };   // (the second line: lib/voice.js DELIVERY feelings)
export function ttsFeel(p) {
  if (p.meta?.plain96) return {};
  const f = TONE_FEEL[p.meta?.tone], r = +p.meta?.rate, sp = Number.isFinite(r) && r > 0 && Math.abs(r - 1) > .01 ? Math.round(clamp(r, .7, 1.2) * 100) / 100 : undefined;
  return drop({ stability: f && f[0], style: f && f[1], speed: sp });
}
// only Turbo / Flash take a language code (multilingual v2 refuses one), and only a two-letter ISO code
const ttsLang = (m, p) => { const l = String(p.meta?.lang || "").toLowerCase().match(/^([a-z]{2})(?:$|[-_])/); return /turbo|flash/.test(m) && l ? l[1] : undefined; };
// the resolution the user picked (720P / 1080P / 2K / 4K for video, 1K / 2K / 4K for images) in each model's own spelling
const pickRes = (p, list, def) => { const r = String(p.meta?.res || "").toLowerCase(); const hit = list.find((x) => x.toLowerCase() === r) || (r === "2k" ? list.find((x) => /1080/.test(x)) : null) || (r === "4k" ? list.find((x) => /1080/.test(x)) : null); return hit || def; };
const TOOL_SCALE = (p) => (String((p.meta?.opt || {}).scale || "2x").startsWith("4") ? "4" : "2");

// Build the market `input` for a studio job — field names and allowed values follow each model's schema
// on docs.kie.ai (cross-checked with the @apicity/kie model registry). Exported for tests.
// v105: the words for a Character Swap on MiniMax H3 — who changes, and everything that must stay exactly as it is
// (v107: target = Image 2 shows the person to replace among several; where = where that person is in this part of the video)
const one = (v, n) => String(v || "").replace(/[\r\n"]+/g, " ").replace(/\s{2,}/g, " ").trim().replace(/[.\s]+$/, "").slice(0, n);
export const swapWords = ({ keep, prod, target, where, who } = {}) => {
  const k = one(keep, 200), w = one(where || who, 160), pi = target ? 3 : 2;
  return (target ? "Replace one person in Video 1 — the person shown in Image 2" + (w ? ": " + w : "") + " — with the person in Image 1: " : "Replace the person in Video 1 with the person in Image 1: ") +
    "the face, hair, skin tone, body shape and clothes of the person in Image 1. " + (target ? "Keep every other person in Video 1 exactly as they are. " : "") +
    "Keep everything else in Video 1 exactly the same, frame by frame: " + (k ? "the products and objects (" + k + "), " : "") +
    "every product and object with its exact shape, size, colour, logo, label and written text; what the person holds and touches; the place, background, light and colours; " +
    "the camera position, movement and framing; the timing; and every movement, gesture, hand position, expression and lip movement of the person. " +
    (prod ? `Image ${pi} shows the product in the video: it must look exactly like Image ${pi}. ` : "") +
    "Do not add, remove, restyle or move anything else. No new text, captions or watermarks.";
};
export function kieInput(model, p) {
  const m = String(model).toLowerCase(), kind = p.kind || "video", inp = p.inputs || {};
  if (/^elevenlabs\/text-to-speech/.test(m)) return drop({ text: p.prompt, voice: ttsVoice(p), language_code: ttsLang(m, p), ...ttsFeel(p) });
  if (/^elevenlabs\/sound-effect/.test(m)) return drop({ text: p.prompt, loop: p.meta?.loop || undefined });
  if (MUSIC_KINDS.has(kind)) return drop({ prompt: p.prompt, custom_mode: false, instrumental: p.meta?.instrumental ?? kind === "sfx" });
  if (/^recraft\/remove-background/.test(m)) return { image: absUrl(inp.bgFg || refImg(p)) };
  if (/^topaz\/image-upscale/.test(m)) return { image_url: absUrl(inp.fin || refImg(p)), upscale_factor: TOOL_SCALE(p) };
  if (/^topaz\/video-upscale/.test(m)) return { video_url: absUrl(inp.fin), upscale_factor: TOOL_SCALE(p) };
  if (/^(kling\/ai-avatar|infinitalk\/)/.test(m)) return { ...drop({ image_url: absUrl(inp.lsV), audio_url: absUrl(inp.lsA), resolution: /infinitalk/.test(m) ? "720p" : undefined }), prompt: p.prompt || (/infinitalk/.test(m) ? "A person talking naturally" : "") };
  if (/^volcengine\/video-to-video-lip-sync/.test(m)) return { mode: "basic", video_url: absUrl(inp.lsV), audio_url: absUrl(inp.lsA) };
  if (IMAGE_KINDS.has(kind)) {
    const ref = refImg(p) ? absUrl(refImg(p)) : undefined, prompt = fullPrompt(p) || (ref ? PICTURE_WORDS.image : "");   // (v100: a picture and no words)
    const more = ["iRef2", "iRef3", "iRef4"].map((k) => inp[k]).filter((u) => u && u !== refImg(p)).map(absUrl);   // extra angles of the same face (avatars) · the faces of the characters in the picture
    if (/^nano-banana-2-lite/.test(m)) return drop({ prompt, image_urls: ref ? [ref, ...more] : undefined, aspect_ratio: snapAR(p.aspect, ["1:1", "16:9", "9:16", "4:3", "3:4", "4:5", "5:4", "2:3", "3:2", "21:9"]) });
    if (/^z-image/.test(m)) return { prompt: prompt.slice(0, 1000), aspect_ratio: snapAR(p.aspect, ["1:1", "4:3", "3:4", "16:9", "9:16"]), nsfw_checker: true };
    if (/^seedream\/5-lite/.test(m)) return drop({ prompt, image_urls: ref ? [ref, ...more] : undefined, aspect_ratio: snapAR(p.aspect, ["1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "21:9"]), quality: /4k/i.test(p.meta?.res || "") ? "high" : "basic" });
    if (/nano-banana-(2|pro)/.test(m)) return drop({ prompt, image_input: ref ? [ref, ...more] : undefined, aspect_ratio: snapAR(p.aspect, ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]), resolution: pickRes(p, ["1K", "2K", "4K"], "2K") });
    if (/nano-banana-edit/.test(m)) return drop({ prompt, image_urls: ref ? [ref, ...more] : undefined, aspect_ratio: snapAR(p.aspect, ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]) });
    if (/^gpt-image-2/.test(m)) return drop({ prompt, input_urls: /image-to-image/.test(m) && ref ? [ref, ...more] : undefined, aspect_ratio: snapAR(p.aspect, ["1:1", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "9:16", "16:9"]), resolution: pickRes(p, ["1K", "2K", "4K"], "2K") });
    if (/^flux-2\//.test(m)) return drop({ prompt, input_urls: /image-to-image/.test(m) && ref ? [ref, ...more] : undefined, aspect_ratio: snapAR(p.aspect, ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"]), resolution: pickRes(p, ["1K", "2K"], "2K") });
    if (/^seedream\//.test(m)) return drop({ prompt, image_urls: /edit|image-to-image/.test(m) && ref ? [ref, ...more] : undefined, aspect_ratio: snapAR(p.aspect, ["1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "21:9"]), quality: "high" });
    if (/^qwen3\//.test(m)) return drop({ prompt, image_urls: /image-to-image/.test(m) && ref ? [ref] : undefined, image_size: snapAR(p.aspect, ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"]) });
    if (/^ideogram\//.test(m)) return drop({ prompt, image_size: { "1:1": "square_hd", "16:9": "landscape_16_9", "9:16": "portrait_16_9", "4:3": "landscape_4_3", "3:4": "portrait_4_3" }[snapAR(p.aspect, ["1:1", "16:9", "9:16", "4:3", "3:4"])] });
    if (/^google\/imagen/.test(m)) return drop({ prompt, aspect_ratio: snapAR(p.aspect, ["1:1", "16:9", "9:16", "3:4", "4:3"]) });
    if (/^grok-imagine/.test(m)) return drop({ prompt, image_urls: /image-to-image/.test(m) && ref ? [ref] : undefined, aspect_ratio: snapAR(p.aspect, ["2:3", "3:2", "1:1", "16:9", "9:16"]) });
    return drop({ prompt, aspect_ratio: p.aspect || undefined, ...(ref ? { image_urls: [ref, ...more] } : {}) });
  }
  // video (and chapter / extend)
  // (v100) a start picture and no words: the engine is still told what to do with it — most video engines refuse an empty prompt
  const img0 = startImg(p), img = img0 ? absUrl(img0) : undefined, end = inp.vEnd ? absUrl(inp.vEnd) : undefined, dur = Math.round(+p.dur || 5), prompt = fullPrompt(p) || (img0 ? PICTURE_WORDS.video : ""), audio = !!(p.meta?.audio);
  // Motion Control: the character in the photo performs the movement of the video (orientation: follow the video or the photo)
  // the engine needs a prompt: the client's words (if any) plus what Motion Control is for
  if (/motion-control/.test(m)) return drop({ prompt: (String(p.prompt || "").trim() ? String(p.prompt).trim().replace(/[.\s]*$/, ". ") : "") + "The person in the picture performs exactly the same movements as the person in the video, natural and smooth.", input_urls: [absUrl(inp.mcChar || img0)], video_urls: [absUrl(inp.mcMove)], mode: pickRes(p, ["720p", "1080p"], "720p"),
    character_orientation: (p.meta?.orient || (/kling-2\.6/.test(m) ? "image" : "video")) === "image" ? "image" : "video", ...(/kling-3\.0/.test(m) ? { background_source: "input_video" } : {}) });
  // v93 Character Swap: the person in the video is replaced by the person in the photo — the video's place, objects, light,
  // camera and every movement stay (the engine takes the video and the photo only; no prompt)
  if (/^wan\/2-2-animate-(replace|move)/.test(m)) return drop({ video_url: absUrl(inp.mcMove), image_url: absUrl(inp.mcChar || img0), resolution: pickRes(p, ["480p", "580p", "720p"], "720p") });
  // v105 Character Swap on MiniMax H3 (reference-to-video): Video 1 = the client's video (what happens, the place, the products),
  // Image 1 = the new person, Image 2 = the product photo (optional). H3 keeps what the words tell it to keep, so the words list
  // it: the products the text AI saw in the video (meta.mcKeep), their look and writing, the place, light, camera and every movement
  // (v107: with several people, Image 2 = the person to replace — cut from the frame the client tapped, or their picture — and the
  // product moves to Image 3; the words say where that person is in this part)
  if (/^minimax-h3\/reference-to-video/.test(m)) {
    const prod = inp.mcProd ? absUrl(inp.mcProd) : null, target = inp.mcWho ? absUrl(inp.mcWho) : null;
    return drop({ prompt: swapWords({ keep: p.meta?.mcKeep, prod: !!prod, target: !!target, where: p.meta?.swapWhere, who: p.meta?.swapWho }),
      reference_image_urls: [absUrl(inp.mcChar || img0), ...(target ? [target] : []), ...(prod ? [prod] : [])], reference_video_urls: [absUrl(inp.mcMove)],
      aspect_ratio: "adaptive", duration: clamp(dur, 4, 15), resolution: pickRes(p, ["768P", "2K"], "2K") });
  }
  if (/^kling\/v3-turbo/.test(m)) return img ? { prompt, image_urls: [img], duration: String(clamp(dur, 3, 15)), resolution: pickRes(p, ["720p", "1080p"], "720p") }
    : { prompt, aspect_ratio: snapAR(p.aspect, ["16:9", "9:16", "1:1"]), duration: String(clamp(dur, 3, 15)), resolution: pickRes(p, ["720p", "1080p"], "720p") };
  if (/^gemini-omni-video/.test(m)) return drop({ prompt, image_urls: img ? [img] : undefined, duration: snapDur(dur, ["4", "6", "8", "10"]), aspect_ratio: snapAR(p.aspect, ["16:9", "9:16"]), resolution: pickRes(p, ["720p", "1080p", "4k"], "720p") });
  if (/grok-imagine-video-1-5/.test(m)) return drop({ prompt: prompt || undefined, image_urls: img ? [img] : undefined, duration: clamp(dur, 1, 15), aspect_ratio: snapAR(p.aspect, ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"]), resolution: pickRes(p, ["480p", "720p"], "720p") });
  if (/^happyhorse\//.test(m)) return img ? drop({ prompt: prompt || undefined, image_urls: [img], duration: clamp(dur, 3, 15) })
    : drop({ prompt, aspect_ratio: snapAR(p.aspect, ["16:9", "9:16", "1:1", "4:3", "3:4"]), duration: clamp(dur, 3, 15), resolution: pickRes(p, ["720p", "1080p"], "1080p") });
  if (/^kling-3\.0\/video/.test(m)) return drop({ prompt, image_urls: img ? [img, ...(end ? [end] : [])] : undefined, sound: audio, duration: String(clamp(dur, 3, 15)), aspect_ratio: img ? undefined : snapAR(p.aspect, ["16:9", "9:16", "1:1"]), mode: /4k/i.test(p.meta?.res || "") ? "4K" : /1080|2k/i.test(p.meta?.res || "") || p.meta?.quality === "best" || +p.meta?.fps >= 60 ? "pro" : "std", multi_shots: false, multi_prompt: [], kling_elements: [] });
  if (/^kling-2\.6\/text-to-video/.test(m)) return { prompt, sound: audio, aspect_ratio: snapAR(p.aspect, ["16:9", "9:16", "1:1"]), duration: snapDur(dur, ["5", "10"]) };
  if (/^kling-2\.6\/image-to-video/.test(m)) return { prompt, image_urls: [img], sound: audio, duration: snapDur(dur, ["5", "10"]) };
  if (/kling/.test(m)) return drop({ prompt, duration: dur >= 10 ? "10" : "5", sound: p.meta?.audio ?? undefined, aspect_ratio: img ? undefined : snapAR(p.aspect, ["16:9", "9:16", "1:1"]), ...(img ? { image_urls: [img] } : {}) });
  if (/seedance/.test(m)) return drop({ prompt, first_frame_url: img, last_frame_url: end, generate_audio: audio, resolution: pickRes(p, /mini/.test(m) ? ["480p", "720p"] : ["480p", "720p", "1080p", "4k"], "720p"), aspect_ratio: img ? "adaptive" : snapAR(p.aspect, ["1:1", "4:3", "3:4", "16:9", "9:16", "21:9"]), duration: clamp(dur, 4, 15), web_search: false });
  if (/minimax-h3/.test(m)) return drop({ prompt, duration: dur >= 10 ? 10 : 6, first_frame_url: img, last_frame_url: end, aspect_ratio: img ? undefined : snapAR(p.aspect, ["16:9", "9:16", "1:1"]) });
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

// The API lives on api.kie.ai. A Base URL pointing at the kie.ai website (or with /api/v1 pasted on the end)
// would answer every call with the site's 404 page, so it is corrected here. Exported for tests.
export function kieBase(u) {
  let b = String(u || "").trim().replace(/\/+$/, ""); if (!b) return "https://api.kie.ai";
  if (!/^https?:\/\//i.test(b)) b = "https://" + b;
  b = b.replace(/\/api(\/v\d+)?(\/.*)?$/i, "");
  try { const h = new URL(b).hostname.toLowerCase(); if (/(^|\.)kie\.ai$/.test(h) && h !== "api.kie.ai") return "https://api.kie.ai"; } catch { return "https://api.kie.ai"; }
  return b;
}
export const kie = (model) => {
  const c = cfg("kie"), base = kieBase(c.baseUrl);
  const h = { Authorization: "Bearer " + c.apiKey, "Content-Type": "application/json" };
  const call = async (path, init) => {
    const r = await fetch(base + path, { ...init, headers: h });
    const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = { raw: t }; }
    // Kie answers HTTP 200 with its own code in the body (401 bad key, 402 no credits, 422 bad input, 429 rate limit…)
    const code = !r.ok ? r.status : (d.code && d.code !== 200 ? d.code : 0);
    // an HTML page instead of JSON: the Base URL is a website, not the Kie API
    if (/^\s*</.test(t)) throw Object.assign(new Error(`Kie AI ${code || r.status}: ${base} answered with a web page, not the API. Clear Admin → AI providers → Kie AI → Base URL (or set it to https://api.kie.ai)`), { status: code || r.status, noFallback: true });
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
        // v94: "Extend shot" on a clip Veo made here: Veo continues that same video (POST /api/v1/veo/extend {taskId, prompt, model};
        // the result is read like any Veo task). The task id is the user's own earlier job's, found by the server (never sent by the
        // browser). If Veo refuses (e.g. a 1080p upgrade can't be extended), a new video starts from the clip's last frame instead.
        const vt = p.meta?.veoTask;
        if (vt) {
          try {
            const ext = { taskId: vt, prompt: fullPrompt(p), model: { veo3: "quality", veo3_fast: "fast", veo3_lite: "lite" }[mo] || "fast" };
            const d = await call("/api/v1/veo/extend", { method: "POST", body: JSON.stringify(drop({ ...ext, callBackUrl: p.callbackUrl })) });
            if (d.taskId) return { remoteId: "veo:" + d.taskId, sent: sentView(ext) };
          } catch (e) { if ([401, 402].includes(e.status)) throw e; console.warn("Veo extend refused (" + String(e.message).slice(0, 160) + ") → a new video from the last frame"); }
        }
        const d = await call("/api/v1/veo/generate", { method: "POST", body: JSON.stringify(drop({ prompt: fullPrompt(p), model: mo, aspect_ratio: VEO_RATIOS.has(p.aspect) ? p.aspect : p.aspect && AR(p.aspect) > 1.5 ? "16:9" : "Auto", imageUrls: img ? [img] : undefined, callBackUrl: p.callbackUrl, ...extraInputs(c, mo) })) });
        return { remoteId: "veo:" + d.taskId, sent: sentView({ prompt: fullPrompt(p), aspect_ratio: VEO_RATIOS.has(p.aspect) ? p.aspect : "Auto", imageUrls: img ? [img] : undefined }) };
      }
      if (mo.startsWith("mj:")) {  // Midjourney through Kie: POST /api/v1/mj/generate, GET /api/v1/mj/record-info
        const ref = refImg(p), ar = p.aspect && /^\d+:\d+$/.test(p.aspect) ? p.aspect : "1:1";
        const d = await call("/api/v1/mj/generate", { method: "POST", body: JSON.stringify(drop({ taskType: ref ? "mj_img2img" : "mj_txt2img", prompt: fullPrompt(p), speed: "fast", aspectRatio: ar, version: mo.slice(3) || "7", fileUrls: ref ? [ref] : undefined, callBackUrl: p.callbackUrl, ...extraInputs(c, mo) })) });
        return { remoteId: "mj:" + d.taskId, sent: sentView({ prompt: fullPrompt(p), aspect_ratio: ar, image: ref }) };
      }
      // lip-sync from a typed script: make the voice with ElevenLabs on Kie first, then animate the face with it
      if (/^(kling\/ai-avatar|infinitalk\/|volcengine\/video-to-video-lip-sync)/.test(mo) && !(p.inputs || {}).lsA && p.prompt) {
        p = { ...p, prompt: "", inputs: { ...(p.inputs || {}), lsA: await lipVoice(p, call) } };
      }
      const suno = mo.startsWith("suno:");
      const apiModel = suno ? "ai-music-api/generate" : mo;
      const input = { ...kieInput(apiModel, p), ...(suno ? { model: mo.slice(5) || "V5" } : {}), ...extraInputs(c, mo) };
      let d; try { d = await call("/api/v1/jobs/createTask", { method: "POST", body: JSON.stringify(drop({ model: apiModel, callBackUrl: p.callbackUrl, input })) }); }
      catch (e) {   // v96: a voice whose tone / speed settings the engine refuses → the same voice without them
        // v105: a resolution the engine refuses (e.g. "2K") → the same request at the engine's own default
        const res = input.resolution != null && [400, 422].includes(e.status) && /resolution/i.test(e.message);
        if (!res && !(/^elevenlabs\/text-to-speech/.test(apiModel) && (input.stability != null || input.speed != null) && [400, 422].includes(e.status))) throw e;
        if (res) delete input.resolution; else for (const k of ["stability", "style", "speed"]) delete input[k];
        d = await call("/api/v1/jobs/createTask", { method: "POST", body: JSON.stringify(drop({ model: apiModel, callBackUrl: p.callbackUrl, input })) });
      }
      return { remoteId: "m:" + d.taskId, sent: sentView(input) };
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

// The length each engine model really makes (kieInput sends exactly this): the job is priced for the clip it will get.
export function kieDur(model, dur) {
  const m = String(model || "").toLowerCase(), d = Math.round(+dur || 5);
  if (VEO.has(m)) return 8;
  if (/motion-control|^wan\/2-2-animate/.test(m)) return clamp(d, 3, 30);   // as long as the movement video (up to 30 s)
  if (/^minimax-h3\/reference-to-video/.test(m)) return clamp(d, 4, 15);   // v105 Character Swap: as long as the video, 4–15 s
  if (/^kling\/v3-turbo/.test(m)) return clamp(d, 3, 15);
  if (/^gemini-omni-video/.test(m)) return +snapDur(d, ["4", "6", "8", "10"]);
  if (/grok-imagine-video-1-5/.test(m)) return clamp(d, 1, 15);
  if (/^happyhorse\//.test(m)) return clamp(d, 3, 15);
  if (/^kling-3\.0\/video/.test(m)) return clamp(d, 3, 15);
  if (/^kling-2\.6\//.test(m)) return +snapDur(d, ["5", "10"]);
  if (/kling/.test(m)) return d >= 10 ? 10 : 5;
  if (/seedance/.test(m)) return clamp(d, 4, 15);
  if (/minimax-h3|hailuo/.test(m)) return d >= 10 ? 10 : 6;
  if (/^wan\//.test(m)) return clamp(d, 2, 15);
  if (/grok-imagine/.test(m)) return clamp(d, 6, 30);
  if (/pixverse/.test(m)) return clamp(d, 1, 15);
  return d;
}
// Built-in Kie model for each studio model, so every model works as soon as the Kie key is saved
// (an id set in Admin → Models, or the admin's default model, still wins). Image-to-video / edit variants are
// picked when the job carries a start frame or a reference image.
export const KIE_BUILTIN = {
  video: { kling40: "kling-3.0/video", kling30: "kling-3.0/video", kling: "kling-2.6/text-to-video", seedance25: "bytedance/seedance-2-5", seedance20: "bytedance/seedance-2",
    seedance: "bytedance/seedance-2-fast", hailuoh3: "minimax-h3/text-to-video", hailuo: "minimax-h3/text-to-video", wan30: "wan/3-0-video", wan22: "wan/2-7-text-to-video",
    qwenwan: "wan/2-7-text-to-video", hunyuan: "wan/2-7-text-to-video", ltx23: "veo3_fast", ltxfast: "bytedance/seedance-2-fast", veo: "veo3", veofast: "veo3_fast", veo31: "veo3", veo31f: "veo3_fast", grok: "grok-imagine/text-to-video", pixverse6: "pixverse-v6/text-to-video", kling26: "kling-2.6/text-to-video", wan27: "wan/2-7-text-to-video", auto: "bytedance/seedance-2-fast",
    kling30t: "kling/v3-turbo-text-to-video", seedance2mini: "bytedance/seedance-2-mini", gemomni: "gemini-omni-video", grok15: "grok-imagine-video-1-5-preview", happyhorse: "happyhorse/text-to-video",
    mc26: "kling-2.6/motion-control", mc30: "kling-3.0/motion-control", mcswap: "minimax-h3/reference-to-video" },   // v105: the swap on MiniMax H3 (was wan/2-2-animate-replace)
  image: { nano: "nano-banana-2", nanopro: "nano-banana-pro", img20: "gpt-image-2-text-to-image", img25: "seedream/4.5-text-to-image", qwen: "qwen3/text-to-image", qwen2: "qwen3/text-to-image",
    flux: "flux-2/pro-text-to-image", sdxl: "seedream/4.5-text-to-image", dotimg: "nano-banana-2", mj: "mj:7", seedream5: "seedream/5-pro-text-to-image", imagen4: "google/imagen4-ultra", ideogram3: "ideogram/v3-text-to-image", grokimg: "grok-imagine/text-to-image", flux2: "flux-2/pro-text-to-image", auto: "nano-banana-2",
    nano2lite: "nano-banana-2-lite", seedream5lite: "seedream/5-lite-text-to-image", zimage: "z-image" },
};
const I2V = { "kling-2.6/text-to-video": "kling-2.6/image-to-video", "wan/2-7-text-to-video": "wan/2-7-image-to-video", "minimax-h3/text-to-video": "minimax-h3/image-to-video", "grok-imagine/text-to-video": "grok-imagine/image-to-video", "pixverse-v6/text-to-video": "pixverse-v6/image-to-video",
  "kling/v3-turbo-text-to-video": "kling/v3-turbo-image-to-video", "happyhorse/text-to-video": "happyhorse/image-to-video" };
const EDIT = { "gpt-image-2-text-to-image": "gpt-image-2-image-to-image", "flux-2/pro-text-to-image": "flux-2/pro-image-to-image", "seedream/4.5-text-to-image": "seedream/4.5-edit", "qwen3/text-to-image": "qwen3/image-to-image", "seedream/5-pro-text-to-image": "seedream/5-pro-image-to-image", "grok-imagine/text-to-image": "grok-imagine/image-to-image" };
// the voice an avatar speaks with: the site's own ElevenLabs key first (natural voice, saved in /media), then the engine's
// ElevenLabs voices — each tried twice, multilingual v2 then turbo 2.5 — so one busy voice service doesn't fail the avatar
async function lipVoice(p, call) {
  const errs = [];
  if (cfg("elevenlabs").apiKey) {
    try { const { speak, polish } = await import("../lib/voice.js"), { saveBuffer } = await import("../lib/media.js"), fs = await import("fs");
      const sp = await speak(p.prompt, { lang: p.meta?.lang, voice: { id: ttsVoice(p), name: p.meta?.voiceId || p.meta?.gender || "voice", gender: p.meta?.gender }, emotion: p.meta?.tone });
      const fin = await polish(sp.file, { ext: ".mp3", room: false }), out = saveBuffer(fs.readFileSync(fin), ".mp3"); fs.unlink(fin, () => {}); if (sp.temp) fs.unlink(sp.file, () => {});
      return out.url; } catch (e) { errs.push("ElevenLabs: " + e.message); }
  }
  // the avatar's own voice on multilingual v2, then on turbo 2.5, then the engine's default voice (always on the engine)
  const own = ttsVoice(p), tries = [["elevenlabs/text-to-speech-multilingual-v2", own], ["elevenlabs/text-to-speech-turbo-2-5", own], ["elevenlabs/text-to-speech-multilingual-v2", KIE_VOICE_DEFAULT]];
  for (const [tm, vid] of tries) {
    try {
      const t = await call("/api/v1/jobs/createTask", { method: "POST", body: JSON.stringify({ model: tm, input: { ...kieInput(tm, { ...p, kind: "voice", meta: { ...(p.meta || {}), voiceId: vid, plain96: tm !== tries[0][0] || vid !== own } }), ...extraInputs(cfg("kie"), tm) } }) });
      for (let i = 0; i < 80; i++) { await new Promise((r) => setTimeout(r, i ? 3000 : 1200)); const d = await call("/api/v1/jobs/recordInfo?taskId=" + encodeURIComponent(t.taskId), { method: "GET" }); const st = String(d.state || "").toLowerCase();
        if (st === "success") { const audio = kieResult(d); if (audio) return audio; throw new Error("finished without audio"); } if (st === "fail") throw new Error(d.failMsg || "failed"); }
      throw new Error("took too long");
    } catch (e) { errs.push(tm.split("/")[1] + ": " + String(e.message).slice(0, 120)); await new Promise((r) => setTimeout(r, 2500)); }
  }
  // the backup voice on our own server (free), so the avatar still speaks
  try { const { piperOn, backupVoiceFile } = await import("./piper.js"); if (piperOn()) return await backupVoiceFile(p.prompt, p.meta?.lang); } catch (e) { errs.push("backup voice: " + String(e.message).slice(0, 120)); }
  throw Object.assign(new Error("The voice service is busy — the avatar wasn't charged (" + errs.join(" · ") + ")"), { type: "provider", retryable: false, noFallback: true,
    userMsg: "The avatar's voice couldn't be made right now — nothing was charged. Try again in a minute, or add a voice file." });
}
export const _lipVoice = lipVoice;   // for tests
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

// The image-to-video / edit variant of a Kie model when the job carries a start frame / reference picture — also for ids typed
// in Admin (a text-to-video id would ignore the start frame, so "Extend shot" or a picture-to-video made a new scene).
export function kieVariant(m, cap, body = {}) {
  if (!m) return m;
  if (cap === "image" || IMAGE_KINDS.has(body.kind)) return refImg(body) && EDIT[m] ? EDIT[m] : m;
  return cap === "video" && startImg(body) && I2V[m] ? I2V[m] : m;
}

// Default Kie model for a capability, if the admin set one (used when no direct provider is connected).
export function kieDefault(cap, kind) {
  if (!configured("kie")) return null;
  const c = cfg("kie");
  return cap === "video" ? c.videoModel || null : cap === "image" ? c.imageModel || null : cap === "music" || MUSIC_KINDS.has(kind) ? c.musicModel || null : null;
}
