// v161: Kling 4.0 on the AI engine (Kie: kling-4.0/reference-to-video and kling-4.0/keyframe-to-video, 3–30 s, 720p / 1080p).
// The agents, the characters and the voices work as one system: each @character goes to the engine with their face(s) and their
// own voice (a voice from the library, or the customer's clip), and the engine makes the picture, the speech, the lip-sync and the
// sound in one pass — no first-frame picture before it and no voice step after it.
//
// Request shape (docs.kie.ai/market/kling/v4-reference-to-video · v4-keyframe-to-video, cross-checked with the @apicity/kie
// client's schema, Oct 2026):
//   reference-to-video  {prompt ≤8000, duration 3–30, resolution 720p|1080p, aspect_ratio auto|16:9|9:16|1:1|21:9,
//                        image_urls ≤10 (@image_1…), elements ≤7 {name, image_urls 2–4, tag, voice_url}, voices ≤3 {name, audio_url}}
//                       every @mention in the prompt must name a material of the request; 15 materials at most
//   keyframe-to-video   {prompt, duration, resolution, aspect_ratio (only without frames), first_frame_url, last_frame_url}
// Pure functions: providers/kie.js builds the engine input with them, lib/jobs.js tags the words before they are put into English.
import { refsOf130, tagWords130, tagged130 } from "./refs130.js";

