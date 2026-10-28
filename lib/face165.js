// v165 "The permanent eyes are permanent and strange — an engine that works with the lip engine, so the facial expressions are
// realistic, with realistic voice acting like ElevenLabs, in harmony with the whole site."
// Why the eyes stared: a talking avatar made from a photo went to the face engine (Kling AI Avatar, InfiniteTalk) with no
// direction at all — an empty prompt, or the voice file's name — and the voice was one flat read of the words. Those engines
// move a face the way they are told; told nothing, they keep the photo's open eyes on the lens.
// The performance engine reads the words line by line, the way an acting coach would:
//   · every line gets a feeling (the text AI as acting director when there is one, else the words themselves: questions,
//     greetings and thanks, laughter, sad or angry words, a pause "…", surprise — English and Arabic) and its time on the clip
//   · the face engine gets a direction: real blinking every 2–5 s and at the end of sentences (never a fixed stare), eyes that
//     move — a glance away to think, back to the lens on the key words — brows and cheeks that move with the words, small nods
//     and tilts, breathing; then each line's expression at its time
//   · the voice acts the same lines: ElevenLabs v3 with an audio tag ([laughs] [sighs] [whispers] [excited] [curious]) where
//     a feeling is clear, else the delivery of the whole piece (steadiness · style) on Multilingual v2
// Pure (no server state); the text AI is loaded only when asked for.
import { scriptLang } from "./speech160.js";

// what the face does, the audio tag the voice may get, and the delivery (lib/voice.js DELIVERY · providers/kie.js TONE_FEEL)
export const EMO165 = {
  neutral: { face: "a relaxed, natural expression, small nods on the stressed words", tag: "", voice: "neutral" },
  warm: { face: "a genuine warm smile that reaches the eyes (the cheeks lift, the eyes crinkle softly)", tag: "", voice: "warm" },
  excited: { face: "bright eyes, raised eyebrows and an open smile, quick energetic nods", tag: "[excited]", voice: "excited" },
  curious: { face: "the eyebrows lift, the head tilts a little, the eyes widen slightly as the question lands", tag: "[curious]", voice: "warm" },
  thoughtful: { face: "the eyes glance aside and up for a moment, as if thinking, then come back to the lens", tag: "", voice: "calm" },
  serious: { face: "a steady, sincere look into the lens, slightly focused brows, firm small nods, no smile", tag: "", voice: "serious" },
  sad: { face: "softer eyes, the inner brows lift, slower blinks, a short glance down", tag: "[sighs]", voice: "sad" },
  angry: { face: "brows drawn together, narrowed eyes, a tense jaw, sharper head movements", tag: "", voice: "angry" },
  funny: { face: "a playful grin, the eyes crinkle, a short laugh that moves the shoulders", tag: "[laughs]", voice: "funny" },
  surprised: { face: "the eyes widen and the eyebrows rise high, a small lean back, then a smile", tag: "", voice: "excited" },
  whisper: { face: "leans a little closer to the lens, the eyes glance aside as if sharing a secret", tag: "[whispers]", voice: "whisper" },
  calm: { face: "slow relaxed blinks, a gentle half smile, a calm steady gaze", tag: "", voice: "calm" },
};
// a tone chosen on the page (Voice page, avatar box) → the feeling of the lines that have no clear feeling of their own
const TONE165 = { warm: "warm", energetic: "excited", excited: "excited", calm: "calm", serious: "serious", narrator: "serious", deep: "serious", sad: "sad",
  angry: "angry", dramatic: "serious", whisper: "whisper", funny: "funny", neutral: "neutral" };
