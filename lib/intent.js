// v96: every choice on a create page reaches the engine.
// The field audit (each option changed one at a time, the engine's request compared) found that the Video page's Style,
// Camera move, Video type, Motion strength, "What to avoid" and voice-over line + voice, and the Images page's Style, were
// sent with each job but never told to any engine: only the words, length, shape and engine were (the Story page already
// writes its choices into each chapter's words). They now become plain
// English words after the prompt, for every engine (after the prompt is put into English; a voice-over line stays as
// written, in quotes, so it is spoken as typed). A voice-over also turns the video's sound on — a line can't be heard in a
// silent video. Jobs that write their own full prompt (sketch, Motion Control, Extend shot, storyboard parts) are left as
// they are; a long video split into parts gets the words in every part.
import { jobHooks } from "./jobs.js";

export const STYLE = {
  // Video page
  realistic: "Photorealistic live-action footage: real materials, natural light, real camera optics",
  cinematic: "Cinematic film look: anamorphic framing, rich contrast, filmic colour grade, shallow depth of field",
  anime: "Japanese anime style: cel shading, clean line art, expressive faces",
  anim3d: "3D animated feature-film style: stylised CG characters, soft global illumination",
  anim2d: "2D hand-drawn animation style: flat colours, clean outlines",
  clay: "Claymation stop-motion style: handmade clay figures with fingerprints, slightly stepped motion",
  comic: "Comic-book style: bold ink outlines, halftone shading, vivid flat colours",
  watercolor: "Watercolor painting style: soft bleeding edges, paper texture",
  vintage: "Vintage film look: 16 mm grain, faded warm colours, slight gate weave",
  cyberpunk: "Cyberpunk style: neon-lit night, rain-slick streets, magenta and cyan glow",
  // Images page
  photo: "Photorealistic photograph: real materials, natural light, sharp detail",
  still: "Cinematic film still: anamorphic framing, filmic colour grade, shallow depth of field",
  render3d: "High-end 3D render: physically based materials, studio lighting",
  illustration: "Digital illustration: clean shapes, painterly shading",
  productshot: "Professional product photography: seamless studio background, softbox lighting, crisp reflections",
  concept: "Concept art: painterly, atmospheric, cinematic composition",
  portrait: "Portrait photograph: 85 mm lens, shallow depth of field, soft flattering light",
};
export const CAMERA = {
  static: "Locked-off static camera, no camera movement",
  pan: "The camera pans slowly sideways across the scene",
  tilt: "The camera tilts slowly up the scene",
  dollyIn: "Slow dolly-in: the camera moves steadily toward the subject",
  dollyOut: "Slow dolly-out: the camera pulls back from the subject",
  zoomIn: "Smooth zoom in toward the subject",
  crashZoom: "A sudden fast crash zoom onto the subject",
  dollyZoom: "Dolly zoom (vertigo effect): the camera moves in while zooming out, the background stretches",
  orbit: "The camera orbits 360° around the subject",
  crane: "Crane shot: the camera rises upward, revealing the scene",
  aerial: "Aerial drone shot from high above",
  fpv: "FPV drone shot: fast, fluid, flying through the scene",
  bullet: "Bullet time: the action freezes while the camera sweeps around it",
  tracking: "Tracking shot: the camera follows the subject as it moves",
  handheld: "Handheld camera with a natural slight shake",
};
export const TYPE = {
  ugc: "an authentic UGC social video filmed on a phone", ad: "a polished commercial", trailer: "a film trailer", music: "a music video",
  story: "a short film", explainer: "an explainer video", doc: "a documentary", reel: "a social media reel", product: "a product showcase",
  avatar: "a talking presenter video", realestate: "a real-estate walkthrough tour", food: "a food and recipe video",
};
// the Video page's voices (VOICE_PRESETS in the page)
const DIALECT = { msa: "Modern Standard Arabic", najdi: "Saudi Najdi Arabic", hijazi: "Saudi Hijazi Arabic", gulf: "Gulf Arabic", egy: "Egyptian Arabic", lev: "Levantine Arabic", enUS: "American English", enUK: "British English" };
const AGE = { child: "child's", teen: "teenage", young: "young adult", adult: "adult", mid: "middle-aged", senior: "older" };
const VOICES = { v1: ["najdi", "male", "mid", "deep"], v2: ["najdi", "female", "young", "warm"], v3: ["msa", "male", "adult", "narrator"], v4: ["hijazi", "female", "teen", "energetic"],
  v5: ["gulf", "male", "senior", "calm"], v6: ["egy", "female", "adult", "energetic"], v7: ["msa", "male", "child", "energetic"], v8: ["enUS", "female", "young", "warm"],
  v9: ["enUK", "male", "senior", "narrator"], v10: ["lev", "female", "young", "energetic"] };
