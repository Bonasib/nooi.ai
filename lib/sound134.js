// v134: voices and sounds for a video nooi made (or one of the customer's own) — for the whole video, for one shot (a part of a
// long video, or a stretch the customer picks), or for one moment (a single line or a single sound at one instant). The agents
// decide what is heard, from what they see in the frames and what the video is about: the Director (what the scene is and its
// mood), the Dialogue & Voice agent (who speaks — a narrator or the people on screen — what they say, written the way people speak
// in the chosen language, the feeling of each line), the Sound agent (the place's ambience, the sound effects at the moments things
// happen, music if asked). Then the engines make it: real voices (lib/voice.js: ElevenLabs voices, one steady voice per speaker,
// delivery per feeling), the sound effects and the ambience, the music; the lips of the people who speak follow their voice (the
// engine's video lip sync, only where they speak); and everything is mixed under / over the video's own sound (it ducks under the
// voices), levelled to −16 LUFS. Without a text AI: the customer's own words, spoken by a narrator, and the place's ambience.
import fs from "fs";
import path from "path";
import { MEDIA_DIR, publicUrl } from "./media.js";
import { uid } from "./store.js";
import { basePrice, priceOf } from "./billing.js";
import { llmJson, llmConfigured } from "../providers/anthropic.js";
import { speak, castVoices, voiceReady, run, mediaDur, tmpFile, ffmpeg, stripTags, langName, DELIVERY } from "./voice.js";
import { runEngine134, engineFor134 } from "./engine134.js";
import { probe132, fileOf132 } from "./long132.js";

