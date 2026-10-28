// Content localization — NVIDIA's Content Localization blueprint (github.com/NVIDIA-AI-Blueprints/content-localization,
// Apache-2.0) as one nooi pipeline that works with Video intelligence, Subtitles & dubbing, the editor and the library:
//   intake → who says what, when (transcript + speakers) → translation for the ear, with a time budget per line → speech in
//   the new language (S2S) → lip-sync → mix with the original sound → subtitles → quality check → library / editor / publish
// Engines (Admin → AI providers), chosen per job or by "Best value" (the cheapest engine that can do what was asked):
//   · nvidia     — your own deployment of the blueprint: its controller (gRPC, default :50056) runs S2S + active-speaker
//                  detection + LipSync in one stream (protos in proto/content-localization). Mode "lipsync": nooi makes the
//                  voices and the controller only syncs the lips (bypass_s2s + translated_audio_data)
//   · elevenlabs — ElevenLabs Dubbing (the blueprint's default S2S): POST /v1/dubbing → poll → GET …/audio/{lang};
//                  keeps each speaker's voice and the background
//   · camb       — CAMB.AI (the blueprint's second S2S): files/upload-url → PUT → complete → /dub → poll → /dub-alt-format
//   · nooi       — built in: transcript (ElevenLabs Scribe, Whisper, CAMB.AI or your own lines) → AI translation → natural
//                  voices (lib/voice.js) fitted to each line's time → voice-over mix over the original sound → ffmpeg
// Records live in the user's data (`u.loc`), at most 40. Every finished language is also a library item (job kind "dub").
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import { user, save, uid } from "./store.js";
import { requireUser } from "./auth.js";
import { isStaff } from "./admin.js";
import { charge, credit, basePrice } from "./billing.js";
import { cfg } from "./settings.js";
import { MEDIA_DIR, localPath, download } from "./media.js";
import { createJob } from "./jobs.js";
import { llmJson, llmConfigured } from "../providers/anthropic.js";
import { craftNotes } from "./skills.js";
import { presetLine } from "./voicepresets.js";
import { speak, castVoices, voiceReady, run, mediaDur, tmpFile, ffmpeg, stripTags, langName, cloneVoice, dropVoice, DELIVERY, polish, writeForEar, VOICES, voicePreviews } from "./voice.js";
import { NO_CREDITS138 } from "./engine134.js";

// v159: a voice sample that can't be made says why in plain words, in English and Arabic — samples are free, so never "your
// credits were refunded". An engine out of credits is told to the owner like a refused job (Admin red line, one email).
async function sampleFail159(req, res, e) {
  const m = String((e && e.message) || e || ""), quota = (e && e.status === 402) || NO_CREDITS138.test(m);
  if (quota) { try { const { noCredits138 } = await import("./alert138.js"); noCredits138(voiceReady() || "", m); } catch {} }
  const out = quota ? { error: "Voice samples can't be made right now — the AI engine isn't taking new work. Nothing was charged.", errorAr: "لا يمكن صنع عيّنات الأصوات الآن — محرّك الذكاء لا يقبل أعمالاً جديدة. لم يُخصم شيء.", errorType: "quota" }
    : { error: "This voice sample couldn't be made right now — nothing was charged. Try again in a minute.", errorAr: "تعذّر صنع عيّنة هذا الصوت الآن — لم يُخصم شيء. حاول بعد دقيقة.", errorType: "provider" };
  if (isStaff(req.user)) out.detail = m.slice(0, 300);
  res.status(quota ? 503 : 502).json(out);
}

const MAX_REC = 40, MAX_MIN = 30, MAX_MIN_NOOI = 20;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const POLL = () => Math.max(50, +process.env.LOC_POLL_MS || 5000);
const FP = () => process.env.FFPROBE_PATH || "ffprobe";
// ElevenLabs Dubbing languages · CAMB.AI language ids (the blueprint's camb_utils lists)
export const EL_DUB_LANGS = new Set("en hi pt zh es fr de ja ar ru ko id it nl tr pl sv fil ms ro uk el cs da fi bg hr sk ta hu no vi".split(" "));
export const CAMB_ID = { en: 1, af: 2, am: 3, ar: 16, az: 20, bg: 21, bn: 22, bs: 24, ca: 25, cs: 26, cy: 27, da: 28, de: 31, el: 32, es: 54, et: 68, eu: 69, fa: 70, fi: 71, fil: 72, fr: 76, ga: 77, gl: 78, gu: 79, he: 80, hi: 81, hr: 82, hu: 83, hy: 84,
  id: 85, is: 86, it: 87, ja: 88, jv: 89, ka: 90, kk: 91, km: 92, kn: 93, ko: 94, lo: 95, lt: 96, lv: 97, mk: 98, ml: 99, mn: 100, mr: 101, ms: 102, mt: 103, my: 104, no: 105, ne: 106, nl: 108, pl: 109, ps: 110, pt: 111,
  ro: 113, ru: 114, si: 115, sk: 116, sl: 117, so: 118, sq: 119, sr: 120, su: 121, sv: 122, sw: 123, ta: 125, te: 129, th: 130, tr: 131, uk: 132, ur: 134, uz: 135, vi: 136, zh: 139, zu: 147, pa: 148, sa: 149, tl: 151 };
// comfortable speaking speed (characters per second) → how long a translated line may be
const CPS = { ja: 7.5, zh: 5, ko: 7, th: 11, ar: 13, he: 13, fa: 13, ur: 13, hi: 13, am: 10, ti: 10 };
const ISO3 = { eng: "en", ara: "ar", spa: "es", fra: "fr", fre: "fr", deu: "de", ger: "de", ita: "it", por: "pt", rus: "ru", jpn: "ja", zho: "zh", chi: "zh", cmn: "zh", kor: "ko", hin: "hi", tur: "tr", nld: "nl", pol: "pl", swe: "sv", ind: "id", fil: "fil", tgl: "fil", urd: "ur", fas: "fa", per: "fa", heb: "he", ukr: "uk", vie: "vi", tha: "th", msa: "ms", may: "ms", swa: "sw", amh: "am", hau: "ha", yor: "yo", ibo: "ig", zul: "zu", xho: "xh", afr: "af", som: "so" };
const WHISPER = { english: "en", arabic: "ar", spanish: "es", french: "fr", german: "de", italian: "it", portuguese: "pt", russian: "ru", japanese: "ja", chinese: "zh", korean: "ko", hindi: "hi", turkish: "tr", dutch: "nl", polish: "pl", swedish: "sv", indonesian: "id", urdu: "ur", persian: "fa", hebrew: "he", ukrainian: "uk", vietnamese: "vi", thai: "th", malay: "ms", swahili: "sw", tagalog: "fil" };
const normLang = (c) => { c = String(c || "").toLowerCase().replace(/_/g, "-"); if (!c) return null; if (WHISPER[c]) return WHISPER[c]; const b = c.split("-")[0]; return ISO3[b] || (b.length <= 3 ? b : null); };

