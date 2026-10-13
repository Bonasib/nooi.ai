// Natural voice — speech that sounds like a person, not a machine. One tool for dubbing (lib/localize.js), the voice studio
// and the agents. What gives synthetic speech away: one flat delivery for every line, sentences written for the eye, digits
// and symbols read literally, every line restarting from silence, and a dry booth sound pasted on top of a live scene. So:
//   · script for the ear (writeForEar): the text AI rewrites each line the way people say it in that language/dialect —
//     everyday words, contractions, numbers/dates/symbols as words, a comma where the speaker breathes — same meaning, about
//     the same length; ElevenLabs v3 also gets one audio tag ([laughs], [sighs], [whispers]) only where the feeling is clear
//   · delivery per line from its emotion (stability · style · speed) and the lines around it (previous_text / next_text), so
//     a dialogue flows instead of restarting on every line
//   · one steady voice per speaker (castVoices), never two speakers on the same voice
//   · finishing (polish): rumble cut, soft de-ess, gentle compression, a touch of room, −16 LUFS
// Engines: ElevenLabs with the platform key (voice ids, v3 tags, stitching); otherwise the AI engine's ElevenLabs voices by
// name, or any TTS API connected in Admin → AI providers.
import fs from "fs"; import os from "os"; import path from "path"; import { spawn } from "child_process";
import { cfg } from "./settings.js";
import { uid } from "./store.js";
import { download, localPath } from "./media.js";
import { PROVIDERS } from "../providers/index.js";
import { adapterFor, adapterByKey } from "../providers/extra.js";
import { llmJson, llmConfigured } from "../providers/anthropic.js";

// ElevenLabs default voices: [voice id, name (the AI engine uses names), gender, age, feel]
export const VOICES = [
  ["JBFqnCBsd6RMkjVDRZzb", "George", "male", "middle", "warm"], ["nPczCjzI2devNBz1zQrb", "Brian", "male", "middle", "deep"], ["onwK4e9ZLuTAKqWW03F9", "Daniel", "male", "middle", "clear"],
  ["TX3LPaxmHKxFdv7VOQHJ", "Liam", "male", "young", "energetic"], ["CwhRBWXzGAHq8TQ4Fs17", "Roger", "male", "middle", "casual"], ["IKne3meq5aSn9XLyUdCD", "Charlie", "male", "young", "natural"],
  ["cjVigY5qzO86Huf0OWal", "Eric", "male", "middle", "smooth"], ["iP95p4xoKVk53GoZ742B", "Chris", "male", "middle", "relaxed"], ["bIHbv24MWmeRgasZH58o", "Will", "male", "young", "friendly"],
  ["pqHfZKP75CvOlQylNhV4", "Bill", "male", "old", "trustworthy"], ["N2lVS1w4EtoT3dr4eOWO", "Callum", "male", "middle", "intense"],
  ["EXAVITQu4vr4xnSDxMaL", "Sarah", "female", "young", "soft"], ["FGY2WhTYpPnrIDTdsKH5", "Laura", "female", "young", "upbeat"], ["Xb7hH8MSUJpSbSDYk0k2", "Alice", "female", "middle", "confident"],
  ["XrExE9yKIg1WjnnlVkGX", "Matilda", "female", "middle", "friendly"], ["cgSgspJ2msm6clMCkdW9", "Jessica", "female", "young", "expressive"], ["pFZP5JQG7iQjIQuC4Bku", "Lily", "female", "middle", "warm"],
  ["XB0fDUnXU5powFXDhCwa", "Charlotte", "female", "young", "calm"], ["9BWtsMINqrJLrRacOk9x", "Aria", "female", "middle", "expressive"], ["SAz9YHcvj6GT2YYXdXww", "River", "neutral", "middle", "calm"]
];
const FALLBACK_VOICE = "JBFqnCBsd6RMkjVDRZzb";
// how a line is said: lower stability = more expressive, style = how much of the voice's character, speed 0.7–1.2
export const DELIVERY = { neutral: { stability: .5, style: .15, speed: 1 }, calm: { stability: .62, style: .1, speed: .96 }, warm: { stability: .46, style: .3, speed: .98 },
  excited: { stability: .32, style: .55, speed: 1.06 }, serious: { stability: .66, style: .18, speed: .97 }, sad: { stability: .55, style: .35, speed: .92 },
  angry: { stability: .3, style: .6, speed: 1.04 }, whisper: { stability: .5, style: .4, speed: .94 }, funny: { stability: .36, style: .5, speed: 1.03 } };
// languages ElevenLabs Multilingual v2 speaks natively; everything else goes to v3 (70+ languages)
const V2 = new Set("en ja zh de hi fr ko pt it es id nl tr fil pl sv bg ro ar cs el fi hr ms sk da ta uk ru".split(" "));
const FF = () => process.env.FFMPEG_PATH || "ffmpeg", FP = () => process.env.FFPROBE_PATH || "ffprobe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const tmpFile = (ext) => path.join(os.tmpdir(), "nooi-" + uid() + ext);
// run a tool; out = "text" → stdout as text, "buf" → stdout as a Buffer
export const run = (bin, args, out) => new Promise((res, rej) => { const p = spawn(bin, args); const o = [], e = []; p.stdout.on("data", (d) => o.push(d)); p.stderr.on("data", (d) => e.push(d)); p.on("error", rej);
  p.on("close", (c) => (c === 0 ? res(out === "buf" ? Buffer.concat(o) : out ? Buffer.concat(o).toString() : null) : rej(new Error(path.basename(bin) + " failed: " + Buffer.concat(e).toString().slice(-240))))); });