export const STEPS134 = ["look", "voice", "sounds", "lips", "mix"];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const r1 = (x) => Math.round(x * 10) / 10;
// the request, made safe: where (whole · one shot · one moment), what (voice · sound effects · ambience · music), the language,
// who speaks, the customer's own words, lips, keep the video's own sound
export function clean134(s, dur) {
  s = s || {}; const scope = ["all", "shot", "moment"].includes(s.scope) ? s.scope : "all";
  let t0 = 0, t1 = dur;
  if (scope === "shot") { t0 = clamp(+s.from || 0, 0, Math.max(0, dur - 0.5)); t1 = clamp(+s.to || dur, t0 + 0.5, dur); }
  if (scope === "moment") { t0 = clamp(+s.at >= 0 ? +s.at : dur / 2, 0, Math.max(0, dur - 0.5)); t1 = Math.min(dur, t0 + 4); }
  const w = s.want || {}, want = { voice: w.voice !== false, sfx: w.sfx !== false, amb: w.amb !== false && scope !== "moment", music: !!w.music && scope !== "moment" };
  const who = ["auto", "narrator", "characters"].includes(s.who) ? s.who : "auto";
  return { scope, t0: r1(t0), t1: r1(t1), want, who, lang: /^[a-z]{2,3}$/.test(String(s.lang || "")) ? s.lang : "en", dialect: String(s.dialect || "").slice(0, 40),
    say: String(s.say || "").trim().slice(0, 1500), mood: String(s.mood || "").slice(0, 200), lipsync: s.lipsync !== false && want.voice && who !== "narrator", keep: s.keep !== false };
}
// the price, shown before anything is made (what is really made may cost less: the difference comes back)
export function quote134(c) {
  const len = Math.max(0.5, c.t1 - c.t0), vp = basePrice("loc", "loctts") || 1, sp = priceOf("sfx", { kind: "sfx" }) || 1, mp = priceOf("music", { kind: "music" }) || 4, lp = priceOf("lipsync", { kind: "lipsync" }) || 12;
  const chars = c.say ? c.say.length : c.scope === "moment" ? 60 : Math.round(len * 9), nsfx = c.scope === "moment" ? 1 : Math.min(6, Math.max(1, Math.round(len / 8)));
  const parts = { plan: llmConfigured() ? 1 : 0, voice: c.want.voice ? Math.max(1, Math.ceil((chars / 900) * vp)) : 0, sfx: c.want.sfx ? nsfx * sp : 0, amb: c.want.amb ? sp : 0, music: c.want.music ? mp : 0, lips: c.lipsync ? Math.min(4, Math.ceil(len / 30)) * lp : 0 };
  return { parts, total: Object.values(parts).reduce((a, b) => a + b, 0), len: r1(len), nsfx, chars, prices: { voice900: vp, sfx: sp, music: mp, lips: lp } };
}
// which engines are there for what was asked (a missing one is said before anything is charged)
export function ready134(c) {
  const miss = [];
  if (c.want.voice && !voiceReady()) miss.push("voice");
  if ((c.want.sfx || c.want.amb) && !engineFor134("sfx")) miss.push("sounds");
  if (c.want.music && !engineFor134("music")) miss.push("music");
  return miss;
}
const asData = (f) => "data:image/jpeg;base64," + fs.readFileSync(f).toString("base64");
// a few frames of the part the sound is for (the agents look at them)
async function stills(file, t0, t1, n) {
  const out = [];
  for (let i = 0; i < n; i++) { const t = t0 + ((t1 - t0) * (i + 0.5)) / n, f = tmpFile(".jpg");
    try { await run(ffmpeg(), ["-v", "error", "-y", "-ss", t.toFixed(2), "-i", file, "-frames:v", "1", "-vf", "scale=512:-2", "-q:v", "4", f]); if (fs.existsSync(f)) out.push(f); } catch {} }
  return out;
}
const sentences = (t) => String(t || "").split(/(?<=[.!?؟。！？])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
// what is heard, by the agents (or, without a text AI, the customer's own words by a narrator + the place's ambience)
export async function plan134(c, ctx, frames) {
  const len = c.t1 - c.t0, q = quote134(c), where = c.scope === "all" ? "video" : c.scope === "shot" ? "shot of a video" : "moment of a video";
  const offline = () => {
    const lines = c.want.voice && c.say ? sentences(c.say).slice(0, 12) : [], step = len / Math.max(1, lines.length);
    return { by: "offline", mood: c.mood || "", ambience: c.want.amb ? `the natural background sound of this place: ${String(ctx.prompt || "").slice(0, 200)}` : "",
      lines: lines.map((t, i) => ({ who: c.who === "characters" ? "Speaker 1" : "narrator", gender: "female", age: "middle", text: t, emotion: "warm", at: r1(Math.min(len - 0.5, 0.3 + i * step)), onScreen: c.who === "characters" })),
      sfx: c.want.sfx && c.scope === "moment" ? [{ what: c.say || String(ctx.prompt || "the sound of this moment").slice(0, 160), at: 0, dur: Math.min(4, len) }] : [],
      music: c.want.music ? `${c.mood || "gentle cinematic"} music for: ${String(ctx.prompt || "").slice(0, 160)}` : "" };
  };
  if (!llmConfigured()) return offline();
  const whoRule = c.who === "narrator" ? "a narrator's voice-over only (not someone on screen)" : c.who === "characters" ? "the people on screen speak (dialogue), no narrator" : "decide: dialogue when people on screen talk or clearly should, otherwise a short narration if it helps the video, or nothing at all";
  const ask = `You are nooi's sound team for a ${r1(len)}-second ${where}.
- Director: what the scene is and its mood.
- Dialogue & Voice agent: ${c.want.voice ? whoRule : "nobody speaks"}. Write what is said in ${langName(c.lang)}${c.dialect ? " (" + c.dialect + ")" : ""}, the way real people say it — everyday words, contractions, a comma where they breathe; never robotic, no stage directions in the text. For each line: who says it (narrator, or a short name for a person on screen), their gender (female/male) and age (young/middle/old), the feeling (one of: ${Object.keys(DELIVERY).join(", ")}), when it starts (seconds from the start of this ${c.scope === "all" ? "video" : c.scope}), and whether the speaker is on screen. Lines never overlap and fit the time: about 2.5 words a second, with pauses.${c.scope === "moment" ? " At most one short line." : ""}
- Sound agent: ${c.want.amb ? "the ambience of the place in one short description (what you would hear there)" : "no ambience"}; ${c.want.sfx ? `up to ${q.nsfx} sound effects at the moments things happen (what, when it starts, length up to 4 s)` : "no sound effects"}; ${c.want.music ? "a music cue: mood, tempo, instruments" : "no music"}.
Look at the ${frames.length} frames (in order) of this part.${ctx.prompt ? `\nWhat the video is: "${String(ctx.prompt).slice(0, 600)}"` : ""}${ctx.bible ? `\nIts characters and world: ${String(ctx.bible).slice(0, 500)}` : ""}${c.say ? `\nThe customer asked for: "${c.say}" — use their words where they wrote lines.` : ""}${c.mood ? `\nThe feeling they want: ${c.mood}` : ""}
Answer with JSON: {"mood":"…","lines":[{"who":"narrator","gender":"female","age":"middle","text":"…","emotion":"warm","at":0.5,"onScreen":false}],"ambience":"…","sfx":[{"what":"…","at":1.2,"dur":1.5}],"music":"…"}`;
  try {
    const j = await llmJson(ask, { images: frames.map(asData), maxTokens: 2500, tier: "quick", timeoutMs: 90000 });
    const lines = (Array.isArray(j.lines) ? j.lines : []).filter((l) => l && stripTags(l.text)).slice(0, 40).map((l) => ({ who: String(l.who || "narrator").slice(0, 30), gender: ["female", "male"].includes(l.gender) ? l.gender : "female",
      age: ["young", "middle", "old"].includes(l.age) ? l.age : "middle", text: String(l.text).slice(0, 400), emotion: DELIVERY[l.emotion] ? l.emotion : "neutral", at: r1(clamp(+l.at || 0, 0, Math.max(0, len - 0.4))), onScreen: !!l.onScreen && !/narrat/i.test(String(l.who)) })).sort((a, b) => a.at - b.at);
    const sfx = (Array.isArray(j.sfx) ? j.sfx : []).filter((x) => x && String(x.what || "").trim()).slice(0, q.nsfx).map((x) => ({ what: String(x.what).slice(0, 200), at: r1(clamp(+x.at || 0, 0, Math.max(0, len - 0.3))), dur: r1(clamp(+x.dur || 1.5, 0.4, 4)) }));
    if (c.who === "narrator") lines.forEach((l) => { l.who = "narrator"; l.onScreen = false; });   // (asked for a narrator: every line is the narrator's)
    return { by: "agents", mood: String(j.mood || "").slice(0, 200), lines: c.want.voice ? lines : [], sfx: c.want.sfx ? sfx : [], ambience: c.want.amb ? String(j.ambience || "").slice(0, 240) : "", music: c.want.music ? String(j.music || "").slice(0, 240) : "" };
  } catch (e) { console.warn("sound plan:", e.message); return offline(); }
}
// every line spoken by its own steady voice, in its feeling, laid at its time on one track (sped up a little, at most 1.25×, when
// a line would run into the next)
async function voices(c, lines, dur, onLine) {
  const SR = 44100, total = Math.ceil((dur + 0.5) * SR), track = new Int16Array(total), placed = [];
  const ids = [...new Set(lines.map((l) => l.who))], spk = ids.map((w, i) => { const l = lines.find((x) => x.who === w); return { id: i, gender: l.gender, age: l.age }; }), cast = castVoices(spk);
  let prevEnd = c.t0;
  for (let i = 0; i < lines.length; i++) { const L = lines[i], v = cast[ids.indexOf(L.who)];
    const sp = await speak(L.text, { lang: c.lang, voice: v, emotion: L.emotion, prev: lines[i - 1] && lines[i - 1].text, next: lines[i + 1] && lines[i + 1].text, dialect: c.dialect || undefined });
    try { const d = await mediaDur(sp.file); let at = Math.max(prevEnd + 0.15, c.t0 + L.at);
      const until = lines[i + 1] ? Math.max(at + 0.6, c.t0 + lines[i + 1].at) : c.t1, slot = Math.max(0.6, until - at - 0.15), tempo = d > slot ? Math.min(1.25, d / slot) : 1;
      // a line that would still run past the end of this shot / moment starts a little earlier (never over the line before), else it is cut softly at the end
      const need = d / tempo; if (at + need > c.t1) at = Math.max(prevEnd + 0.15, c.t1 - need - 0.05);
      const cut = at + need > c.t1 + 0.02 ? Math.max(0.3, c.t1 - at) : 0;
      const pcm = await run(ffmpeg(), ["-v", "error", "-i", sp.file, "-af", (tempo > 1.001 ? `atempo=${tempo.toFixed(3)},` : "") + `aresample=${SR}` + (cut ? `,atrim=duration=${cut.toFixed(3)},afade=t=out:st=${Math.max(0, cut - 0.25).toFixed(3)}:d=0.25` : ""), "-ac", "1", "-f", "s16le", "-"], "buf");
      const n = pcm.length >> 1, off = Math.round(at * SR); prevEnd = at + n / SR;
      for (let q = 0; q < n && off + q < total; q++) { const x = track[off + q] + pcm.readInt16LE(q * 2); track[off + q] = x > 32767 ? 32767 : x < -32768 ? -32768 : x; }
      placed.push({ s: r1(at), e: r1(at + n / SR), who: L.who, onScreen: L.onScreen, voice: v.name, tempo: Math.round(tempo * 100) / 100 }); if (onLine) onLine((i + 1) / lines.length);
    } finally { if (sp.temp) fs.unlink(sp.file, () => {}); } }
  const wav = tmpFile(".wav"), pcm = Buffer.from(track.buffer), h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(wav, Buffer.concat([h, pcm]));
  return { wav, placed, voices: Object.fromEntries(ids.map((w, i) => [w, cast[i].name])) };
}
const ST = "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo";
// everything under / over the video's own sound
async function mix(file, info, c, v, amb, music, sfx) {
  const dur = info.dur, len = c.t1 - c.t0, ms = Math.round(c.t0 * 1000), ins = [file], fc = [], mixIn = [];
  if (info.audio) fc.push(`[0:a]${ST},atrim=duration=${dur.toFixed(3)}${c.keep ? "" : `,volume=enable='between(t,${c.t0},${c.t1})':volume=0`}[orig]`);
  else fc.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${dur.toFixed(3)},aformat=sample_fmts=fltp:channel_layouts=stereo[orig]`);
  if (v) { ins.push(v); const k = ins.length - 1;
    fc.push(`[${k}:a]${ST},highpass=f=70,deesser=i=0.3,acompressor=threshold=0.1:ratio=2.5:attack=8:release=140,aecho=0.8:0.5:14|23:0.05|0.03,asplit=3[vo][vk1][vk2]`, `[orig][vk1]sidechaincompress=threshold=0.012:ratio=10:attack=12:release=380[od]`);
    mixIn.push("[od]", "[vo]"); } else { mixIn.push("[orig]"); }
  if (amb) { ins.push(amb); const k = ins.length - 1, fd = Math.min(0.8, len / 4);
    fc.push(`[${k}:a]${ST},aloop=loop=-1:size=2000000000,atrim=duration=${len.toFixed(3)},afade=t=in:d=${fd.toFixed(2)},afade=t=out:st=${Math.max(0, len - fd).toFixed(2)}:d=${fd.toFixed(2)},volume=0.35,adelay=${ms}|${ms}[amb]`); mixIn.push("[amb]"); }
  if (music) { ins.push(music); const k = ins.length - 1, fd = Math.min(1.5, len / 4);
    fc.push(`[${k}:a]${ST},atrim=duration=${len.toFixed(3)},afade=t=in:d=${fd.toFixed(2)},afade=t=out:st=${Math.max(0, len - fd).toFixed(2)}:d=${fd.toFixed(2)},volume=0.3,adelay=${ms}|${ms}[mu]`);
    if (v) { fc.push(`[mu][vk2]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=500[mud]`); mixIn.push("[mud]"); } else mixIn.push("[mu]"); }
  else if (v) fc.push(`[vk2]anullsink`);
  sfx.forEach((x, i) => { ins.push(x.file); const k = ins.length - 1, d = Math.max(0.3, x.dur), at = Math.round((c.t0 + x.at) * 1000);
    fc.push(`[${k}:a]${ST},atrim=duration=${d.toFixed(2)},afade=t=out:st=${Math.max(0, d - 0.15).toFixed(2)}:d=0.15,volume=0.9,adelay=${at}|${at}[sx${i}]`); mixIn.push(`[sx${i}]`); });
  fc.push(`${mixIn.join("")}amix=inputs=${mixIn.length}:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95,loudnorm=I=-16:TP=-1.5:LRA=11[a]`);
  const out = tmpFile(".mp4");
  await run(ffmpeg(), ["-v", "error", "-y", ...ins.flatMap((f) => ["-i", f]), "-filter_complex", fc.join(";"), "-map", "0:v:0", "-c:v", info.vcodec === "h264" ? "copy" : "libx264", ...(info.vcodec === "h264" ? [] : ["-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p"]),
    "-map", "[a]", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", dur.toFixed(3), "-movflags", "+faststart", out]);
  return out;
}
// the stretches where someone on screen speaks (joined when the lines are close; each at most 30 s; at most 4)
export function lipRanges134(placed, dur) {
  const on = placed.filter((p) => p.onScreen).sort((a, b) => a.s - b.s), out = [];
  for (const p of on) { const last = out[out.length - 1]; if (last && p.s - last.b < 1.5 && p.e + 0.25 - last.a <= 30) last.b = Math.min(dur, p.e + 0.25); else out.push({ a: Math.max(0, p.s - 0.25), b: Math.min(dur, p.e + 0.25) }); }
  return out.filter((r) => r.b - r.a >= 0.6).slice(0, 4).map((r) => ({ a: r1(r.a), b: r1(Math.min(r.b, r.a + 30)) }));
}
// the lips of the people who speak follow their voice: each stretch to the engine's video lip sync, put back in its place
async function lips(file, info, voiceWav, ranges, onPart) {
  const keep = [], made = []; const W = info.w - (info.w % 2), H = info.h - (info.h % 2), F = Math.min(60, Math.max(12, Math.round(info.fps) || 24));
  for (const r of ranges) {
    const vName = uid() + "-lv.mp4", aName = uid() + "-la.mp3";
    try { await run(ffmpeg(), ["-v", "error", "-y", "-ss", r.a.toFixed(3), "-t", (r.b - r.a).toFixed(3), "-i", file, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", path.join(MEDIA_DIR, vName)]);
      await run(ffmpeg(), ["-v", "error", "-y", "-ss", r.a.toFixed(3), "-t", (r.b - r.a).toFixed(3), "-i", voiceWav, "-c:a", "libmp3lame", "-b:a", "192k", path.join(MEDIA_DIR, aName)]);
      const x = await runEngine134("lipsync", { prompt: "", inputs: { lsV: publicUrl(vName), lsA: publicUrl(aName) }, meta: { lips134: 1 } });
      made.push({ ...r, file: x.file }); } catch (e) { keep.push({ ...r, error: String(e.message).slice(0, 160) }); }
    if (onPart) onPart(); }
  if (!made.length) return { file, made: 0, failed: keep };
  // the picture rebuilt: the video as it was, with each synced stretch in its place (same size and frame rate)
  const pieces = []; let t = 0;
  for (const m of made) { if (m.a > t + 0.02) pieces.push({ src: 0, a: t, b: m.a }); pieces.push({ src: m.file, a: 0, b: m.b - m.a }); t = m.b; }
  if (info.dur > t + 0.02) pieces.push({ src: 0, a: t, b: info.dur });
  const ins = [file, ...made.map((m) => m.file)], fc = pieces.map((p, i) => { const k = p.src === 0 ? 0 : ins.indexOf(p.src), d = p.b - p.a;
    return `[${k}:v]trim=start=${p.a.toFixed(3)}:end=${p.b.toFixed(3)},setpts=PTS-STARTPTS,fps=${F},scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,tpad=stop_mode=clone:stop_duration=1,trim=duration=${d.toFixed(3)},format=yuv420p[p${i}]`; });
  fc.push(pieces.map((_, i) => `[p${i}]`).join("") + `concat=n=${pieces.length}:v=1:a=0[v]`);
  const out = tmpFile(".mp4");
  await run(ffmpeg(), ["-v", "error", "-y", ...ins.flatMap((f) => ["-i", f]), "-filter_complex", fc.join(";"), "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "copy", "-movflags", "+faststart", out]);
  return { file: out, made: made.length, failed: keep };
}
// the whole job: { url, plan, used (credits really used), notes }
export async function make134(src, c, ctx, step) {
  const tmp = [], notes = [];
  try {
    const file = await fileOf132(src), p = await probe132(file);
    const vc = JSON.parse(await run(process.env.FFPROBE_PATH || "ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name", "-of", "json", file], "text"));
    const info = { ...p, vcodec: ((vc.streams || [])[0] || {}).codec_name };
    step("look"); const frames = await stills(file, c.t0, c.t1, c.scope === "moment" ? 2 : 4); tmp.push(...frames);
    const plan = await plan134(c, ctx, frames), q = quote134(c), used = { plan: plan.by === "agents" ? q.parts.plan : 0, voice: 0, sfx: 0, amb: 0, music: 0, lips: 0 };
    // voices
    let v = null;
    if (plan.lines.length) { step("voice"); v = await voices(c, plan.lines, info.dur); tmp.push(v.wav);
      used.voice = Math.max(1, Math.ceil((plan.lines.reduce((t, l) => t + l.text.length, 0) / 900) * q.prices.voice900)); }
    // the sounds, all at once (one that can't be made is left out and not charged)
    step("sounds");
    const jobs = [plan.ambience ? runEngine134("sfx", { prompt: `${plan.ambience}, continuous natural background ambience, no music, no voices`, meta: { loop: true } }) : null,
      plan.music ? runEngine134("music", { prompt: `${plan.music}, instrumental film score`, meta: { instrumental: true } }) : null,
      ...plan.sfx.map((x) => runEngine134("sfx", { prompt: `${x.what}, realistic, clean, no music`, dur: Math.ceil(x.dur), meta: {} }))];
    const got = await Promise.allSettled(jobs.map((j) => j || Promise.resolve(null)));
    const amb = got[0].status === "fulfilled" && got[0].value ? got[0].value.file : null, music = got[1].status === "fulfilled" && got[1].value ? got[1].value.file : null;
    if (plan.ambience && !amb) notes.push("The ambience couldn't be made: " + String(got[0].reason?.message || "").slice(0, 100)); if (plan.music && !music) notes.push("The music couldn't be made: " + String(got[1].reason?.message || "").slice(0, 100));
    const sfx = plan.sfx.map((x, i) => { const g = got[i + 2]; return g.status === "fulfilled" && g.value ? { ...x, file: g.value.file } : null; }).filter(Boolean);
    if (sfx.length < plan.sfx.length) notes.push(plan.sfx.length - sfx.length + " sound effect(s) couldn't be made");
    used.amb = amb ? q.prices.sfx : 0; used.music = music ? q.prices.music : 0; used.sfx = sfx.length * q.prices.sfx;
    if (!v && !amb && !music && !sfx.length) throw Object.assign(new Error("Nothing could be made for the soundtrack"), { userMsg: "No voice or sound could be made for this video — nothing was charged. Try again in a minute.", userMsgAr: "تعذّر صنع أي صوت لهذا الفيديو — لم يُخصم شيء. حاول مجدداً بعد دقيقة." });
    // the lips
    let pic = file, lipInfo = null;
    if (c.lipsync && v && info.w) { const ranges = lipRanges134(v.placed, info.dur);
      if (ranges.length) { step("lips"); const L = await lips(file, info, v.wav, ranges); if (L.file !== file) { pic = L.file; tmp.push(L.file); }
        used.lips = L.made * q.prices.lips; lipInfo = { made: L.made, ranges }; if (L.failed.length) notes.push(L.failed.length + " lip-sync stretch(es) kept as they were"); } }
    step("mix");
    const out = await mix(pic, { ...info, vcodec: pic === file ? info.vcodec : "h264" }, c, v ? v.wav : null, amb, music, sfx); tmp.push(out);
    const name = uid() + "-sound.mp4"; fs.copyFileSync(out, path.join(MEDIA_DIR, name));
    return { url: publicUrl(name), used: Object.values(used).reduce((a, b) => a + b, 0), notes,
      plan: { by: plan.by, mood: plan.mood, lines: (v ? v.placed : []).map((x, i) => ({ ...x, text: stripTags(plan.lines[i]?.text || "").slice(0, 200), emotion: plan.lines[i]?.emotion })), voices: v ? v.voices : {},
        ambience: amb ? plan.ambience : "", music: music ? plan.music : "", sfx: sfx.map((x) => ({ what: x.what, at: r1(c.t0 + x.at), dur: x.dur })), lips: lipInfo } };
  } finally { for (const f of tmp) if (f && !String(f).startsWith(MEDIA_DIR)) fs.unlink(f, () => {}); }
}