export const KLING4 = /^kling-4\.0\//;
export const K4_MODEL = "kling40";                                    // the studio's model id
const NAME_OK = /^[一-龥A-Za-z0-9_]{1,20}$/;
const RESERVED = /^(?:(?:image|video|keyframe|object|audio)_\d+|first_frame|last_frame)$/i;
const MEDIA = /^(https?:\/\/|\/media\/)[^\s"'<>]{1,600}$/;
const VOICE_ID = /^[A-Za-z0-9]{8,40}$/;
const STYLE_WORDS = /\b(anime|manga|cartoons?|animated|animation|pixar|ghibli|claymation|stop[- ]motion|watercolou?rs?|oil painting|painting|pencil|sketch|comic|pixel[- ]art|low[- ]poly|illustration|photo-?realistic|realistic|live[- ]action)\b/i;
const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const one = (v, n) => String(v || "").replace(/[\r\n"]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, n);

// the page's cast → [{name, faces, voice, voiceUrl?}] (at most 3, each with a face; a voice the server found stays)
export function cleanCast161(list) {
  return (Array.isArray(list) ? list : []).slice(0, 3).map((c) => ({
    name: one(c && c.name, 40).replace(/[#@\\]/g, ""),
    faces: [...new Set((Array.isArray(c && c.faces) ? c.faces : []).filter((u) => typeof u === "string" && MEDIA.test(u)))].slice(0, 4),
    voice: VOICE_ID.test(String((c && c.voice) || "")) ? String(c.voice) : "",
    ...(c && typeof c.voiceUrl === "string" && MEDIA.test(c.voiceUrl) ? { voiceUrl: c.voiceUrl } : {}),
  })).filter((c) => c.name && c.faces.length);
}
const castOf = (p) => cleanCast161(p && p.meta && p.meta.cast161);
export const isK4Job161 = (body) => body?.kind === "video" && (body.model === K4_MODEL || (Array.isArray(body.meta?.partModels) && body.meta.partModels.includes(K4_MODEL)));

// createJob, before the words are put into English: each "@Name" of a character becomes #cast1, #cast2… (a translation leaves those as
// they are — "@يونس" could come back as "@Younes" and no longer name its pictures). The library keeps the client's own words.
// Only a Kling 4.0 job keeps the cast; a long video by the agents keeps Kling 4.0 in every part (the faces and voices go with it).
export function cast161(body) {
  const m = body?.meta; if (!m || !("cast161" in m || "voice161" in m)) return;
  if (!isK4Job161(body)) { const { cast161: a, voice161: b, ...rest } = m; body.meta = rest; return; }
  const cast = cleanCast161(m.cast161).map(({ voiceUrl, ...c }) => c);   // (a voice address is the server's to find, never the page's)
  const v = m.voice161 && typeof m.voice161 === "object" ? m.voice161 : null;
  const voice161 = v && (VOICE_ID.test(String(v.voice || "")) || v.clip) ? { ...(VOICE_ID.test(String(v.voice || "")) ? { voice: String(v.voice) } : {}), ...(v.clip ? { clip: 1 } : {}), ...(v.who ? { who: one(v.who, 40) } : {}) } : undefined;
  const said = String(body.prompt || "");
  if (cast.length) { if (said.trim() && !body.title) body.title = said.trim().slice(0, 300);
    // (only "@Name": the same name inside a line someone says stays a name)
    let t = said; cast.forEach((c, i) => { t = t.replace(new RegExp("(^|[^\\p{L}\\p{N}_#])@" + reEsc(c.name) + "(?=$|[^\\p{L}\\p{N}_])", "giu"), "$1#cast" + (i + 1)); });
    body.prompt = t; }
  body.meta = { ...m, cast161: cast.length ? cast : undefined, voice161, ...(Array.isArray(m.partModels) && cast.length ? { partModels: m.partModels.map(() => K4_MODEL) } : {}) };
  if (!body.meta.cast161) delete body.meta.cast161; if (!body.meta.voice161) delete body.meta.voice161;
}
// the words with each #castN replaced (by the name, when the job doesn't go to Kling 4.0)
export const castTags161 = (text, cast, name) => String(text || "").replace(/#cast(\d)(?![\p{L}\p{N}_])/gu, (m, n) => (cast[+n - 1] ? name(+n - 1, m) : m));
export const castNames161 = (text, cast) => (Array.isArray(cast) && cast.length ? castTags161(text, cast, (i) => cast[i].name) : String(text || ""));
// createJob, once the engine is known: a job that isn't going to Kling 4.0 gets the names back and loses the cast
export function castRoute161(body, key) {
  const m = body?.meta; if (!m || !(m.cast161 || m.voice161)) return;
  if (KLING4.test(String(key || "").replace(/^kie@/, ""))) return;
  body.prompt = castNames161(body.prompt, m.cast161); const { cast161: a, voice161: b, ...rest } = m; body.meta = rest;
}
// Kling 4.0 reference-to-video stays on it (instead of the keyframe model) when it has people, voices or pictures to keep
export const keepRefs161 = (m, body) => /^kling-4\.0\/reference-to-video/.test(String(m || "")) && !!(castOf(body).length || body?.meta?.voice161 || body?.inputs?.vVoice161 || refsOf130(body).length);

// a name Kling takes for a person or a voice (letters, digits, _; not a reserved word; not used twice)
function safeName(n, i, used, tail = "") {
  let s = String(n || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_").replace(/[^一-龥A-Za-z0-9_]/g, "").slice(0, 20 - tail.length);
  if (!s || !/[一-龥A-Za-z]/.test(s)) s = "Person" + (i + 1);
  s = (s + tail).slice(0, 20); if (RESERVED.test(s)) s = ("P_" + s).slice(0, 20);
  let k = 2, b = s; while (used.has(s.toLowerCase())) s = (b.slice(0, 18) + "_" + k++).slice(0, 20); used.add(s.toLowerCase()); return NAME_OK.test(s) ? s : "Person" + (i + 1) + tail;
}

// the engine input for a Kling 4.0 job. o: { abs, res, ar, prompt (the full words), start, end }
export function kling4Input(m, p, o) {
  const abs = o.abs, dur = Math.min(30, Math.max(3, Math.round(+p.dur || 5))), aspect = p.aspect ? o.ar : undefined;
  const cast = castOf(p), text0 = String(o.prompt || "").trim();
  if (/^kling-4\.0\/keyframe-to-video/.test(m)) {   // a first (and last) frame and the words — the frames are kept exactly
    const first = o.start ? abs(o.start) : undefined, last = o.end ? abs(o.end) : undefined;
    const lines = [castNames161(text0, cast).replace(/(^|\s)@(?=[\p{L}\p{N}_])/gu, "$1") || "The picture comes to life, moving naturally."];
    if (first) lines.push("The video opens exactly on @first_frame."); if (last) lines.push("The video ends exactly on @last_frame.");
    return drop({ prompt: lines.join("\n").slice(0, 8000), duration: dur, resolution: o.res, aspect_ratio: first || last ? undefined : aspect, first_frame_url: first, last_frame_url: last });
  }
  // reference-to-video: the customer's # pictures (@image_N), the characters (an element with their pictures and voice, or a picture
  // and a voice of their own), a voice for whoever speaks, then the first / last frame
  const images = [], elements = [], voices = [], used = new Set(), after = [], refs = refsOf130(p);
  refs.forEach((r) => images.push(abs(r.url)));
  let text = tagWords130(text0, refs, (i) => "@image_" + (i + 1));
  const said = cast.map(() => false);
  const how = cast.map((c, i) => {
    const pics = [...new Set(c.faces.map(abs))].slice(0, 4), vu = c.voiceUrl ? abs(c.voiceUrl) : undefined;
    if (pics.length >= 2 && elements.length < 7) { const nm = safeName(c.name, i, used); elements.push(drop({ name: nm, image_urls: pics, tag: "character", voice_url: vu }));
      after.push(`@${nm} is ${c.name}: the exact same face, hair, skin tone and build as in their reference pictures — the same real person.${vu ? ` @${nm} speaks in the voice of their own reference audio: the same timbre, age and accent.` : ""}`);
      return { at: "@" + nm, first: "@" + nm }; }
    images.push(pics[0]); const im = "@image_" + images.length;
    let vl = ""; if (vu && voices.length < 3) { const vn = safeName(c.name, i, used, "_voice"); voices.push({ name: vn, audio_url: vu }); vl = ` ${c.name} speaks with the voice @${vn}.`; }
    after.push(`${c.name} is the person in ${im}: the exact same face, hair, skin tone and build — the same real person.${vl}`);
    return { at: c.name, first: `${c.name} (${im})` };
  });
  text = castTags161(text, cast, (i) => { const h = how[i]; if (said[i]) return h.at; said[i] = true; return h.first; });
  const unnamed = how.filter((_, i) => !said[i]).map((h) => h.first);
  if (unnamed.length) text = unnamed.join(" and ") + (text ? " — " + text : ", moving naturally.");
  // a voice for whoever speaks (no character in the words): the library voice or the customer's clip
  const sv = p.meta?.voice161 && p.meta.voice161.url && MEDIA.test(p.meta.voice161.url) ? abs(p.meta.voice161.url) : undefined;
  if (sv && voices.length < 3) { const vn = safeName("speaker", 0, used); voices.push({ name: vn, audio_url: sv }); after.push(`Whoever speaks in the video speaks with the voice @${vn}: the same timbre, age and accent.`); }
  if (refs.length) { const named = tagged130(text0, refs), rest = refs.map((_, i) => i).filter((i) => !named.has(i));
    if (rest.length && named.size) after.push("Also use " + rest.map((i) => "@image_" + (i + 1)).join(", ") + " as reference" + (rest.length > 1 ? "s." : "."));
    if (!text) text = "A video with " + refs.map((_, i) => "@image_" + (i + 1)).join(", ") + ", moving naturally.";
    after.push("Keep every person, product and place exactly as they look in " + (refs.length > 1 ? "their reference pictures." : "the reference picture."));
    if (!p.meta?.styleChosen136 && !STYLE_WORDS.test(text0)) after.push("The video has exactly the visual style of the reference picture" + (refs.length > 1 ? "s" : "") + ": a photo stays a photo, a cartoon stays a cartoon, a 3D animation stays 3D."); }
  if (o.start && images.length < 10) { images.push(abs(o.start)); after.push(`The video opens exactly on @image_${images.length}.`); }
  if (o.end && images.length < 10) { images.push(abs(o.end)); after.push(`The video ends exactly on @image_${images.length}.`); }
  if (!text) text = images.length ? "A video with " + images.map((_, i) => "@image_" + (i + 1)).join(", ") + ", moving naturally." : "A short cinematic video.";
  // every @mention names something sent; any other "@" (an e-mail, a name that isn't a character) is plain text
  const ok = new Set([...images.map((_, i) => "image_" + (i + 1)), ...elements.map((e) => e.name), ...voices.map((v) => v.name)].map((s) => s.toLowerCase()));
  const prompt = [text, ...after].join("\n").replace(/@([\p{L}\p{N}_]+)/gu, (mm, n) => (ok.has(n.toLowerCase()) ? mm : n)).slice(0, 8000);
  const imgs = images.slice(0, 10), room = 15 - imgs.length;
  return drop({ prompt, duration: dur, resolution: o.res, aspect_ratio: aspect, image_urls: imgs.length ? imgs : undefined,
    elements: elements.length ? elements.slice(0, Math.min(7, room)) : undefined, voices: voices.length ? voices.slice(0, Math.max(0, Math.min(3, room - Math.min(7, elements.length)))) : undefined });
}
const drop = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length)));
// what an engine run costs more at 1080p (Kie: 42.5 instead of 28.5 credits a second)
export const hiRes161 = (b) => b?.model === K4_MODEL && /1080|2k|4k/i.test(String(b.meta?.res || ""));