export function voiceWords(id) {
  const v = VOICES[id]; if (!v) return "";
  const [d, g, a, t] = v; return `a ${t === "narrator" ? "narrator's" : t} ${AGE[a]} ${g} voice in ${DIALECT[d]}`;
}
export function motionWords(m) {
  const n = +m; if (!Number.isFinite(n) || (n > 40 && n < 61)) return "";   // the middle of the slider = the engine's own
  return n <= 20 ? "Very little motion: calm, almost still" : n <= 40 ? "Gentle, slow motion" : n <= 80 ? "Lively, energetic motion" : "Fast, intense, dynamic motion";
}
const clean = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
// the words each choice adds (exported for tests)
export function intentLines(kind, meta = {}, framed = false) {
  const out = [], st = framed ? null : STYLE[meta.style];   // (v113: a first / end frame sets the look — no style line then)
  if (kind === "video") {
    if (TYPE[meta.type]) out.push(`Made as ${TYPE[meta.type]}.`);
    if (st) out.push(st + ".");
    if (CAMERA[meta.camera]) out.push(CAMERA[meta.camera] + ".");
    const mw = motionWords(meta.motion); if (mw) out.push(mw + ".");
    const vo = clean(meta.vo, 600).replace(/"/g, "”");
    if (vo) { const vw = voiceWords(meta.voice); out.push(`Voice-over${vw ? ", spoken by " + vw : ""}: "${vo}"`); }
  } else if (kind === "image" && st) out.push(st + ".");
  const neg = clean(meta.neg, 300); if (neg) out.push(`Avoid: ${neg.replace(/[.\s]*$/, "")}.`);
  return out;
}
const OWN_PROMPT = (m) => m.sketch || m.sk91 || m.sk94e || m.motion83 || m.extend94 || m.edCmd || Array.isArray(m.shots) || m.words96;
jobHooks.before.push(async (u, body) => {
  if (!body || !["video", "image"].includes(body.kind) || !body.meta || OWN_PROMPT(body.meta)) return;
  const fr = frames113(body), lines = intentLines(body.kind, body.meta, body.kind === "video" && (fr.first || fr.end)); if (!lines.length) return;
  const p = String(body.prompt || "").trim(); if (!p) return;   // an empty request is refused further on, nothing added
  body.prompt = p.replace(/[.\s]*$/, ".") + "\n" + lines.join("\n");
  body.meta = { ...body.meta, words96: true, ...(clean(body.meta.vo, 600) ? { audio: true } : {}) };
});

// v113: a video made from a first frame (and/or to an end frame) says so first in its words. The engine got the picture as its
// first frame, but nothing in the words tied the video to it, and a style line ("2D hand-drawn animation…") pulled it away
// from the picture: the owner's video didn't follow the house in the first frame. Now the words say the video starts (ends) on
// that picture with its place, subject, composition, colours, light and look; the picture sets the look, so the page's Style
// is left out while a frame is set. Jobs that write their own words (sketch, Motion Control, Extend shot, storyboard parts)
// and the later parts of a long video (they start from the part before) are left as they are.
export const frames113 = (b) => { const i = b.inputs || {}; return { first: !!(i.startImage || i.vStart), end: !!i.vEnd }; };
const KEEP = "the same place, subject, people, composition, colours, light and visual style";
export function frameWords(first, end, dur) {
  if (first && end) return `The video starts exactly on the first-frame picture and ends exactly on the end-frame picture${dur ? ` ${dur} seconds later` : ""}, with ${KEEP} as those pictures; everything moves smoothly and naturally from the first to the last.`;
  if (first) return `The video starts exactly on the first-frame picture and continues from it, with ${KEEP} as that picture; everything in it moves on naturally from there.`;
  if (end) return `The video ends exactly on the end-frame picture, with ${KEEP} as that picture; everything moves naturally toward it.`;
  return "";
}
const OWN113 = (m) => m.sketch || m.sk91 || m.sk94e || m.motion83 || m.extend94 || m.edCmd || Array.isArray(m.shots);
jobHooks.before.push(async (u, body) => {
  if (!body || body.kind !== "video" || OWN113(body.meta || {}) || body.chainFrom || body.chainAfter || +body.meta?.part > 1 || body.meta?.frames113) return;
  const fr = frames113(body), w = frameWords(fr.first, fr.end, Math.round(+body.dur || 0)); if (!w) return;
  body.prompt = w + (String(body.prompt || "").trim() ? "\n" + String(body.prompt).trim() : "");
  body.meta = { ...(body.meta || {}), frames113: true };
});