// ---- prices (credits per started minute of video; every language separately) — Admin → Pricing changes the engine costs
export const locPrice = () => ({ stt: basePrice("loc", "locstt"), translate: basePrice("loc", "loctr"), voice: basePrice("loc", "loctts"), elevenlabs: basePrice("loc", "locel"), camb: basePrice("loc", "loccamb"), nvidia: basePrice("loc", "locnv"), lipsync: basePrice("fixed", "lipsync"), qa: 1 });
const nvc = () => { const c = cfg("nvloc"); const m = String(c.model || "").toLowerCase(); return { addr: String(c.baseUrl || "").replace(/^(grpcs?|https?):\/\//, "").replace(/\/+$/, ""), tls: /^(grpcs|https):\/\//.test(String(c.baseUrl || "")) || /:443$/.test(String(c.baseUrl || "")), key: c.apiKey || "", mode: /lip/.test(m) ? "lipsync" : "full", backend: /camb/.test(m) ? "camb" : "elevenlabs" }; };
export function locEngines() {
  const voice = voiceReady(), ai = llmConfigured();
  return { nooi: !!(ai && voice), elevenlabs: !!cfg("elevenlabs").apiKey, camb: !!cfg("camb").apiKey, nvidia: !!cfg("nvloc").baseUrl, nvMode: cfg("nvloc").baseUrl ? nvc().mode : null,
    stt: !!(cfg("elevenlabs").apiKey || cfg("openai").apiKey || cfg("camb").apiKey), translate: ai, voice: voice || null };
}
// a transcript is made when the engine speaks from it (nooi voices), for the speaker rows of NVIDIA's active-speaker
// detection, or for subtitles / the quality check — never when the user's own lines are given
const willStt = (id, nvLip, o, haveLines, sttOn) => !haveLines && sttOn && (id === "nooi" || nvLip || id === "nvidia" || o.qa || (o.subtitles && id !== "elevenlabs"));
// what one job costs on each engine, and whether that engine can do it → the best-value pick
export function quote(dur, targets, o = {}, haveLines = false) {
  const P = locPrice(), min = Math.max(1, Math.ceil((+dur || 60) / 60)), n = Math.max(1, targets.length), E = locEngines(), nv = E.nvidia ? nvc() : { mode: "full", backend: "elevenlabs" };
  const rows = ["nooi", "camb", "elevenlabs", "nvidia"].map((id) => {
    const nvLip = id === "nvidia" && nv.mode === "lipsync", ownVoices = id === "nooi" || nvLip, stt = willStt(id, nvLip, o, haveLines, E.stt);
    const parts = { stt: stt ? P.stt * min : 0, translate: ownVoices || ((o.subtitles || o.qa) && (haveLines || stt) && id !== "elevenlabs") ? P.translate * min * n : 0, voice: ownVoices ? P.voice * min * n : 0,
      dub: id === "elevenlabs" ? P.elevenlabs * min * n : id === "camb" ? P.camb * min * n : 0, nvidia: id === "nvidia" ? (P.nvidia + (nvLip ? 0 : nv.backend === "camb" ? P.camb : P.elevenlabs)) * min * n : 0,
      qa: o.qa ? P.qa * n : 0, lipsync: o.lipsync && id !== "nvidia" ? P.lipsync * n : 0 };
    const credits = Object.entries(parts).reduce((s, [k, v]) => s + (k === "lipsync" ? 0 : v), 0);
    let ok = !!E[id], reason = ok ? "" : "not connected";
    const miss = targets.filter((l) => (id === "elevenlabs" || (id === "nvidia" && !nvLip && nv.backend === "elevenlabs")) ? !EL_DUB_LANGS.has(l) : (id === "camb" || (id === "nvidia" && !nvLip && nv.backend === "camb")) ? !CAMB_ID[l] : false);
    if (ok && miss.length) { ok = false; reason = "doesn't speak " + miss.map(langName).join(", "); }
    if (ok && ownVoices && !haveLines && !E.stt) { ok = false; reason = "needs speech-to-text (ElevenLabs, OpenAI or CAMB.AI) or your own lines"; }
    if (ok && id === "camb" && o.srcLang && o.srcLang !== "auto" && !CAMB_ID[o.srcLang]) { ok = false; reason = "doesn't hear " + langName(o.srcLang); }
    if (ok && ownVoices && min > MAX_MIN_NOOI) { ok = false; reason = "videos up to " + MAX_MIN_NOOI + " min"; }
    if (ok && o.voice === "clone" && ownVoices && !(E.elevenlabs && o.consent)) { ok = false; reason = E.elevenlabs ? "needs the speakers' consent" : "keeping the voices needs ElevenLabs"; }
    return { id, ok, reason, credits, total: credits + parts.lipsync, parts, lipsync: id === "nvidia" || !!o.lipsync, keepsVoices: id === "elevenlabs" || id === "camb" || (id === "nvidia" && !nvLip) || (ownVoices && o.voice === "clone") };
  });
  const can = rows.filter((r) => r.ok); let pick = null, why = "";
  if (o.engine && o.engine !== "auto") { pick = rows.find((r) => r.id === o.engine); why = "chosen"; }
  else if (o.lipsync && can.some((r) => r.id === "nvidia")) { pick = rows.find((r) => r.id === "nvidia"); why = "lips"; }                                  // one pass: voices + active speaker + lips
  else if (o.voice === "clone") { pick = can.filter((r) => r.keepsVoices).sort((a, b) => a.credits - b.credits)[0] || null; why = "voices"; }               // the speakers' own voices
  else { pick = can.sort((a, b) => a.credits - b.credits)[0] || null; why = "cheapest"; }                                                                    // best result per credit
  return { pick: pick ? pick.id : null, why, engines: rows, minutes: min };
}

// ---- helpers
const recs = (u) => { const U = user(u); if (!U.loc) U.loc = {}; return U.loc; };
async function sourceFile(src) {
  const u = String(src || ""); if (!u) throw Object.assign(new Error("Pick a video first"), { code: 400 });
  if (u.startsWith("/media/")) { const f = path.join(MEDIA_DIR, path.basename(u)); if (fs.existsSync(f)) return f; }
  const lp = localPath(u); if (lp && fs.existsSync(lp)) return lp;
  if (/^https?:\/\//.test(u)) { if (!publicHost(u)) throw Object.assign(new Error("That address can't be used"), { code: 400 }); return (await download(u)).file; }
  throw Object.assign(new Error("Video not found"), { code: 404 });
}
// remote sources must be public internet addresses (never the server's own network)
export const publicHost = (u) => { try { const h = new URL(u).hostname.replace(/^\[|\]$/g, "").toLowerCase(); return !(h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(h) || h === "::1" || /^f[cd]|^fe80/.test(h) || h === "metadata.google.internal"); } catch { return false; } };
async function probe(file) {
  const j = JSON.parse(await run(FP(), ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file], "text"));
  const v = (j.streams || []).find((x) => x.codec_type === "video" && !(x.disposition && x.disposition.attached_pic)), a = (j.streams || []).find((x) => x.codec_type === "audio");
  return { duration: +(j.format && j.format.duration) || 0, video: v ? { codec: v.codec_name, w: v.width, h: v.height } : null, audio: a ? { codec: a.codec_name, rate: +a.sample_rate, ch: a.channels } : null };
}
// a short sample of each library voice, made once and kept for everyone (per language; "lib" = the engine's own sample)
const SAMPLE_TXT = { en: "Hi, I'm {n}. This is how I sound when I tell your story.", ar: "مرحباً، أنا {n}. هكذا يبدو صوتي حين أروي قصتك.", fr: "Bonjour, je suis {n}. Voici ma voix quand je raconte votre histoire.", es: "Hola, soy {n}. Así sueno cuando cuento tu historia.", de: "Hallo, ich bin {n}. So klinge ich, wenn ich deine Geschichte erzähle.", tr: "Merhaba, ben {n}. Hikâyeni anlatırken sesim böyle." };
const sampleLang = (l) => (SAMPLE_TXT[String(l || "")] ? String(l) : "en");
const sampleFile = (id, lg) => path.join(MEDIA_DIR, "vs-" + String(id).replace(/[^\w-]/g, "") + "-" + lg + ".mp3");
const sampleAt = (id, lg) => [sampleFile(id, lg), sampleFile(id, "lib")].find((f) => fs.existsSync(f)) || null;
// v97: one sample file made once — two people asking for it at the same time share the same making
const MAKING = new Map();
function makeOnce(file, say) {
  if (fs.existsSync(file)) return Promise.resolve(file);
  if (!MAKING.has(file)) MAKING.set(file, (async () => { let sp = null, fin = null;
    try { sp = await say(); fin = await polish(sp.file, { ext: ".mp3" }); fs.copyFileSync(fin, file); return file; }
    finally { if (sp && sp.temp) fs.unlink(sp.file, () => {}); if (fin) fs.unlink(fin, () => {}); MAKING.delete(file); } })());
  return MAKING.get(file);
}
const keep = (file, ext) => { const name = uid() + ext; fs.copyFileSync(file, path.join(MEDIA_DIR, name)); return "/media/" + name; };
const keepText = (txt, ext) => { const name = uid() + ext; fs.writeFileSync(path.join(MEDIA_DIR, name), txt); return "/media/" + name; };
function wavHeader(dataLen, sr, ch = 1, bits = 16) { const h = Buffer.alloc(44); h.write("RIFF", 0); h.writeUInt32LE(36 + dataLen, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(ch, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * ch * bits / 8, 28); h.writeUInt16LE(ch * bits / 8, 32); h.writeUInt16LE(bits, 34); h.write("data", 36); h.writeUInt32LE(dataLen, 40); return h; }
function wavInfo(file) { const fd = fs.openSync(file, "r"); try { const b = Buffer.alloc(4096); const n = fs.readSync(fd, b, 0, 4096, 0); let p = 12, sr = 16000, ch = 1, bits = 16;
  while (p + 8 <= n) { const id = b.toString("ascii", p, p + 4), sz = b.readUInt32LE(p + 4); if (id === "fmt ") { ch = b.readUInt16LE(p + 10); sr = b.readUInt32LE(p + 12); bits = b.readUInt16LE(p + 22); } if (id === "data") return { off: p + 8, len: Math.min(sz, fs.statSync(file).size - p - 8), sr, ch, bits }; p += 8 + sz + (sz % 2); }
  throw new Error("Bad WAV file"); } finally { fs.closeSync(fd); } }
function* fileChunks(file, size, from = 0, to = Infinity) { const fd = fs.openSync(file, "r"); try { let pos = from; const end = Math.min(to, fs.statSync(file).size); while (pos < end) { const b = Buffer.alloc(Math.min(size, end - pos)); const n = fs.readSync(fd, b, 0, b.length, pos); if (!n) break; pos += n; yield n < b.length ? b.subarray(0, n) : b; } } finally { fs.closeSync(fd); } }
// the blueprint's audio stream: a 44-byte WAV header, then raw PCM in chunks of `sec` seconds
function* wavChunks(file, sec = 1) { const w = wavInfo(file); yield wavHeader(w.len, w.sr, w.ch, w.bits); yield* fileChunks(file, Math.max(2, Math.round(sec * w.sr) * w.ch * w.bits / 8), w.off, w.off + w.len); }
const srtT = (t, sep) => { t = Math.max(0, t); const ms = Math.round((t % 1) * 1000), s = Math.floor(t) + (ms === 1000 ? 1 : 0), p = (x) => String(x).padStart(2, "0"); return p(Math.floor(s / 3600)) + ":" + p(Math.floor(s / 60) % 60) + ":" + p(s % 60) + sep + String(ms % 1000).padStart(3, "0"); };
// two balanced lines of at most ~42 characters (no wrapping for scripts written without spaces)
function wrap(t, max = 42) { t = String(t || "").replace(/\s+/g, " ").trim(); if (t.length <= max || !/\s/.test(t)) return t; const w = t.split(" "); let best = t, bd = 1e9;
  for (let i = 1; i < w.length; i++) { const a = w.slice(0, i).join(" "), b = w.slice(i).join(" "), d = Math.max(a.length, b.length); if (d < bd) { bd = d; best = a + "\n" + b; } } return best; }
export const toSrt = (lines) => lines.filter((l) => stripTags(l.text)).map((l, i) => `${i + 1}\n${srtT(l.s, ",")} --> ${srtT(l.e, ",")}\n${wrap(stripTags(l.text))}\n`).join("\n");
export const toVtt = (lines) => "WEBVTT\n\n" + lines.filter((l) => stripTags(l.text)).map((l) => `${srtT(l.s, ".")} --> ${srtT(l.e, ".")}\n${wrap(stripTags(l.text))}\n`).join("\n");
export function parseSrt(txt) { const out = [], tt = (s) => { const m = /(\d+):(\d+):(\d+)[,.](\d+)/.exec(s); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000 : 0; };
  for (const blk of String(txt || "").replace(/\r/g, "").split(/\n\s*\n/)) { const ls = blk.split("\n").filter(Boolean), k = ls.findIndex((l) => l.includes("-->")); if (k < 0) continue; const [a, b] = ls[k].split("-->"); const text = ls.slice(k + 1).join(" ").trim(); if (text) out.push({ s: +tt(a).toFixed(2), e: +tt(b).toFixed(2), text, spk: 0 }); } return out; }
// words → subtitle-sized lines (new line on a new speaker, a pause, a full stop, ~84 characters or ~6.5 s)
export function linesFromWords(ws) { const out = []; let cur = null;
  for (const w of ws) { if (!w.text) continue; const cjk = /[぀-ヿ㐀-鿿฀-๿]/.test(w.text);
    if (!cur || w.spk !== cur.spk || w.s - cur.e > .7 || cur.text.length + w.text.length > 84 || cur.e - cur.s > 6.5 || (/[.!?؟。！？]$/.test(cur.text) && cur.text.length > 28)) { cur = { s: w.s, e: w.e, text: w.text, spk: w.spk }; out.push(cur); }
    else { cur.text += (cjk || /^[,.!?؟،;:)]/.test(w.text) ? "" : " ") + w.text; cur.e = w.e; } }
  return out.map((l) => ({ s: +l.s.toFixed(2), e: +Math.max(l.e, l.s + .3).toFixed(2), text: l.text.trim(), spk: l.spk || 0 })); }
const spkId = (v) => { if (v == null) return 0; const m = /(\d+)\s*$/.exec(String(v)); return m ? +m[1] : 0; };

// ---- 1 · transcript with speakers: ElevenLabs Scribe (diarized words) → OpenAI Whisper → CAMB.AI
const elBase = () => (cfg("elevenlabs").baseUrl || "https://api.elevenlabs.io").replace(/\/$/, "");
async function elJson(p, init = {}) { const r = await fetch(elBase() + p, { ...init, headers: { "xi-api-key": cfg("elevenlabs").apiKey, ...(init.headers || {}) } }); const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = { raw: t }; }
  if (!r.ok) throw Object.assign(new Error("ElevenLabs " + r.status + ": " + (d.detail && (d.detail.message || d.detail[0] && d.detail[0].msg || d.detail) || t).toString().slice(0, 200)), { status: r.status }); return d; }
async function elStt(mp3, lang, speakers) {
  const send = (model) => { const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(mp3)], { type: "audio/mpeg" }), "audio.mp3"); fd.append("model_id", model); fd.append("diarize", "true"); fd.append("timestamps_granularity", "word"); fd.append("tag_audio_events", "false");
    if (lang) fd.append("language_code", lang); if (+speakers > 0) fd.append("num_speakers", String(Math.min(32, +speakers))); return elJson("/v1/speech-to-text", { method: "POST", body: fd }); };
  let j; try { j = await send(process.env.ELEVENLABS_STT_MODEL || "scribe_v2"); } catch (e) { if (![400, 404, 422].includes(e.status)) throw e; j = await send("scribe_v1"); }
  const words = (j.words || []).filter((w) => !w.type || w.type === "word").map((w) => ({ s: +w.start || 0, e: +w.end || +w.start || 0, text: String(w.text || "").trim(), spk: spkId(w.speaker_id) })).filter((w) => w.text);
  return { lang: normLang(j.language_code) || lang, words, lines: linesFromWords(words), by: "elevenlabs" };
}
async function whisper(mp3, lang) {
  const c = cfg("openai"), fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(mp3)], { type: "audio/mpeg" }), "audio.mp3"); fd.append("model", process.env.OPENAI_STT_MODEL || "whisper-1"); fd.append("response_format", "verbose_json"); fd.append("timestamp_granularities[]", "segment"); if (lang) fd.append("language", lang);
  const r = await fetch((c.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "") + "/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + c.apiKey }, body: fd }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = {}; }
  if (!r.ok) throw new Error("Speech-to-text " + r.status + ": " + ((j.error && j.error.message) || t).slice(0, 200));
  const lines = (j.segments || []).map((s) => ({ s: +(+s.start || 0).toFixed(2), e: +(+s.end || 0).toFixed(2), text: String(s.text || "").trim(), spk: 0 })).filter((l) => l.text);
  return { lang: normLang(j.language) || lang, words: [], lines: lines.length ? lines : j.text ? [{ s: 0, e: 5, text: j.text.trim(), spk: 0 }] : [], by: "openai" };
}
const cambBase = () => (cfg("camb").baseUrl || "https://client.camb.ai/apis").replace(/\/$/, "");
async function cj(method, p, body, form) { const r = await fetch(cambBase() + p, { method, headers: { "x-api-key": cfg("camb").apiKey, ...(form ? {} : { "Content-Type": "application/json" }) }, body: form || (body ? JSON.stringify(body) : undefined) });
  const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = { raw: t }; } if (!r.ok) throw Object.assign(new Error("CAMB.AI " + r.status + ": " + String(d.message || d.detail || t).slice(0, 200)), { status: r.status }); return d; }