export const toneEmo165 = (t) => TONE165[String(t || "").toLowerCase()] || null;
// the words that show a feeling (English and Arabic), strongest first
const CUES = [
  ["funny", /\b(?:ha(?:ha)+|lol|lmao|hehe+)\b|ه{3,}|😂|🤣/iu],
  ["angry", /\b(?:angry|furious|unacceptable|outrageous|how dare)\b|غاضب|غضبان|كفى|غير مقبول/iu],
  ["sad", /\b(?:sorry|sadly|unfortunately|miss(?:ed)? you|passed away|goodbye|heartbroken)\b|للأسف|للاسف|آسف|حزين|حزينة|أفتقد|افتقد|وداعا|وداعاً|رحمه الله/iu],
  ["whisper", /\b(?:secret|whisper|between us|don'?t tell)\b|بيني وبينك|همس|سرّ|(?:^|\s)سر(?:\s|$)/iu],
];
const QUESTION = /[?؟]\s*["”»']?\s*$/u, ASK = /[?؟]/u;
const SURPRISE = /\b(?:wow|whoa|unbelievable|can'?t believe|no way)\b|واو|معقول|ما شاء الله|سبحان الله|لا يصدق|مستحيل/iu;
const WARM = /\b(?:hi|hello|hey|welcome|good (?:morning|afternoon|evening)|thank(?:s| you)|grateful|love)\b|مرحب|أهلا|اهلا|هلا|السلام عليكم|صباح الخير|مساء الخير|شكرا|شكراً|ممتن|ممتنة|أحب|احب/iu;
const EXCLAIM = /!\s*["”»']?\s*$/u;
const THINK = /…|\.\.\.|\b(?:hmm+|let me think|maybe|perhaps|i wonder)\b|ربما|يمكن|خلني أفكر|أممم|امم/iu;
// the feeling a line shows by itself (null: none clear)
export function cue165(line) {
  const t = String(line || "");
  for (const [e, re] of CUES) if (re.test(t)) return e;
  if (QUESTION.test(t) || (ASK.test(t) && t.length < 140)) return "curious";
  if (SURPRISE.test(t)) return "surprised";
  if (WARM.test(t)) return "warm";
  if (EXCLAIM.test(t)) return "excited";
  if (THINK.test(t)) return "thoughtful";
  return null;
}
// the lines: sentences (. ! ? … ؟ 。 and new lines), a fragment of one or two words joined to the line before
export function sentences165(text) {
  const parts = String(text || "").replace(/\s+\n/g, "\n").split(/(?<=[.!?؟。！？…])\s+|\n+/u).map((s) => s.trim()).filter(Boolean), out = [];
  for (const s of parts) { const n = (s.match(/\S+/g) || []).length; if (out.length && n <= 2 && !/[?؟!]/.test(s)) out[out.length - 1] += " " + s; else out.push(s); }
  return out;
}
// about how long a line takes to say (seconds): words at the pace of the language, a breath after each sentence
const WPS = { ar: 2.2, fa: 2.2, ur: 2.3, he: 2.3, ru: 2.3, de: 2.3, en: 2.6, es: 2.8, fr: 2.7, it: 2.7, pt: 2.7, tr: 2.4 };
export function lineDur165(line, lang) {
  const t = String(line || ""), cjk = (t.match(/[぀-ヿ㐀-䶿一-鿿가-힯]/gu) || []).length;
  if (cjk > 3) return Math.max(.6, cjk / 4.2 + .35);
  const w = (t.match(/\S+/g) || []).length; return Math.max(.6, w / (WPS[lang] || 2.5) + .35);
}
// line by line: { i, text, emo, cue (the feeling came from the words), t0, t1 }
export function ruleBeats165(text, o = {}) {
  const lang = o.lang || scriptLang(text) || "en", base = toneEmo165(o.tone) || "neutral"; let t = 0;
  return sentences165(text).map((s, i) => { const c = cue165(s), d = lineDur165(s, lang), b = { i, text: s, emo: c || base, cue: !!c, t0: +t.toFixed(1), t1: +(t + d).toFixed(1) }; t += d; return b; });
}
// one feeling for the whole voice when it is said in one go: the chosen tone, else the feeling that takes most of the words
export function overallTone165(beats, tone) {
  const chosen = toneEmo165(tone); if (chosen && chosen !== "neutral" && String(tone).toLowerCase() !== "auto") return EMO165[chosen].voice;
  const w = {}; for (const b of beats || []) if (b.emo !== "neutral") w[b.emo] = (w[b.emo] || 0) + String(b.text).length;
  const top = Object.entries(w).sort((a, b) => b[1] - a[1])[0]; return top ? EMO165[top[0]].voice : "neutral";
}
// what the face engine is told (English: the engines read English best; the lines themselves are not repeated)
export const LIVING165 = "A real person talking to the camera, fully alive. Real blinking: quick, natural blinks every 2–5 seconds and at the end of sentences, both eyes together — never a frozen, fixed stare. Living eyes: small eye movements, a short glance away to think, then back to the lens on the important words. Eyebrows, cheeks and forehead move with the words; small nods and tilts follow the rhythm of the speech; gentle breathing in the chest and shoulders. Lips match every word exactly, with natural teeth and tongue and no exaggerated mouth. The same face, hair, clothes, light and background as the picture; steady camera.";
export function faceDirection165(beats, o = {}) {
  let out = LIVING165;
  const list = []; for (const b of beats || []) { const last = list[list.length - 1]; if (last && last.emo === b.emo) last.t1 = b.t1; else list.push({ emo: b.emo, t0: b.t0, t1: b.t1 }); }
  if (list.length && !(list.length === 1 && list[0].emo === "neutral")) {
    out += " Acting, in order: " + list.slice(0, 8).map((b, i) => `${i + 1}) ${b.t0}–${b.t1} s, ${b.emo}: ${EMO165[b.emo].face}`).join("; ") + ". A breath and a blink between lines.";
  } else {
    const e = toneEmo165(o.tone);
    out += " The expressions follow the feeling of the voice: a smile on warm or happy words, the brows up on a question, a thoughtful glance away in a pause" + (e && e !== "neutral" ? `; overall ${e} — ${EMO165[e].face}` : "") + ".";
  }
  return out.slice(0, 2400);
}
// the words the voice says, with an audio tag where a line's own words show the feeling (at most three; ElevenLabs v3 reads
// them, lib/voice.js stripTags takes them out for the other voices)
export function voiceText165(beats) {
  let n = 0;
  return (beats || []).map((b) => { const tag = EMO165[b.emo] && EMO165[b.emo].tag; if (b.cue && tag && n < 3) { n++; return tag + " " + b.text; } return b.text; }).join(" ").slice(0, 4800);
}
// the text AI as acting director: only picks each line's feeling and tag from the lists (the face words stay ours)
async function direct165(beats, o) {
  const { llmJson, llmConfigured } = await import("../providers/anthropic.js");
  if (!llmConfigured()) return null;
  const j = await llmJson(`You are the acting director for a talking-head video${o.lang ? " in " + o.lang : ""}. For each line pick how the speaker feels saying it, from: ${Object.keys(EMO165).join(", ")}.
${o.tone && o.tone !== "auto" ? `The client asked for an overall "${o.tone}" delivery: use it where a line has no clear feeling of its own.\n` : ""}Mark "cue": true only when the feeling is obvious from the words (it then gets an audio tag such as [laughs] or [sighs]).
LINES: ${JSON.stringify(beats.map((b) => ({ i: b.i, text: String(b.text).slice(0, 300) })))}
Return {"lines":[{"i":0,"emotion":"warm","cue":false}]} — one entry per line, same order.`, { maxTokens: 900, tier: "quick", timeoutMs: 25000 });
  const got = Array.isArray(j && j.lines) ? j.lines : null; if (!got) return null;
  return beats.map((b) => { const x = got.find((y) => +y.i === b.i) || {}; return EMO165[x.emotion] ? { ...b, emo: x.emotion, cue: !!x.cue && !!EMO165[x.emotion].tag } : b; });
}
// the whole plan: { beats, by: "ai" | "rules", lang, tone, dur, face, voiceText }
export async function plan165(text, o = {}) {
  const lang = o.lang && o.lang !== "auto" ? String(o.lang).slice(0, 5) : scriptLang(text) || "en";
  let beats = ruleBeats165(text, { lang, tone: o.tone }), by = "rules";
  if (o.ai !== false && beats.length) { try { const b = await direct165(beats, { lang, tone: o.tone }); if (b) { beats = b; by = "ai"; } } catch {} }
  return { beats, by, lang, tone: overallTone165(beats, o.tone), dur: beats.length ? beats[beats.length - 1].t1 : 0, face: faceDirection165(beats, o), voiceText: voiceText165(beats) };
}
// a file name is not words to say (the page sends the audio file's name when there are no words)
export const isFileName165 = (s) => /^[^\s/\\]{1,120}\.(?:mp3|wav|m4a|aac|ogg|oga|opus|flac|webm|mp4|mov)$/i.test(String(s || "").trim());
// the words without audio tags (the same rule as lib/voice.js stripTags)
export const plainText165 = (t) => String(t || "").replace(/\[[a-z][a-z ]{1,24}\]\s*/gi, "").trim();
// InfiniteTalk reads a short direction best: the living face and the feelings in order
const SHORT165 = { neutral: "relaxed", warm: "warm smile", excited: "bright excited eyes", curious: "brows up, a small head tilt", thoughtful: "a thoughtful glance away",
  serious: "a steady sincere look", sad: "soft sad eyes", angry: "frowning brows", funny: "a laughing grin", surprised: "wide surprised eyes", whisper: "leaning in, secretive", calm: "a calm half smile" };
export function faceShort165(beats, o = {}) {
  const seq = []; for (const b of beats || []) if (seq[seq.length - 1] !== b.emo) seq.push(b.emo);
  const e = toneEmo165(o.tone), feel = seq.some((x) => x !== "neutral") ? " Expressions in order: " + seq.slice(0, 8).map((x) => SHORT165[x]).join(" → ") + "." : e && e !== "neutral" ? " Overall " + SHORT165[e] + "." : " Expressions follow the voice.";
  return "A person talking naturally to the camera: natural blinks every few seconds, never a fixed stare; living eyes that glance away to think and come back to the lens; eyebrows and small nods follow the words; lips match every word; the same face and background." + feel;
}