export async function mediaDur(file) { const o = await run(FP(), ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], "text"); const d = parseFloat(o); if (!(d > 0)) throw new Error("Couldn't read the length"); return d; }
export const ffmpeg = FF;
const elBase = () => (cfg("elevenlabs").baseUrl || "https://api.elevenlabs.io").replace(/\/$/, "");
export const stripTags = (t) => String(t || "").replace(/\[[a-z][a-z ]{1,24}\]\s*/gi, "").trim();
// which voice engine speaks: "elevenlabs" (platform key) · "engine" (AI engine / TTS API) · null
export function voiceReady() { if (cfg("elevenlabs").apiKey) return "elevenlabs"; try { const r = adapterFor("tts", { kind: "voice", prompt: "-" }, PROVIDERS); return r && r.a && r.a.configured ? "engine" : null; } catch { return null; } }
// one steady voice per speaker — speakers: [{ id, gender: "female"|"male"|"unknown", age }]; pick: { gender, byId: { id: voice id or name } }
export function castVoices(speakers, pick = {}) {
  const used = new Set(), out = {};
  for (const s of speakers) {
    const want = pick.byId && pick.byId[s.id] && VOICES.find((v) => v[0] === pick.byId[s.id] || v[1].toLowerCase() === String(pick.byId[s.id]).toLowerCase());
    const g = ["female", "male"].includes(s.gender) ? s.gender : ["female", "male"].includes(pick.gender) ? pick.gender : s.id % 2 ? "male" : "female";
    const pool = VOICES.filter((v) => v[2] === g), fit = pool.filter((v) => !s.age || v[3] === s.age);
    const v = want || fit.find((x) => !used.has(x[0])) || pool.find((x) => !used.has(x[0])) || pool[0];
    used.add(v[0]); out[s.id] = { id: v[0], name: v[1], gender: v[2] };
  }
  return out;
}
// one line → an audio file. o: { lang, voice: { id, name, gender } or a cloned { id }, emotion, prev, next, speed, expressive, dialect }
export async function speak(text, o = {}) {
  text = String(text || "").trim().slice(0, 3000); if (!stripTags(text)) throw new Error("Nothing to say");
  const d = DELIVERY[o.emotion] || DELIVERY.neutral, speed = Math.min(1.2, Math.max(.7, d.speed * (+o.speed || 1))), v = o.voice || { id: cfg("elevenlabs").voiceId || FALLBACK_VOICE, name: "George", gender: "male" };
  const el = cfg("elevenlabs");
  if (el.apiKey && o.engine !== "engine") {
    let model = o.model || (o.expressive || (o.lang && !V2.has(o.lang)) ? "eleven_v3" : "eleven_multilingual_v2");
    const body = () => { const v3 = /v3/.test(model);
      return { text: v3 ? text : stripTags(text), model_id: model, voice_settings: { stability: v3 ? .5 : d.stability, similarity_boost: .8, style: d.style, use_speaker_boost: true, ...(v3 ? {} : { speed }) },
        ...(!v3 && o.prev ? { previous_text: stripTags(o.prev).slice(-400) } : {}), ...(!v3 && o.next ? { next_text: stripTags(o.next).slice(0, 400) } : {}), ...(o.lang && v3 && o.lang !== "auto" ? { language_code: o.lang } : {}) }; };
    const call = (b, vid) => fetch(`${elBase()}/v1/text-to-speech/${encodeURIComponent(vid)}?output_format=mp3_44100_128`, { method: "POST", headers: { "xi-api-key": el.apiKey, "Content-Type": "application/json" }, body: JSON.stringify(b) });
    let b = body(), vid = v.id, r = await call(b, vid);
    if (!r.ok && [400, 422].includes(r.status) && b.language_code) { delete b.language_code; r = await call(b, vid); }               // a language code this model doesn't take
    if (!r.ok && [400, 404].includes(r.status) && !o.cloned && vid !== (el.voiceId || FALLBACK_VOICE)) { vid = el.voiceId || FALLBACK_VOICE; r = await call(b, vid); }  // voice not in this account
    if (!r.ok && /v3/.test(model) && [400, 403, 422].includes(r.status)) { model = "eleven_multilingual_v2"; b = body(); r = await call(b, vid); }  // v3 not on this plan
    if (!r.ok) throw Object.assign(new Error("ElevenLabs " + r.status + ": " + (await r.text()).slice(0, 200)), { status: r.status });
    const f = tmpFile(".mp3"); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); return { file: f, temp: true, engine: "elevenlabs", voice: v.name || vid, model };
  }
  // the AI engine's ElevenLabs voices (by name) or a connected TTS API
  const body = { kind: "voice", prompt: stripTags(text), meta: { voiceId: v.name || undefined, lang: o.lang && o.lang !== "auto" ? o.lang : undefined, dialect: o.dialect || o.lang, gender: v.gender, tone: o.emotion } };
  let route = null; try { route = adapterFor("tts", body, PROVIDERS); } catch {}
  if (!route || !route.a || !route.a.configured) throw Object.assign(new Error("Connect a voice engine (ElevenLabs or the AI engine) in Admin → AI providers"), { code: 501 });
  const x = await route.a.submit(body); let url = x.done ? x.url : null; const t0 = Date.now();
  while (!url) { if (Date.now() - t0 > 240000) throw new Error("The voice took too long"); await sleep(1500); const q = await adapterByKey(route.key, PROVIDERS).poll(x.remoteId);
    if (q.status === "done" && q.url) url = q.url; else if (q.status === "failed") throw new Error(q.error || "The voice failed"); }
  const lp = localPath(url); if (lp && fs.existsSync(lp)) return { file: lp, temp: false, engine: "engine", voice: v.name };
  const dl = await download(url); return { file: dl.file, temp: true, engine: "engine", voice: v.name };
}
// studio finishing for a voice file → .wav (or .mp3): rumble cut, soft de-ess, gentle compression, a little room, −16 LUFS
export async function polish(inp, o = {}) {
  const out = tmpFile(o.ext || ".wav"), room = o.room === false ? "" : ",aecho=0.8:0.5:14|23:0.05|0.03";
  await run(FF(), ["-v", "error", "-y", "-i", inp, "-af", `highpass=f=70,deesser=i=0.35,acompressor=threshold=0.1:ratio=2.5:attack=8:release=140${room},loudnorm=I=-16:TP=-1.5:LRA=11`, "-ar", "48000",
    ...(o.ext === ".mp3" ? ["-c:a", "libmp3lame", "-b:a", "192k"] : ["-c:a", "pcm_s16le"]), out]);
  return out;
}
const LNAME = (c) => { try { return ({ ber: "Tamazight (Berber)", ak: "Twi (Akan)", fil: "Filipino" })[c] || new Intl.DisplayNames(["en"], { type: "language" }).of(c) || c; } catch { return c; } };
export const langName = LNAME;
// write lines for the ear (keeps the meaning; picks a delivery for each line). lines: [text] → [{ text, emotion }]
export async function writeForEar(lines, o = {}) {
  if (!llmConfigured() || !lines.length) return lines.map((t) => ({ text: String(t), emotion: DELIVERY[o.emotion] ? o.emotion : "neutral" }));
  const j = await llmJson(`Rewrite these lines so they sound like a real person speaking ${o.lang ? LNAME(o.lang) : "their language"}${o.dialect ? " (" + o.dialect + ")" : ""} — not like text read aloud.
Rules: keep the meaning and every fact; about the same length (±15%); the everyday words and contractions people really use; numbers, dates, symbols and abbreviations written the way they are said; a comma where a speaker would breathe; no stage directions${o.tags ? "; at most one audio tag such as [laughs] [sighs] [whispers] [excited] per line, only where the feeling is obvious" : ""}.
Pick how each line is delivered from: ${Object.keys(DELIVERY).join(", ")}.${o.context ? "\nContext: " + String(o.context).slice(0, 400) : ""}
LINES: ${JSON.stringify(lines.map((t, i) => ({ i, text: String(t).slice(0, 600) })))}
Return {"lines":[{"i":0,"text":"…","emotion":"neutral"}]} — one entry per input line, same order.`, { maxTokens: 3000, tier: "quick", timeoutMs: 90000 });
  const out = Array.isArray(j && j.lines) ? j.lines : [];
  return lines.map((t, i) => { const x = out.find((y) => +y.i === i) || out[i] || {}; return { text: String(x.text || t).slice(0, 1200), emotion: DELIVERY[x.emotion] ? x.emotion : "neutral" }; });
}
// ElevenLabs instant voice clone of one speaker (dubbing with the speaker's own voice — needs their consent); removed after the job
export async function cloneVoice(name, file) {
  const c = cfg("elevenlabs"); if (!c.apiKey) throw Object.assign(new Error("Keeping the speaker's voice needs ElevenLabs"), { code: 501 });
  const fd = new FormData(); fd.append("name", String(name || "nooi dub").slice(0, 60)); fd.append("remove_background_noise", "true"); fd.append("files", new Blob([fs.readFileSync(file)], { type: "audio/mpeg" }), "sample.mp3");
  const r = await fetch(`${elBase()}/v1/voices/add`, { method: "POST", headers: { "xi-api-key": c.apiKey }, body: fd }); if (!r.ok) throw new Error("ElevenLabs voice clone " + r.status + ": " + (await r.text()).slice(0, 160));
  return (await r.json()).voice_id;
}
export async function dropVoice(id) { const c = cfg("elevenlabs"); if (!c.apiKey || !id) return; try { await fetch(`${elBase()}/v1/voices/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "xi-api-key": c.apiKey } }); } catch {} }