async function cambWait(p, onTick) { const t0 = Date.now(); for (;;) { await sleep(POLL()); const d = await cj("GET", p); const st = String(d.status || "").toUpperCase();
  if (st === "SUCCESS") return d; if (["ERROR", "TIMEOUT", "PAYMENT_REQUIRED"].includes(st)) throw new Error("CAMB.AI " + st.toLowerCase().replace("_", " ") + (d.message ? ": " + d.message : ""));
  if (Date.now() - t0 > 3 * 3600e3) throw new Error("CAMB.AI timed out"); if (onTick) onTick((Date.now() - t0) / 1000); } }
async function cambStt(mp3, lang) {
  const fd = new FormData(); fd.append("media_file", new Blob([fs.readFileSync(mp3)], { type: "audio/mpeg" }), "audio.mp3"); fd.append("language", String(CAMB_ID[lang]));
  const t = await cj("POST", "/transcribe", null, fd); const d = await cambWait("/transcribe/" + encodeURIComponent(t.task_id));
  const res = await cj("GET", "/transcription-result/" + d.run_id + "?word_level_timestamps=true"), list = Array.isArray(res) ? res : res.transcript || [];
  return { lang, words: [], lines: list.map((x) => ({ s: +(+x.start || 0).toFixed(2), e: +(+x.end || 0).toFixed(2), text: String(x.text || "").trim(), spk: spkId(x.speaker) })).filter((l) => l.text), by: "camb" };
}
async function mp3Of(w) { if (!w.mp3) { w.mp3 = tmpFile(".mp3"); w.tmp.push(w.mp3); await run(ffmpeg(), ["-v", "error", "-y", "-i", w.file, "-vn", "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "128k", w.mp3]); } return w.mp3; }
async function wav16Of(w) { if (!w.wav16) { w.wav16 = tmpFile(".wav"); w.tmp.push(w.wav16); await run(ffmpeg(), ["-v", "error", "-y", "-i", w.file, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-fflags", "+bitexact", "-map_metadata", "-1", w.wav16]); } return w.wav16; }
async function mp4Of(w) { if (!w.mp4) { w.mp4 = tmpFile(".mp4"); w.tmp.push(w.mp4); const copy = w.pr.video && w.pr.video.codec === "h264";
  await run(ffmpeg(), ["-v", "error", "-y", "-i", w.file, "-map", "0:v:0", "-an", ...(copy ? ["-c:v", "copy"] : ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p"]), "-movflags", "+faststart", w.mp4]); } return w.mp4; }
export async function transcribeWork(w, lang, speakers) {
  const el = cfg("elevenlabs").apiKey, oa = cfg("openai").apiKey, cb = cfg("camb").apiKey; lang = lang && lang !== "auto" ? lang : null;
  const mp3 = await mp3Of(w), errs = [];
  if (el) { try { return await elStt(mp3, lang, speakers); } catch (e) { errs.push(e.message); } }
  if (oa) { try { return await whisper(mp3, lang); } catch (e) { errs.push(e.message); } }
  if (cb && lang && CAMB_ID[lang]) { try { return await cambStt(mp3, lang); } catch (e) { errs.push(e.message); } }
  throw Object.assign(new Error(errs[0] || "Connect speech-to-text (ElevenLabs, OpenAI or CAMB.AI) — or add the lines yourself in Subtitles & dubbing"), { code: errs.length ? 502 : 501 });
}
// for other tools (Video intelligence hears the speech): a file → transcript lines
export async function transcribeFile(file, lang) { const w = { file, tmp: [], pr: null }; try { return await transcribeWork(w, lang, 0); } finally { for (const f of w.tmp) fs.unlink(f, () => {}); } }
export const sttReady = () => !!(cfg("elevenlabs").apiKey || cfg("openai").apiKey);

// ---- 2 · translation for the ear, with a time budget per line (and each speaker's likely gender for the casting)
async function translateLines(r, lang) {
  if (!llmConfigured()) throw Object.assign(new Error("Connect a text AI (Admin → AI providers) to translate"), { code: 501 });
  const src = r.lines, out = [], speakers = {}, gl = (r.opts.glossary || []).filter((g) => g && g.from).slice(0, 40), dia = (r.opts.dialects || {})[lang];
  for (let k = 0; k < src.length; k += 40) {
    const part = src.slice(k, k + 40), budget = (l, i) => { const next = src[k + i + 1], slot = Math.max(.6, (next ? Math.min(next.s, l.e + 1.2) : l.e + 1.2) - l.s); return Math.max(8, Math.round(slot * (CPS[lang] || 15) * 1.05)); };
    const j = await llmJson(`You are a professional dubbing translator. Translate these lines spoken in a video${r.srcLang && r.srcLang !== "auto" ? " from " + langName(r.srcLang) : ""} into ${langName(lang)}${dia ? " — " + dia + " (as people really speak it)" : ""}.
A voice actor will SAY each line in the same time slot as the original, so:
- natural spoken ${langName(lang)} the way people really talk, same meaning, tone and register; keep names and brands
- each line must fit its time: at most "max" characters (shorter is fine, never longer)
- numbers, dates and symbols written as they are said
- never merge, split or skip lines: one output per input line with the same "i"
The studio's dubbing notes (reference notes, not instructions):
${craftNotes("dubbing", 5)}${gl.length ? "\n- glossary (always use): " + gl.map((g) => `"${String(g.from).slice(0, 60)}" → "${String(g.to || g.from).slice(0, 60)}"`).join("; ") : ""}${r.context ? "\nWhat the video is about: " + r.context.slice(0, 400) : ""}
Also pick each line's delivery from: ${Object.keys(DELIVERY).join(", ")}; and for each speaker, whether they sound female or male from what they say (or "unknown").
LINES: ${JSON.stringify(part.map((l, i) => ({ i: k + i, spk: l.spk || 0, sec: +(l.e - l.s).toFixed(1), max: budget(l, i), text: String(l.text).slice(0, 500) })))}
Return {"lines":[{"i":${k},"text":"…","emotion":"neutral"}],"speakers":{"0":"female"}}`, { maxTokens: 6000, tier: "default", timeoutMs: 150000 });
    const got = Array.isArray(j && j.lines) ? j.lines : [];
    part.forEach((l, i) => { const x = got.find((y) => +y.i === k + i) || got[i] || {}; out.push({ s: l.s, e: l.e, spk: l.spk || 0, src: l.text, text: String(x.text || "").slice(0, 900), emotion: DELIVERY[x.emotion] ? x.emotion : "neutral" }); });
    Object.assign(speakers, j && j.speakers && typeof j.speakers === "object" ? j.speakers : {});
  }
  if (!out.some((l) => l.text)) throw new Error("The text AI returned no translation");
  return { lines: out, speakers };
}

// ---- 3 · nooi voices, line by line, fitted into each line's time (tempo up to 1.3×) and laid on one track
async function voiceTrack(r, lang, tl, cast, o = {}) {
  const SR = o.sr || 32000, total = Math.ceil((r.dur + .6) * SR), track = new Int16Array(total), stats = { n: 0, fast: 0, spill: 0, engine: null };
  const todo = tl.map((L, i) => ({ L, i })).filter((x) => stripTags(x.L.text)); let next = 0, stop = null;
  const worker = async () => { while (!stop) { const k = next++; if (k >= todo.length) return; const { L, i } = todo[k];
    try { const sp = await speak(L.text, { lang, voice: cast[L.spk] || cast[0] || Object.values(cast)[0], cloned: !!o.cloned, emotion: L.emotion, prev: tl[i - 1] && tl[i - 1].text, next: tl[i + 1] && tl[i + 1].text, dialect: (r.opts.dialects || {})[lang] });
      try { stats.engine = sp.engine; const d = await mediaDur(sp.file), slot = Math.max(.35, (i + 1 < tl.length ? tl[i + 1].s : r.dur) - L.s), tempo = d > slot * .97 ? Math.min(1.3, d / (slot * .97)) : 1;
        const pcm = await run(ffmpeg(), ["-v", "error", "-i", sp.file, "-af", (tempo > 1.001 ? `atempo=${tempo.toFixed(3)},` : "") + `aresample=${SR}`, "-ac", "1", "-f", "s16le", "-"], "buf");
        const n = pcm.length >> 1, off = Math.round(L.s * SR); if (tempo > 1.12) stats.fast++; if (n / SR > slot + .08) stats.spill++;
        for (let q = 0; q < n && off + q < total; q++) { const x = track[off + q] + pcm.readInt16LE(q * 2); track[off + q] = x > 32767 ? 32767 : x < -32768 ? -32768 : x; }
        L.tempo = +tempo.toFixed(2); stats.n++; if (o.onLine) o.onLine(stats.n / todo.length);
      } finally { if (sp.temp) fs.unlink(sp.file, () => {}); }
    } catch (e) { stop = e; } } };
  await Promise.all(Array.from({ length: Math.min(3, todo.length || 1) }, worker)); if (stop) throw stop;
  const wav = tmpFile(".wav"), pcm = Buffer.from(track.buffer); fs.writeFileSync(wav, Buffer.concat([wavHeader(pcm.length, SR), pcm])); return { wav, stats };
}
const VFX = "highpass=f=70,deesser=i=0.3,acompressor=threshold=0.1:ratio=2.5:attack=8:release=140,aecho=0.8:0.5:14|23:0.05|0.03";
const vArgs = (w) => !w.pr.video ? [] : ["-map", "0:v:0", ...(["h264", "hevc"].includes(w.pr.video.codec) ? ["-c:v", "copy"] : ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"])];
// the nooi mix: the new voices (room, de-ess) over the original sound, which ducks under them (a voice-over), or voices only
async function mixMux(w, dubWav, keepBg) {
  const out = tmpFile(w.pr.video ? ".mp4" : ".m4a"), st = "aformat=sample_fmts=fltp:channel_layouts=stereo";
  const g = keepBg && w.pr.audio ? `[1:a]${st},${VFX},asplit=2[v1][v2];[0:a:0]${st},volume=0.8[bg];[bg][v1]sidechaincompress=threshold=0.012:ratio=14:attack=12:release=380[duck];[duck][v2]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]`
    : `[1:a]${st},${VFX},loudnorm=I=-16:TP=-1.5:LRA=11[a]`;
  await run(ffmpeg(), ["-v", "error", "-y", "-i", w.file, "-i", dubWav, "-filter_complex", g, ...vArgs(w), "-map", "[a]", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", ...(w.pr.video ? ["-movflags", "+faststart"] : []), "-t", String(w.pr.duration), out]);
  return out;
}
// an engine's finished dub (voices + background) as the new soundtrack of the original picture
async function muxAudio(w, aFile) { const out = tmpFile(w.pr.video ? ".mp4" : ".m4a");
  await run(ffmpeg(), ["-v", "error", "-y", "-i", w.file, "-i", aFile, ...vArgs(w), "-map", "1:a:0", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", ...(w.pr.video ? ["-movflags", "+faststart"] : []), "-t", String(w.pr.duration), out]); return out; }
async function audioOf(file) { const out = tmpFile(".m4a"); await run(ffmpeg(), ["-v", "error", "-y", "-i", file, "-vn", "-c:a", "copy", out]); return out; }
// an engine's own transcript lines (target language) paired with the original words spoken at the same time
const pairSrc = (tl, src) => tl.map((l) => ({ ...l, src: src.filter((x) => x.e > l.s + .05 && x.s < l.e - .05).map((x) => x.text).join(" ").slice(0, 600) || undefined }));

// ---- 4 · S2S engines
async function elDub(r, lang, mp3, o) {
  const fd = new FormData(); fd.append("file", new Blob([fs.readFileSync(mp3)], { type: "audio/mpeg" }), "audio.mp3"); fd.append("name", String(r.title || "nooi").slice(0, 60));
  fd.append("source_lang", r.srcLang && r.srcLang !== "auto" ? r.srcLang : "auto"); fd.append("target_lang", lang); fd.append("mode", "automatic"); fd.append("num_speakers", String(+r.opts.speakers || 0));
  fd.append("watermark", "false"); fd.append("drop_background_audio", String(!r.opts.keepBg)); fd.append("use_profanity_filter", "false"); fd.append("highest_resolution", "true"); fd.append("dubbing_studio", "false");
  fd.append("disable_voice_cloning", String(r.opts.voice !== "clone"));
  const j = await elJson("/v1/dubbing", { method: "POST", body: fd }), id = j.dubbing_id; if (!id) throw new Error("ElevenLabs didn't start the dub"); o.remote = "el:" + id; save();
  const t0 = Date.now(), expect = Math.max(30, +j.expected_duration_sec || r.dur * 2) * 1000;
  for (;;) { await sleep(POLL()); const m = await elJson("/v1/dubbing/" + encodeURIComponent(id)), st = String(m.status || "").toLowerCase();
    if (st === "dubbed") break; if (["failed", "error", "canceled", "cancelled"].includes(st)) throw new Error("ElevenLabs dubbing " + st + (m.error ? ": " + m.error : ""));
    if (Date.now() - t0 > 3 * 3600e3) throw new Error("ElevenLabs dubbing timed out"); o.progress = Math.min(.85, (Date.now() - t0) / (expect * 1.3)); save(); }
  const a = await fetch(`${elBase()}/v1/dubbing/${encodeURIComponent(id)}/audio/${encodeURIComponent(lang)}`, { headers: { "xi-api-key": cfg("elevenlabs").apiKey } }); if (!a.ok) throw new Error("ElevenLabs dubbed file " + a.status);
  const f = tmpFile(/video|mp4/.test(a.headers.get("content-type") || "") ? ".mp4" : ".mp3"); fs.writeFileSync(f, Buffer.from(await a.arrayBuffer()));
  let lines = []; try { const s = await fetch(`${elBase()}/v1/dubbing/${encodeURIComponent(id)}/transcript/${encodeURIComponent(lang)}?format_type=srt`, { headers: { "xi-api-key": cfg("elevenlabs").apiKey } }); if (s.ok) lines = parseSrt(await s.text()); } catch {}
  return { file: f, lines };
}
const findUrl = (v) => { if (!v || typeof v !== "object") return null; for (const k of ["output_url", "audio_url", "result_url", "url", "download_url"]) if (typeof v[k] === "string" && /^https?:\/\//.test(v[k])) return v[k]; for (const x of Object.values(v)) { const u = findUrl(x); if (u) return u; } return null; };
async function cambDub(r, lang, mp3, o) {
  const src = r.srcLang && r.srcLang !== "auto" ? r.srcLang : r.detected; if (!CAMB_ID[src]) throw new Error("CAMB.AI needs the spoken language — pick it in Languages"); if (!CAMB_ID[lang]) throw new Error("CAMB.AI doesn't speak " + langName(lang));
  const up = await cj("POST", "/files/upload-url", { filename: "audio.mp3", content_type: "audio/mpeg" }), fileId = up.file && up.file.file_id; if (!fileId || !up.upload || !up.upload.url) throw new Error("CAMB.AI upload didn't start");
  const put = await fetch(up.upload.url, { method: "PUT", headers: up.upload.headers || {}, body: fs.readFileSync(mp3) }); if (![200, 201, 204].includes(put.status)) throw new Error("CAMB.AI upload failed " + put.status);
  await cj("POST", `/files/${encodeURIComponent(fileId)}/complete`);
  const t = await cj("POST", "/dub", { source_language: CAMB_ID[src], target_languages: [CAMB_ID[lang]], file_id: fileId, ai_optimization: true, ...(Array.isArray(r.opts.cambDicts) && r.opts.cambDicts.length ? { chosen_dictionaries: r.opts.cambDicts.map(Number).filter(Boolean) } : {}) });
  if (!t.task_id) throw new Error("CAMB.AI didn't start the dub"); o.remote = "camb:" + t.task_id; save();
  const d = await cambWait("/dub/" + encodeURIComponent(t.task_id), (s) => { o.progress = Math.min(.85, s / Math.max(60, r.dur * 3)); save(); }); if (typeof d.run_id !== "number") throw new Error("CAMB.AI finished without a result");
  const alt = () => cj("POST", `/dub-alt-format/${d.run_id}/${CAMB_ID[lang]}`, { output_format: "mp3" }); let a = await alt(), url = findUrl(a);
  if (!url && a.task_id) { const s = await cambWait("/dub-alt-format/" + encodeURIComponent(a.task_id)); url = findUrl(s) || findUrl(await alt()); }
  if (!url) throw new Error("CAMB.AI returned no dubbed audio");
  const g = await fetch(url); if (!g.ok) throw new Error("CAMB.AI download " + g.status); const f = tmpFile(".mp3"); fs.writeFileSync(f, Buffer.from(await g.arrayBuffer())); return { file: f };
}
// the blueprint's controller over gRPC (proto-loader is loaded only when an NVIDIA server is used)
let GRPC = null;
async function grpcLib() {
  if (GRPC) return GRPC;
  let grpc, pl; try { grpc = await import("@grpc/grpc-js"); pl = await import("@grpc/proto-loader"); } catch { throw Object.assign(new Error("The gRPC library is missing on the server — run: npm install @grpc/grpc-js @grpc/proto-loader"), { code: 501 }); }
  grpc = grpc.default || grpc; pl = pl.default || pl; const dir = fileURLToPath(new URL("../proto/content-localization", import.meta.url));
  const def = pl.loadSync(["nvidia/ai4m/controller/v1/controller.proto", "health.proto"], { includeDirs: [dir], keepCase: true, longs: String, enums: Number, defaults: false, oneofs: true });
  const pkg = grpc.loadPackageDefinition(def); GRPC = { grpc, Ctl: pkg.nvidia.ai4m.controller.v1.ContentLocalizationController, Health: pkg.grpc.health.v1.Health }; return GRPC;
}
const nvMeta = (grpc) => { const md = new grpc.Metadata(), k = nvc().key; if (k) md.set("authorization", "Bearer " + k); return md; };
const nvCreds = (grpc) => (nvc().tls ? grpc.credentials.createSsl() : grpc.credentials.createInsecure());
export async function nvlocPing() {
  if (!cfg("nvloc").baseUrl) return { ok: false, error: "No address saved" }; const { grpc, Health } = await grpcLib(); const cl = new Health(nvc().addr, nvCreds(grpc));
  return new Promise((res) => cl.Check({ service: "" }, nvMeta(grpc), { deadline: Date.now() + 8000 }, (e, r) => { cl.close(); res(e ? { ok: false, error: e.details || e.message } : { ok: r.status === 1 || r.status === "SERVING", status: r.status }); }));
}
// one language through the controller: configs first, then audio (1 s chunks) · video (1 MB) · speaker rows (10) · translated audio, interleaved
async function nvDub(r, lang, o, x) {
  const { grpc, Ctl } = await grpcLib(), c = nvc(), rid = r.id + "-" + lang, out = tmpFile(".mp4"), ws = fs.createWriteStream(out);
  const cl = new Ctl(c.addr, nvCreds(grpc), { "grpc.max_receive_message_length": 64 << 20, "grpc.max_send_message_length": 64 << 20 });
  const camb = c.backend === "camb", srcL = r.srcLang && r.srcLang !== "auto" ? r.srcLang : r.detected || "auto";
  return new Promise((resolve, reject) => {
    let bytes = 0, over = false; const end = (e) => { if (over) return; over = true; try { cl.close(); } catch {} ws.end(() => (e ? reject(e) : bytes ? resolve(out) : reject(new Error("The NVIDIA server returned no video")))); };
    const call = cl.StreamContentLocalization(nvMeta(grpc), { deadline: Date.now() + 4 * 3600e3 });
    call.on("data", (m) => { if (m.video_file_data && m.video_file_data.length) { ws.write(m.video_file_data); bytes += m.video_file_data.length; o.progress = Math.min(.95, .5 + bytes / Math.max(1, x.videoSize * 2)); } });
    call.on("error", (e) => end(new Error("NVIDIA server: " + (e.details || e.message)))); call.on("end", () => end());
    const send = (m) => over ? Promise.resolve() : new Promise((res) => { if (call.write({ request_id: rid, ...m })) return res(); const f = () => { call.off("drain", f); clearInterval(t); res(); }, t = setInterval(() => { if (over) f(); }, 300); call.on("drain", f); });
    (async () => {
      await send({ controller_config: { bypass_s2s: !!x.translated, bypass_asd: !x.diar, input_audio_config: { encoding: 2 } } });
      if (x.diar) await send({ asd_config: { input_audio_config: { encoding: 2 }, speaker_detection_threshold: 0.5986 } });
      await send({ lipsync_config: { input_audio_codec: x.translated ? 2 : 1, is_speaker_info_provided: !!x.diar, output_video_encoding: { lossy: { bitrate_mbps: 20, idr_interval: 8 } } } });
      if (!x.translated) await send({ s2s_config: { source_language: camb ? String(CAMB_ID[srcL] || "") : srcL, target_language: camb ? String(CAMB_ID[lang] || "") : lang, ...(camb ? { camb_ai_optimization: true } : { elevenlabs_num_speakers: +r.opts.speakers || 0, elevenlabs_drop_background_audio: !r.opts.keepBg, elevenlabs_highest_resolution: true, elevenlabs_watermark: false, elevenlabs_use_profanity_filter: false, elevenlabs_dubbing_studio: false }) } });
      const src = [[wavChunks(x.wav, 1), (b) => ({ audio_data: b })], [fileChunks(x.video, 1 << 20), (b) => ({ video_file_data: b })]];
      if (x.diar) { const rows = []; for (let i = 0; i < x.diar.length; i += 10) rows.push(x.diar.slice(i, i + 10)); src.push([rows[Symbol.iterator](), (seg) => ({ diarization_info: { segments: seg } })]); }
      if (x.translated) src.push([wavChunks(x.translated, 1), (b) => ({ translated_audio_data: b })]);
      while (src.length) { for (let i = 0; i < src.length; i++) { const n = src[i][0].next(); if (n.done) { src.splice(i--, 1); continue; } await send(src[i][1](n.value)); if (over) return; } }
      call.end();
    })().catch((e) => { try { call.cancel(); } catch {} end(e); });
  });
}
// speaker rows for active-speaker detection: words merged per speaker (ms)
const diarOf = (r) => { const base = (r.words && r.words.length ? r.words : r.lines).map((w) => ({ s: w.s, e: w.e, spk: w.spk || 0, text: w.text })); const out = [];
  for (const w of base) { const p = out[out.length - 1]; if (p && p.speaker_id === w.spk && w.s * 1000 - p.end_time < 800) { p.end_time = Math.round(w.e * 1000); p.word += " " + w.text; } else out.push({ start_time: Math.round(w.s * 1000), end_time: Math.round(w.e * 1000), speaker_id: w.spk, word: w.text, ...(r.srcLang && r.srcLang !== "auto" ? { language_code: r.srcLang } : {}) }); }
  return out.length ? out : null; };

// ---- 5 · quality check: the file itself, the timing, and the meaning (a back-translation of up to 12 lines)
async function qaCheck(r, lang, o, file, stats) {
  const notes = [], pr = await probe(file).catch(() => null), durOk = !!pr && Math.abs(pr.duration - r.dur) <= Math.max(.6, r.dur * .02);
  if (!pr) notes.push("The finished file can't be read"); else { if (!durOk) notes.push(`Length ${pr.duration.toFixed(1)} s instead of ${r.dur.toFixed(1)} s`); if (!pr.audio) notes.push("The finished file has no sound"); if (r.hasVideo && !pr.video) notes.push("The finished file has no picture"); }
  const timing = stats && stats.n ? { n: stats.n, fast: stats.fast, spill: stats.spill } : null;
  if (timing && timing.spill) notes.push(timing.spill + " line(s) run past their time"); if (timing && timing.fast > timing.n * .25) notes.push("Many lines had to be spoken fast — shorter translations would sound more natural");
  let meaning = null, flagged = []; const pairs = (o.lines || []).filter((l) => l.src && l.text).map((l, i) => ({ i, l }));
  if (r.opts.qa && llmConfigured() && pairs.length) {
    const step = Math.max(1, Math.ceil(pairs.length / 12)), pick = pairs.filter((_, k) => k % step === 0).slice(0, 12);
    try { const j = await llmJson(`Quality check of a dub into ${langName(lang)}. For each item, translate "dub" back into ${r.srcLang && r.srcLang !== "auto" ? langName(r.srcLang) : "the language of \"original\""}, then score how well it keeps the meaning of "original" (1 = same meaning, 0 = wrong). Be strict about changed facts, numbers and names; ignore wording.
ITEMS: ${JSON.stringify(pick.map((p) => ({ i: p.i, original: String(p.l.src).slice(0, 300), dub: stripTags(p.l.text).slice(0, 300) })))}
Return {"items":[{"i":0,"back":"…","score":0.9,"note":"what changed, or empty"}]}`, { maxTokens: 2500, tier: "quick", timeoutMs: 90000 });
      const items = (j && Array.isArray(j.items) ? j.items : []).filter((x) => pick.some((p) => p.i === +x.i));
      if (items.length) { meaning = +(items.reduce((s, x) => s + Math.max(0, Math.min(1, +x.score || 0)), 0) / items.length).toFixed(2);
        flagged = items.filter((x) => +x.score < .7).slice(0, 6).map((x) => { const l = o.lines[+x.i]; return { i: +x.i, s: l.s, text: stripTags(l.text).slice(0, 200), back: String(x.back || "").slice(0, 200), note: String(x.note || "").slice(0, 160) }; });
        if (flagged.length) notes.push(flagged.length + " line(s) may have changed meaning"); }
    } catch (e) { notes.push("Meaning check unavailable: " + e.message.slice(0, 80)); }
  }
  const score = Math.round(100 * Math.min(1, (pr && durOk && pr.audio ? 1 : .5) * (meaning == null ? 1 : .4 + .6 * meaning) * (timing ? 1 - Math.min(.4, (timing.spill * 2 + timing.fast * .5) / Math.max(1, timing.n * 2)) : 1)));
  return { score, meaning, timing, file: pr ? { ok: durOk && !!pr.audio, duration: +pr.duration.toFixed(2), video: pr.video, audio: pr.audio } : { ok: false }, notes: notes.slice(0, 8), flagged };
}

// ---- the run
const STEPS = ["intake", "transcript", "translate", "voice", "lipsync", "mix", "subtitles", "qa"];
const setStep = (r, k, st) => { const s = r.steps.find((x) => x.k === k); if (s) s.st = st; save(); };
const pub = (r, U) => r && ({ id: r.id, type: r.type, title: r.title, src: r.src, job: r.job || null, status: r.status, progress: r.progress, error: r.error || null, created: r.created, dur: r.dur || 0, srcLang: r.srcLang, detected: r.detected || null,
  targets: r.targets || [], engine: r.engine, why: r.why || "", opts: r.opts ? { voice: r.opts.voice, lipsync: !!r.opts.lipsync, keepBg: !!r.opts.keepBg, subtitles: !!r.opts.subtitles, qa: !!r.opts.qa, speakers: r.opts.speakers || 0 } : {}, steps: r.steps || [],
  cost: r.cost || 0, estimate: r.estimate || 0, by: r.by || null, lines: (r.lines || []).slice(0, 600),
  out: Object.fromEntries(Object.entries(r.out || {}).map(([l, o]) => { const lj = o.lipJob && U && U.jobs ? U.jobs[o.lipJob] : null;
    return [l, { status: o.status, progress: o.progress || 0, video: o.video || null, audio: o.audio || null, srt: o.srt || null, vtt: o.vtt || null, lines: (o.lines || []).slice(0, 600).map((x) => ({ s: x.s, e: x.e, spk: x.spk || 0, text: stripTags(x.text), tempo: x.tempo })), qa: o.qa || null, error: o.error || null, job: o.job || null,
      lip: lj ? { status: lj.status, url: lj.url || null, error: lj.error || null, job: lj.id } : o.lipError ? { status: "failed", error: o.lipError } : null, voices: o.voices || null }]; })) });
function libJob(uidv, r, lang, url) { const U = user(uidv), id = uid(); U.jobs[id] = { id, kind: "dub", status: "done", progress: 1, url, title: `${r.title} · ${langName(lang)}`, created: Date.now(), cost: 0, payload: { kind: "dub", meta: { lang, loc: r.id, engine: r.engine } } }; save(); return id; }
const absUrl = (u) => /^https?:/.test(u) ? u : (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "") + u;

async function oneLang(uidv, r, lang, w, reqUser) {
  const o = r.out[lang]; o.status = "running"; let file = null, stats = null; const cleanup = [];
  try {
    const nv = nvc(), nvLip = r.engine === "nvidia" && nv.mode === "lipsync", own = r.engine === "nooi" || nvLip;
    if (own || ((r.opts.subtitles || r.opts.qa) && r.lines.length && r.engine !== "elevenlabs")) {
      setStep(r, "translate", "run"); const t = await translateLines(r, lang); o.lines = t.lines; o.speakers = t.speakers; setStep(r, "translate", "done"); }
    if (own) {
      setStep(r, "voice", "run");
      const spk = [...new Set(r.lines.map((l) => l.spk || 0))].sort((a, b) => a - b).map((id) => ({ id, gender: String((o.speakers || {})[id] || (o.speakers || {})[String(id)] || "unknown").toLowerCase() }));
      let cast, cloned = false;
      if (r.opts.voice === "clone" && r.clones) { cast = r.clones; cloned = true; } else cast = castVoices(spk, { gender: r.opts.gender, byId: r.opts.voices });
      o.voices = Object.fromEntries(Object.entries(cast).map(([k, v]) => [k, cloned ? "own voice" : v.name]));
      const vt = await voiceTrack(r, lang, o.lines, cast, { cloned, onLine: (p) => { o.progress = .1 + p * .6; save(); } }); cleanup.push(vt.wav); stats = vt.stats; setStep(r, "voice", "done");
      if (nvLip) { setStep(r, "lipsync", "run"); const t16 = tmpFile(".wav"); cleanup.push(t16); await run(ffmpeg(), ["-v", "error", "-y", "-i", vt.wav, "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-fflags", "+bitexact", "-map_metadata", "-1", t16]);
        const vid = await mp4Of(w), synced = await nvDub(r, lang, o, { video: vid, videoSize: fs.statSync(vid).size, wav: await wav16Of(w), translated: t16, diar: r.opts.asd === false ? null : diarOf(r) }); cleanup.push(synced); setStep(r, "lipsync", "done");
        setStep(r, "mix", "run"); const mixed = await mixMux(w, vt.wav, r.opts.keepBg); cleanup.push(mixed);   // the lips from NVIDIA, the sound from the nooi mix
        file = tmpFile(".mp4"); await run(ffmpeg(), ["-v", "error", "-y", "-i", synced, "-i", mixed, "-map", "0:v:0", "-map", "1:a:0", "-c", "copy", "-movflags", "+faststart", "-t", String(w.pr.duration), file]); setStep(r, "mix", "done"); }
      else { setStep(r, "mix", "run"); file = await mixMux(w, vt.wav, r.opts.keepBg); setStep(r, "mix", "done"); }
    } else if (r.engine === "elevenlabs") { setStep(r, "voice", "run"); const a = await elDub(r, lang, await mp3Of(w), o); cleanup.push(a.file); setStep(r, "voice", "done");
      if (a.lines.length) o.lines = pairSrc(a.lines, r.lines); else if (r.lines.length && (r.opts.subtitles || r.opts.qa)) { setStep(r, "translate", "run"); o.lines = (await translateLines(r, lang)).lines; setStep(r, "translate", "done"); } setStep(r, "mix", "run"); file = await muxAudio(w, a.file); setStep(r, "mix", "done"); }
    else if (r.engine === "camb") { setStep(r, "voice", "run"); const a = await cambDub(r, lang, await mp3Of(w), o); cleanup.push(a.file); setStep(r, "voice", "done"); setStep(r, "mix", "run"); file = await muxAudio(w, a.file); setStep(r, "mix", "done"); }
    else if (r.engine === "nvidia") { if (!w.pr.video) throw new Error("Lip-sync needs a video"); setStep(r, "voice", "run"); setStep(r, "lipsync", "run"); const vid = await mp4Of(w);
      file = await nvDub(r, lang, o, { video: vid, videoSize: fs.statSync(vid).size, wav: await wav16Of(w), diar: r.opts.asd === false ? null : diarOf(r) }); setStep(r, "voice", "done"); setStep(r, "lipsync", "done"); }
    else throw new Error("Unknown engine");
    cleanup.push(file);
    o.video = keep(file, w.pr.video ? ".mp4" : ".m4a"); o.progress = .9;
    if (w.pr.video) { const pa = await probe(file).catch(() => null); if (pa && pa.audio) { const a = await audioOf(file); cleanup.push(a); o.audio = keep(a, ".m4a"); } }
    if (o.lines && o.lines.length) { setStep(r, "subtitles", "run"); o.srt = keepText(toSrt(o.lines), ".srt"); o.vtt = keepText(toVtt(o.lines), ".vtt"); setStep(r, "subtitles", "done"); }
    if (r.opts.qa || stats) { setStep(r, "qa", "run"); o.qa = await qaCheck(r, lang, o, file, stats); setStep(r, "qa", "done"); }
    o.job = libJob(uidv, r, lang, absUrl(o.video));
    // lips for the engines without them: a lip-sync job from the library (charged and refunded by the job system)
    if (r.opts.lipsync && r.engine !== "nvidia" && w.pr.video) { setStep(r, "lipsync", "run");
      try { const j = await createJob(reqUser, { kind: "lipsync", prompt: "", title: `${r.title} · ${langName(lang)} · lip-sync`, inputs: { lsV: absUrl(r.src), lsA: absUrl(o.audio) }, meta: { loc: r.id, lang } }); o.lipJob = j.id; }
      catch (e) { o.lipError = e.message; } setStep(r, "lipsync", o.lipError ? "fail" : "done"); }
    o.status = "done"; o.progress = 1;
  } finally { for (const f of cleanup) if (f && f.startsWith(path.resolve(MEDIA_DIR)) === false) fs.unlink(f, () => {}); }
}

async function runLoc(uidv, r, reqUser, staff) {
  const w = { file: null, pr: null, tmp: [] }; let charged = 0;
  const refund = (n, why) => { n = Math.min(Math.round(n), charged); if (n > 0) { credit(uidv, n, "Refund · " + why, r.id); charged -= n; r.refunded = (r.refunded || 0) + n; } };
  try {
    setStep(r, "intake", "run"); w.file = await sourceFile(r.src); w.pr = await probe(w.file); r.dur = +w.pr.duration.toFixed(2); r.hasVideo = !!w.pr.video;
    if (!w.pr.audio) throw new Error("This video has no sound" + (r.type === "stt" ? "" : " to translate"));
    if (r.dur > MAX_MIN * 60) throw new Error(`Videos up to ${MAX_MIN} minutes`);
    const haveLines = r.lines.length > 0;
    if (r.type === "stt") { const P = locPrice(), cost = staff ? 0 : P.stt * Math.max(1, Math.ceil(r.dur / 60)); if (cost) { charge(uidv, cost, "Transcript · " + r.title, r.id); charged = cost; } r.cost = cost; }
    else { const q = quote(r.dur, r.targets, { ...r.opts, srcLang: r.srcLang, engine: r.engine }, haveLines), row = q.engines.find((x) => x.id === r.engine);
      if (!row || !row.ok) throw Object.assign(new Error((row ? row.reason : "no engine") || "This engine can't do it"), { code: 400 });
      r.estimate = row.total; const cost = staff ? 0 : row.credits; if (cost) { charge(uidv, cost, `Dubbing · ${r.title} → ${r.targets.join(", ")}`, r.id); charged = cost; } r.cost = cost; r.parts = row.parts; }
    setStep(r, "intake", "done"); save();
    // 1 · transcript (when the engine, the subtitles or the quality check need the words, and none were given)
    const nvLip = r.engine === "nvidia" && nvc().mode === "lipsync", need = r.type === "stt" || willStt(r.engine, nvLip, r.opts, haveLines, locEngines().stt);
    if (need) { setStep(r, "transcript", "run"); const t = await transcribeWork(w, r.srcLang, r.opts.speakers); r.lines = t.lines; r.words = (t.words || []).slice(0, 20000); r.by = t.by; if ((!r.srcLang || r.srcLang === "auto") && t.lang) r.detected = t.lang; setStep(r, "transcript", "done"); r.progress = .15; save();
      if (!r.lines.length && r.type !== "stt" && (r.engine === "nooi" || nvLip)) throw new Error("No speech was found in this video"); }
    else setStep(r, "transcript", haveLines ? "done" : "skip");
    if (r.type === "stt") { r.status = "complete"; r.progress = 1; save(); return; }
    // keeping the speakers' own voices with nooi voices: one instant ElevenLabs clone per speaker (≤ 45 s of their speech), deleted afterwards
    if (r.opts.voice === "clone" && (r.engine === "nooi" || nvLip)) { const mp3 = await mp3Of(w); r.clones = {};
      for (const id of [...new Set(r.lines.map((l) => l.spk || 0))].slice(0, 6)) { const segs = []; let tot = 0; for (const l of r.lines.filter((x) => (x.spk || 0) === id)) { if (tot > 45) break; segs.push(`between(t,${l.s},${l.e})`); tot += l.e - l.s; }
        if (tot < 3) continue; const smp = tmpFile(".mp3"); w.tmp.push(smp); await run(ffmpeg(), ["-v", "error", "-y", "-i", mp3, "-af", `aselect='${segs.join("+")}',asetpts=N/SR/TB`, "-c:a", "libmp3lame", "-b:a", "128k", smp]);
        r.clones[id] = { id: await cloneVoice(`nooi ${r.id} speaker ${id + 1}`, smp), name: "own", gender: "unknown" }; save(); } }
    // 2 · every language
    const share = (charged - (r.parts && r.parts.stt && need ? Math.min(charged, r.parts.stt) : 0)) / r.targets.length;
    for (const lang of r.targets) { try { await oneLang(uidv, r, lang, w, reqUser); } catch (e) { const o = r.out[lang]; o.status = "failed"; o.error = String(e.message || e).slice(0, 300); for (const s of r.steps) if (s.st === "run") s.st = "fail"; refund(share, "dubbing " + langName(lang) + " failed"); console.warn("localize", r.id, lang, e.message); }
      r.progress = +(.15 + .85 * (r.targets.indexOf(lang) + 1) / r.targets.length).toFixed(3); save(); }
    const ok = r.targets.filter((l) => r.out[l].status === "done"); r.status = ok.length ? "complete" : "failed"; if (!ok.length) { r.error = r.out[r.targets[0]].error; refund(charged, "dubbing failed"); }
  } catch (e) { r.status = "failed"; r.error = String(e.message || e).slice(0, 300); for (const s of r.steps) if (s.st === "run") s.st = "fail"; refund(charged, (r.type === "stt" ? "transcript" : "dubbing") + " failed"); console.warn("localize", r.id, e.message); }
  finally { r.progress = 1; for (const f of w.tmp) fs.unlink(f, () => {}); if (r.clones) { for (const v of Object.values(r.clones)) await dropVoice(v.id); delete r.clones; } save(); }
}

export function registerLocalize(app) {
  app.get("/v1/localize", requireUser, (req, res) => { const U = user(req.user.uid); res.json({ items: Object.values(recs(req.user.uid)).sort((a, b) => b.created - a.created).map((r) => pub(r, U)), engines: locEngines(), price: locPrice(), elLangs: [...EL_DUB_LANGS], cambLangs: Object.keys(CAMB_ID), steps: STEPS }); });
  app.get("/v1/localize/:id", requireUser, (req, res) => { const r = recs(req.user.uid)[req.params.id]; r ? res.json(pub(r, user(req.user.uid))) : res.status(404).json({ error: "Not found" }); });
  app.delete("/v1/localize/:id", requireUser, (req, res) => { const r = recs(req.user.uid)[req.params.id]; if (r && r.status === "running") return res.status(409).json({ error: "Still running" }); delete recs(req.user.uid)[req.params.id]; save(); res.json({ ok: true }); });
  const clean = (b) => { const list = (v) => (Array.isArray(v) ? v : String(v || "").split(/[,\s]+/)).map((x) => String(x).trim().toLowerCase()).filter((x) => /^[a-z]{2,3}(-[a-z]{2,4})?$/.test(x)).slice(0, 12);
    const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 3000).map((l) => ({ s: Math.max(0, +l.s || +l.start || 0), e: Math.max(0, +l.e || +l.end || 0), text: String(l.text || "").slice(0, 900), spk: Math.max(0, Math.min(31, +l.spk || 0)) })).filter((l) => l.text.trim() && l.e > l.s);
    const g0 = (b.opts && b.opts.glossary) || b.glossary, gloss = (Array.isArray(g0) ? g0 : String(g0 || "").split(/\n/).map((x) => { const [f, t] = x.split(/\s*(?:=>|→|=)\s*/); return { from: f, to: t }; })).filter((g) => g && String(g.from || "").trim()).slice(0, 40).map((g) => ({ from: String(g.from).trim().slice(0, 60), to: String(g.to || g.from).trim().slice(0, 60) }));
    const o = b.opts || {};
    return { targets: list(b.targets), srcLang: /^[a-z]{2,3}$/.test(String(b.srcLang || "")) ? b.srcLang : "auto", lines: lines.sort((a, c) => a.s - c.s),
      opts: { voice: ["clone", "library", "chars"].includes(o.voice) ? o.voice : "library", lipsync: !!o.lipsync, keepBg: o.keepBg !== false, subtitles: o.subtitles !== false, qa: o.qa !== false, consent: !!o.consent, speakers: Math.max(0, Math.min(32, +o.speakers || 0)),
        gender: ["female", "male"].includes(o.gender) ? o.gender : null, glossary: gloss, asd: o.asd !== false, dialects: o.dialects && typeof o.dialects === "object" ? Object.fromEntries(Object.entries(o.dialects).slice(0, 12).map(([k, v]) => [String(k).slice(0, 5), String(v).slice(0, 60)])) : {},
        voices: o.voices && typeof o.voices === "object" ? Object.fromEntries(Object.entries(o.voices).slice(0, 12).map(([k, v]) => [String(k).slice(0, 3), String(v).slice(0, 40)])) : null } }; };
  app.post("/v1/localize/quote", requireUser, (req, res) => { const b = req.body || {}, c = clean(b); if (!c.targets.length) return res.status(400).json({ error: "Pick at least one language" });
    res.json(quote(+b.dur || 60, c.targets, { ...c.opts, srcLang: c.srcLang, engine: b.engine }, c.lines.length > 0)); });
  const start = (req, res, type) => {
    const b = req.body || {}, c = clean(b), all = recs(req.user.uid); if (!b.src) return res.status(400).json({ error: "Pick a video first" });
    if (Object.values(all).filter((x) => x.status === "running").length >= 2) return res.status(429).json({ error: "Two jobs are already running — wait for one to finish" });
    let engine = null, why = "";
    if (type === "dub") { if (!c.targets.length) return res.status(400).json({ error: "Pick at least one language" }); c.targets = c.targets.filter((l) => l !== c.srcLang); if (!c.targets.length) return res.status(400).json({ error: "Pick a language other than the spoken one" });
      if (c.opts.voice === "clone" && !c.opts.consent) return res.status(400).json({ error: "Confirm you have the speakers' consent to keep their voices" });
      const q = quote(+b.dur || 60, c.targets, { ...c.opts, srcLang: c.srcLang, engine: b.engine }, c.lines.length > 0); const row = q.pick && q.engines.find((x) => x.id === q.pick);
      if (!row) return res.status(501).json({ error: "Connect a dubbing engine in Admin → AI providers: a text AI + voices (ElevenLabs or the AI engine), ElevenLabs Dubbing, CAMB.AI or an NVIDIA Content Localization server" });
      if (!row.ok) return res.status(row.reason === "not connected" ? 501 : 400).json({ error: (row.id === "nooi" ? "nooi voices" : row.id) + ": " + row.reason });
      engine = row.id; why = q.why; }
    else if (!locEngines().stt) return res.status(501).json({ error: "Connect speech-to-text (ElevenLabs, OpenAI or CAMB.AI) in Admin → AI providers" });
    const keys = Object.keys(all).sort((x, y) => all[x].created - all[y].created); while (keys.length >= MAX_REC) { const k = keys.shift(); if (all[k].status !== "running") delete all[k]; else break; }
    const r = { id: uid(), type, title: String(b.title || "Video").slice(0, 80), src: String(b.src), job: b.job || null, status: "running", progress: 0, created: Date.now(), srcLang: c.srcLang, targets: type === "dub" ? c.targets : [], engine, why, opts: c.opts, lines: c.lines, context: String(b.context || "").slice(0, 600),
      steps: STEPS.map((k) => ({ k, st: "wait" })), out: Object.fromEntries((type === "dub" ? c.targets : []).map((l) => [l, { status: "wait", progress: 0 }])) };
    all[r.id] = r; save(); runLoc(req.user.uid, r, req.user, isStaff(req.user)); res.json(pub(r, user(req.user.uid)));
  };
  app.post("/v1/localize", requireUser, (req, res) => start(req, res, "dub"));
  app.post("/v1/localize/transcribe", requireUser, (req, res) => start(req, res, "stt"));
  // the natural-voice tool (agents and the voice studio): lines → one finished audio file, written for the ear, one voice per speaker
  // the natural voice & dialogue tool: the voices it casts from, the feelings it can play, the price per 900 characters
  // sample: "ready" (made before), "free" (the engine's own sample), "make" (spoken once by the voice engine, then kept for everyone) — all free (v97)
  app.get("/v1/voice/natural", requireUser, async (req, res) => { const ready = voiceReady(), lg = sampleLang(req.query.lang), prev = ready === "elevenlabs" ? await voicePreviews() : {};
    res.json({ ready: !!ready, engine: ready, voices: VOICES.map(([id, name, gender, age, tone]) => ({ id, name, gender, age, tone, sample: sampleAt(id, lg) ? "ready" : prev[id] ? "free" : ready ? "make" : "" })), delivery: Object.keys(DELIVERY), per900: locPrice().voice, staff: isStaff(req.user), rewrite: llmConfigured() }); });
  // hear a library voice before choosing it for a character
  // v97: also the Voice page's ten example voices ({ preset: "v1" … "v10" }: their own engine voice and a line in their
  // dialect). Every example is free: made once by the voice engine, kept for everyone; two people asking at once share one.
  app.post("/v1/voice/sample", requireUser, async (req, res) => {
    const b = req.body || {};
    if (b.preset) {
      const P = presetLine(String(b.preset)); if (!P) return res.status(404).json({ error: "Unknown voice" });
      const file = sampleFile("p-" + b.preset, P.dialect); if (fs.existsSync(file)) return res.json({ url: "/media/" + path.basename(file), cost: 0 });
      if (!voiceReady()) return res.status(501).json({ error: "Connect a voice engine (ElevenLabs or the AI engine) in Admin → AI providers", noEngine: true });
      try { await makeOnce(file, () => speak(P.text, { lang: P.lang, voice: P.voice, emotion: P.emotion })); return res.json({ url: "/media/" + path.basename(file), cost: 0 }); }
      catch (e) { return e.code === 501 ? res.status(501).json({ error: e.message, noEngine: true }) : sampleFail159(req, res, e); }
    }
    const v = VOICES.find((x) => x[0] === b.id), lg = sampleLang(b.lang); if (!v) return res.status(404).json({ error: "Unknown voice" });
    const have = sampleAt(v[0], lg); if (have) return res.json({ url: "/media/" + path.basename(have), cost: 0 });
    const prev = (await voicePreviews())[v[0]];
    if (prev) { try { const dl = await download(prev, ".mp3", { tries: 2, timeoutMs: 20000 }); fs.renameSync(dl.file, sampleFile(v[0], "lib")); return res.json({ url: "/media/" + path.basename(sampleFile(v[0], "lib")), cost: 0 }); } catch {} }
    if (!voiceReady()) return res.status(501).json({ error: "Connect a voice engine (ElevenLabs or the AI engine) in Admin → AI providers", noEngine: true });
    try { await makeOnce(sampleFile(v[0], lg), () => speak((SAMPLE_TXT[lg] || SAMPLE_TXT.en).replace("{n}", v[1]), { lang: lg, voice: { id: v[0], name: v[1], gender: v[2] }, emotion: "warm" }));
      res.json({ url: "/media/" + path.basename(sampleFile(v[0], lg)), cost: 0 }); }
    catch (e) { if (e.code === 501) res.status(501).json({ error: e.message, noEngine: true }); else sampleFail159(req, res, e); }
  });
  app.post("/v1/voice/natural", requireUser, async (req, res) => {
    const b = req.body || {}, items = (Array.isArray(b.lines) ? b.lines : [{ text: b.text }]).map((x) => (typeof x === "string" ? { text: x } : x)).filter((x) => x && String(x.text || "").trim()).slice(0, 60);
    if (!items.length) return res.status(400).json({ error: "Write what to say" }); if (!voiceReady()) return res.status(501).json({ error: "Connect a voice engine (ElevenLabs or the AI engine) in Admin → AI providers" });
    const chars = items.reduce((s, x) => s + String(x.text).length, 0); if (chars > 12000) return res.status(400).json({ error: "Up to 12,000 characters at a time" });
    const cost = isStaff(req.user) ? 0 : Math.max(1, Math.ceil(chars / 900 * locPrice().voice)); const tmp = [];
    try { if (cost) charge(req.user.uid, cost, "Natural voice · " + String(items[0].text).slice(0, 30));
      const lang = /^[a-z]{2,3}$/.test(String(b.lang || "")) ? b.lang : null, ear = b.ear !== false ? await writeForEar(items.map((x) => x.text), { lang, dialect: b.dialect, tags: !!b.tags, context: b.context }).catch(() => null) : null;
      const spk = [...new Set(items.map((x) => +x.speaker || 0))].map((id) => ({ id, gender: (items.find((x) => (+x.speaker || 0) === id) || {}).gender })), cast = castVoices(spk, { gender: b.gender, byId: b.voices });
      const parts = []; for (let i = 0; i < items.length; i++) { const it = items[i], e = ear ? ear[i] : { text: it.text, emotion: it.emotion };
        const sp = await speak(e.text, { lang, voice: cast[+it.speaker || 0], emotion: DELIVERY[it.emotion] ? it.emotion : e.emotion, prev: i ? (ear ? ear[i - 1].text : items[i - 1].text) : null, next: items[i + 1] ? (ear ? ear[i + 1].text : items[i + 1].text) : null, expressive: !!b.tags, dialect: b.dialect });
        if (sp.temp) tmp.push(sp.file); parts.push(sp.file); }
      // lines joined with natural gaps (a short breath between lines of one speaker, a longer one between speakers)
      const list = tmpFile(".txt"), gapS = tmpFile(".wav"), gapL = tmpFile(".wav"); tmp.push(list, gapS, gapL);
      await run(ffmpeg(), ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "0.28", gapS]); await run(ffmpeg(), ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "0.55", gapL]);
      const norm = []; for (const p of parts) { const n = tmpFile(".wav"); tmp.push(n); await run(ffmpeg(), ["-v", "error", "-y", "-i", p, "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", n]); norm.push(n); }
      fs.writeFileSync(list, norm.map((p, i) => `file '${p}'` + (i < norm.length - 1 ? `\nfile '${(+items[i + 1].speaker || 0) !== (+items[i].speaker || 0) ? gapL : gapS}'` : "")).join("\n"));
      const joined = tmpFile(".wav"); tmp.push(joined); await run(ffmpeg(), ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);
      const fin = await polish(joined, { ext: ".mp3", room: b.room !== false }); tmp.push(fin); const url = keep(fin, ".mp3");
      res.json({ url, dur: +(await mediaDur(fin)).toFixed(2), lines: ear || items.map((x) => ({ text: x.text, emotion: x.emotion || "neutral" })), voices: Object.fromEntries(Object.entries(cast).map(([k, v]) => [k, v.name])), cost });
    } catch (e) { if (cost) credit(req.user.uid, cost, "Refund · natural voice failed"); res.status(e.code || 502).json({ error: e.message }); }
    finally { for (const f of tmp) fs.unlink(f, () => {}); }
  });
}
