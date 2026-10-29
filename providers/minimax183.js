// v183: MiniMax with the owner's own key (pay as you go: every call is billed to the owner's MiniMax balance) — voices (Speech
// T2A), pictures (image-01) and music, on MiniMax's own API: https://api.minimax.io (accounts in mainland China:
// https://api.minimaxi.com). Request shapes as in MiniMax's own MCP server (github.com/MiniMax-AI/MiniMax-MCP): a Bearer key and
// no GroupId; MiniMax answers HTTP 200 with base_resp.status_code — 0 done · 1004 key refused · 1008 balance used up · 1002/1039
// too many requests · 2013 a bad input. The owner switches each use on or off in Admin → AI providers → MiniMax (S().minimax183);
// a customer's picked ElevenLabs voice and the videos stay where they are. Admin's check (POST /v1/get_voice) costs nothing.
import { cfg, configured, S } from "../lib/settings.js";
import { save } from "../lib/store.js";
import { saveBuffer, download } from "../lib/media.js";

const base = () => (cfg("minimax").baseUrl || "https://api.minimax.io").replace(/\/+$/, "").replace(/\/v1$/, "");
export const MM_DEFAULTS183 = { speechModel: "speech-2.8-hd", imageModel: "image-01", musicModel: "music-2.6" };
const mmCfg = () => ({ ...MM_DEFAULTS183, ...Object.fromEntries(Object.entries(cfg("minimax")).filter(([, v]) => v)) });
export const mmState183 = () => { const st = S(); return (st.minimax183 = st.minimax183 || {}); };
// is MiniMax used for voices / pictures / music? (connected, and not switched off by the owner)
export const mmOn183 = (what) => configured("minimax") && mmState183()[what] !== false;
export const mmRegion183 = () => (/minimaxi\.com/.test(String(cfg("minimax").baseUrl || "")) ? "cn" : "intl");   // (v183b: Admin's region choice)

function mmErr(code, msg) {
  const m = code === 1008 ? "MiniMax: insufficient balance — top up the MiniMax account (pay as you go)"
    : code === 1004 || code === 2049 ? `MiniMax refused the key (${code}) — check it in Admin → AI providers → MiniMax`
    : code === 1002 || code === 1039 ? "MiniMax is busy (too many requests) — try again later"
    : `MiniMax ${code}: ${String(msg || "").slice(0, 200)}`;
  return Object.assign(new Error(m), { mmCode: code, code: code === 1008 ? 402 : code === 1004 || code === 2049 ? 401 : 502 });
}
async function call(path, body, ms = 180000) {
  const r = await fetch(base() + path, { method: "POST", headers: { Authorization: "Bearer " + cfg("minimax").apiKey, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) });
  const t = await r.text(); let d = {}; try { d = JSON.parse(t); } catch {}
  const code = d.base_resp ? +d.base_resp.status_code || 0 : r.ok ? 0 : r.status;
  if (!r.ok || code) throw mmErr(code || r.status, (d.base_resp && d.base_resp.status_msg) || t.slice(0, 200));
  return d;
}
const abs = (u) => (typeof u === "string" && u.startsWith("/") ? (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "") + u : u);
// a result MiniMax gives as a link (it doesn't stay up for long) or as hex audio → a file on this server
async function keep(v, ext) { if (/^https?:\/\//.test(v)) return (await download(v, ext, { tries: 2, timeoutMs: 120000 })).url; return saveBuffer(Buffer.from(v, "hex"), ext).url; }

// ---- voices: the language to speak, the voice for the wanted person, the feeling
const ARABIC = new Set(["msa", "najdi", "hijazi", "gulf", "egy", "lev", "iraqi", "kuwaiti", "emirati", "omani", "bahraini", "qatari", "yemeni", "sudani", "libyan", "tunisian", "algerian", "moroccan", "maghrebi", "jordanian", "palestinian", "syrian", "lebanese"]);
const LANGS = { ar: "Arabic", en: "English", zh: "Chinese", yue: "Chinese,Yue", fr: "French", es: "Spanish", de: "German", pt: "Portuguese", ru: "Russian", tr: "Turkish", it: "Italian", ja: "Japanese", ko: "Korean",
  hi: "Hindi", id: "Indonesian", vi: "Vietnamese", th: "Thai", nl: "Dutch", pl: "Polish", uk: "Ukrainian", ro: "Romanian", el: "Greek", cs: "Czech", fi: "Finnish", fa: "Persian" };
export function mmLang183(meta, text) {
  const d = String((meta && (meta.lang || meta.dialect)) || "").trim(), low = d.toLowerCase();
  if (ARABIC.has(low) || /^ar([-_]|$)/.test(low)) return "Arabic";
  if (/^en/.test(low)) return "English";
  const two = low.split(/[-_]/)[0]; if (LANGS[two]) return LANGS[two];
  const t = String(text || ""); if (/[؀-ۿ]/.test(t)) return "Arabic"; if (/[぀-ヿ]/.test(t)) return "Japanese"; if (/[가-힯]/.test(t)) return "Korean";
  if (/[一-鿿]/.test(t)) return "Chinese"; if (/[Ѐ-ӿ]/.test(t)) return "Russian"; if (/[฀-๿]/.test(t)) return "Thai"; if (/[ऀ-ॿ]/.test(t)) return "Hindi";
  return "auto";
}
// MiniMax's own system voices (multilingual); the list read by Admin's check takes over when there is one
const FALLBACK = { female: { young: "Lively_Girl", middle: "Wise_Woman", old: "Wise_Woman", child: "Lovely_Girl" }, male: { young: "Casual_Guy", middle: "Deep_Voice_Man", old: "Patient_Man", child: "Decent_Boy" }, neutral: { middle: "Friendly_Person" } };
const FEMALE = /woman|girl|lady|female|mother|mom|sister|queen|princess|wife|aunt|grandma|abbess/i, MALE = /\bman\b|_man\b|man$|guy|boy|male|gentleman|knight|father|dad|brother|king|prince|husband|uncle|grandpa|lord/i;
export function mmVoice183(meta, lang) {
  meta = meta || {};
  if (meta.mmVoice && /^[A-Za-z][\w-]{2,80}$/.test(meta.mmVoice)) return meta.mmVoice;
  const g = ["female", "male"].includes(meta.gender) ? meta.gender : "neutral", age = meta.age === "child" || meta.age === "kid" ? "child" : ["young", "old", "middle"].includes(meta.age) ? meta.age : "middle";
  const list = (mmState183().voices || []).filter((v) => v && v.id);
  if (list.length) {
    const sex = (v) => { const s = v.id + " " + (v.name || ""); return FEMALE.test(s) ? "female" : MALE.test(s) ? "male" : "neutral"; };
    const inLang = lang && lang !== "auto" ? list.filter((v) => v.id.toLowerCase().startsWith(lang.split(",")[0].toLowerCase() + "_")) : [];
    const pick = (pool) => { const same = pool.filter((v) => g === "neutral" || sex(v) === g); if (!same.length) return null;
      const kid = same.filter((v) => /girl|boy|kid|child/i.test(v.id)), old = same.filter((v) => /old|elder|grand|senior|wise|patient/i.test(v.id)), tone = String(meta.tone || "").toLowerCase();
      const byAge = age === "child" && kid.length ? kid : age === "old" && old.length ? old : same.filter((v) => !/girl|boy|kid|child/i.test(v.id)).length ? same.filter((v) => !/girl|boy|kid|child/i.test(v.id)) : same;
      return (tone && byAge.find((v) => (v.id + " " + (v.name || "")).toLowerCase().includes(tone))) || byAge[0]; };
    const v = pick(inLang) || null; if (v) return v.id;
  }
  const f = FALLBACK[g] || FALLBACK.neutral; return f[age] || f.middle || FALLBACK.neutral.middle;
}
const EMOTION = { excited: "happy", funny: "happy", warm: "happy", happy: "happy", sad: "sad", angry: "angry", fearful: "fearful", scared: "fearful", surprised: "surprised" };
export const mmSpeech183 = () => ({ name: "MiniMax Speech", configured: configured("minimax"),
  async submit(p) {
    const c = mmCfg(), text = String(p.prompt || "").trim().slice(0, 9500); if (!text) throw Object.assign(new Error("Nothing to say"), { code: 400 });
    const lang = mmLang183(p.meta, text), emo = EMOTION[String(p.meta?.tone || "").toLowerCase()], speed = Math.min(2, Math.max(.5, +p.meta?.speed || 1));
    const d = await call("/v1/t2a_v2", { model: c.speechModel, text, stream: false, language_boost: lang,
      voice_setting: { voice_id: mmVoice183(p.meta, lang), speed, vol: 1, pitch: 0, ...(emo ? { emotion: emo } : {}) },
      audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 } });
    const a = d.data && d.data.audio; if (!a) throw new Error("MiniMax gave no voice back");
    return { done: true, url: await keep(a, ".mp3") };
  },
  async poll() { return { status: "done" }; } });

// ---- pictures: image-01 (words, and a person's picture as the character reference)
const RATIOS = ["1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16", "21:9"];
const words = (p) => [p.prompt, p.character && p.character.description && `Main character: ${p.character.description}`, ...(p.meta?.refs || []).map((r) => r.description && `${r.type}: ${r.description}`), p.meta?.style && `Style: ${p.meta.style}`].filter(Boolean).join("\n");
export const mmImage183 = () => ({ name: "MiniMax Image-01", configured: configured("minimax"),
  async submit(p) {
    const c = mmCfg(), ref = abs(p.inputs?.chRef || p.inputs?.iRef || (p.meta?.refs || []).find((r) => r && r.url && r.type === "character")?.url || "");
    const d = await call("/v1/image_generation", { model: c.imageModel, prompt: words(p).slice(0, 1500), aspect_ratio: RATIOS.includes(p.aspect) ? p.aspect : "1:1", n: 1, response_format: "url", prompt_optimizer: true,
      ...(ref ? { subject_reference: [{ type: "character", image_file: ref }] } : {}) });
    const u = d.data && ((d.data.image_urls || [])[0] || (d.data.image_base64 || [])[0]); if (!u) throw new Error("MiniMax made no picture");
    return { done: true, url: /^https?:/.test(u) ? (await download(u, ".jpeg", { tries: 2, timeoutMs: 120000 })).url : saveBuffer(Buffer.from(u, "base64"), ".jpeg").url };
  },
  async poll() { return { status: "done" }; } });

// ---- music: a description (and words to sing when there are any; without them the piece is instrumental)
export const mmMusic183 = () => ({ name: "MiniMax Music", configured: configured("minimax"),
  async submit(p) {
    const c = mmCfg(), lyr = String(p.meta?.lyrics || "").trim();
    const d = await call("/v1/music_generation", { model: c.musicModel, prompt: String(p.prompt || "").trim().slice(0, 2000) || "cinematic background music", ...(lyr ? { lyrics: lyr.slice(0, 3500) } : { is_instrumental: true }),
      output_format: "hex", audio_setting: { sample_rate: 44100, bitrate: 256000, format: "mp3" } }, 300000);
    const a = d.data && d.data.audio; if (!a) throw new Error("MiniMax made no music");
    return { done: true, url: await keep(a, ".mp3") };
  },
  async poll() { return { status: "done" }; } });

export const MM_KEYS183 = { "mm183-voice": mmSpeech183, "mm183-image": mmImage183, "mm183-music": mmMusic183 };
// which MiniMax engine takes a job (null = not MiniMax): the voice and music switches, and MiniMax Image picked by hand
export function mmRoute183(cap, body) {
  body = body || {};
  if (cap === "image" && body.model === "mmimage") return { key: "mm183-image", a: mmOn183("image") ? mmImage183() : { ...mmImage183(), configured: false } };   // (switched off → "not available", nothing charged)
  if (cap === "tts" && body.kind === "voice" && body.meta?.engine !== "elevenlabs" && mmOn183("voice")) return { key: "mm183-voice", a: mmSpeech183() };
  if (cap === "music" && body.kind === "music" && mmOn183("music")) return { key: "mm183-music", a: mmMusic183() };
  return null;
}

// Admin's check: the key against MiniMax's voice list (free); the voices are kept to pick from
export async function mmCheck183() {
  const t0 = Date.now();
  try {
    const d = await call("/v1/get_voice", { voice_type: "system" }, 15000);
    const voices = (d.system_voice || []).map((v) => ({ id: String(v.voice_id || ""), name: String(v.voice_name || "").slice(0, 60) })).filter((v) => v.id).slice(0, 600);
    const st = mmState183(); st.voices = voices; st.checked = Date.now(); save();
    return { state: "online", status: 200, latency: Date.now() - t0, note: `OK · ${voices.length} voices`, voices: voices.length };
  } catch (e) {
    const c = e.mmCode, type = c === 1004 || c === 2049 ? "auth" : c === 1008 ? "quota" : c === 1002 || c === 1039 ? "rate" : e.name === "TimeoutError" || e.name === "AbortError" ? "network" : "provider";
    return { state: type === "auth" || type === "quota" || type === "network" ? "down" : "degraded", type, status: c || 0, latency: Date.now() - t0, note: type === "auth" ? "Key rejected or expired" : type === "quota" ? "Balance used up — top up MiniMax" : e.message.slice(0, 160) };
  }
}
