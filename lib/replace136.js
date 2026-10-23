// v136: Replace things — what the customer picked from the list of what is in a video or a picture (lib/scan136.js), changed:
//  · things seen (people, animals, vehicles, buildings, objects, places, writing): replaced by words, a picture or a character, or
//    removed. In a video only the seconds they are seen in are made again (Seedance 2.0, @Video1 — lib/edit135.js), with the
//    words the Director writes from the list: what each thing is (the exact English description), where it is, what replaces it,
//    and that everything else — and the replaced thing's movement, light and timing — stays as it was. In a picture: the picture
//    engine with the same words.
//  · sounds: a voice says the same words (or new ones) in another voice, new music, another sound, or the sound taken out — the
//    original is lowered softly in those seconds and the new one laid in at the same level.
//  · afterwards the Continuity supervisor looks at each change before and after (the vision AI): done? anything else changed?
import fs from "fs";
import path from "path";
import { MEDIA_DIR, publicUrl } from "./media.js";
import { uid } from "./store.js";
import { FF, run132, probe132 } from "./long132.js";
import { llmJson, llmConfigured } from "../providers/anthropic.js";
import { speak, castVoices, mediaDur } from "./voice.js";
import { runEngine134 } from "./engine134.js";
import { castWords134 } from "./extend134.js";

const said = (w) => String(w || "").trim().replace(/[.\s]+$/, "");
const r2 = (x) => Math.round(x * 100) / 100;
export const VOICE_PICKS136 = { woman: ["female", "middle"], man: ["male", "middle"], young_woman: ["female", "young"], young_man: ["male", "young"], old_man: ["male", "old"], old_woman: ["female", "old"] };
// one change, in words. pic: the number of its picture among the references (@ImageN in a video, "picture N" in a picture), or 0
function oneChange(it, c, pic, image) {
  const what = `${it.en || it.name}${it.where ? ` (${it.where})` : ""}`, ref = pic ? (image ? `what is in picture ${pic}` : `what is in @Image${pic}`) : "";
  if (c.remove) return `Remove ${what} completely — the place behind it filled in naturally, as if it was never there.`;
  const by = c.char ? `${c.char.name}${c.char.look ? " — " + c.char.look : ""}` : ref && said(c.to) ? `${said(c.to)} — exactly like ${ref}` : ref || said(c.to);
  const keep = it.kind === "person" ? (image ? " — in the same place, pose and light" : " — the new person does exactly what the person replaced did: the same movement, expressions, gaze and lip movement at the same moments, in the same place and light")
    : image ? " — in the same place and size, lit the same way" : " — in the same place and size, moving the way it moved, lit the same way, with the same shadows";
  return `Replace ${what} with ${by}${keep}.`;
}
// the words for the engines. changes: [{ it (the item), c (the change), pic }]
export function visualWords136({ changes, image = false, part = 1, parts = 1, pics = 0, prev = false }) {
  const list = changes.map((x, i) => `${i + 1}. ${oneChange(x.it, x.c, x.pic, image)}`), cast = castWords134(changes.filter((x) => x.c.char).map((x) => x.c.char));
  if (image) return [`Edit this picture (picture 1) — change only these things:`, ...list,
    "Keep everything else exactly as it is: every other person and thing, the place, the composition and camera, the light, the colours and the style. A photorealistic result with the same look as picture 1. No new text or watermarks."].join("\n");
  return [`Edit @Video1 — change only these things:`, ...list,
    "Everything else stays exactly as it is in @Video1: every other person (face, hair, body, clothes) and every movement, expression and lip movement at the same moments; the place, the objects, the camera position, framing and movement; the timing, the light and the colours.",
    "The result is @Video1 itself with these changes: the same length and the same moments from its first frame to its last — nothing added before or after, no cut, no new scene. Photorealistic, the same look as @Video1. No new text, captions or watermarks.",
    ...(cast.length ? [`Characters: ${cast.join("; ")} — exactly as they look.`] : []),
    ...(prev ? [`This is part ${part} of ${parts} of one video changed the same way. @Image${pics + 1} is the last frame of the part before, after the change: everything new looks exactly the same here.`] : [])].join("\n");
}
// the seconds a video is changed in: from the first moment a changed thing is seen to the last (a little on each side)
export function changeSpan136(items, dur) {
  const all = items.flatMap((it) => it.seen && it.seen.length ? it.seen : [[0, dur]]);
  if (!all.length) return [0, dur];
  return [r2(Math.max(0, Math.min(...all.map((s) => s[0])) - 0.3)), r2(Math.min(dur, Math.max(...all.map((s) => s[1])) + 0.3))];
}
// how loud a file is (mean volume, dB)
async function meanDb(file) { try { const { spawn } = await import("child_process");
  const e = await new Promise((ok) => { const p = spawn(FF(), ["-v", "info", "-i", file, "-vn", "-af", "volumedetect", "-f", "null", "-"]); let t = ""; p.stderr.on("data", (d) => (t = (t + d).slice(-3000))); p.on("close", () => ok(t)); p.on("error", () => ok("")); });
  const m = /mean_volume:\s*(-?[\d.]+) dB/.exec(e); return m ? +m[1] : null; } catch { return null; } }
// the sound changes → [{ file, at, len, gain }] to lay in and [{ a, b, g }] where the original is lowered
export async function soundWorks136(sounds, lang, onStep) {
  const adds = [], ducks = [], notes = [];
  for (const { s, c } of sounds) {
    const a = s.from, b = s.to, len = Math.max(0.4, b - a);
    if (c.remove) { ducks.push({ a, b, g: 0.03 }); notes.push({ id: s.id, done: "removed" }); continue; }
    onStep && onStep(s.kind === "speech" ? "voice" : "sound");
    let file = null;
    if (s.kind === "speech") {
      const text = said(c.say) || said(s.text); if (!text) throw Object.assign(new Error("What should the new voice say? Type the words, or read what is said first."), { code: 400 });
      const [g, age] = VOICE_PICKS136[c.voice] || VOICE_PICKS136.woman, v = castVoices([{ id: 0, gender: g, age }])[0];
      file = (await speak(text, { lang, voice: v, emotion: "neutral" })).file;
      const d = await mediaDur(file), tempo = d > len + 0.4 ? Math.min(1.25, d / (len + 0.4)) : 1;
      adds.push({ file, at: a, len: Math.min(d / tempo, len + 1.5), tempo, ref: s.db }); ducks.push({ a, b: b + 0.1, g: 0.04 });
    } else {
      const music = s.kind === "music", r = await runEngine134(music ? "music" : "sfx", { prompt: said(c.to) || (music ? "calm instrumental music" : "a natural sound"), meta: music ? { instrumental: true } : { loop: s.kind === "ambience" } });
      adds.push({ file: r.file, at: a, len, loop: music || s.kind === "ambience", ref: s.db }); ducks.push({ a, b, g: music ? 0.12 : 0.08 });
    }
    notes.push({ id: s.id, done: "replaced" });
  }
  return { adds, ducks, notes };
}
// the video's sound with the changes: the original lowered (softly, 0.15 s ramps) where asked, the new sounds laid in at the level of
// what they replace; the picture copied as it is
export async function soundMix136(file, info, { adds, ducks }) {
  const f = 0.15, esc = (s) => s.replace(/,/g, "\\,");
  const env = ducks.map((d) => `(1-${(1 - d.g).toFixed(3)}*clip(min((t-${(d.a - f).toFixed(3)})/${f},(${(d.b + f).toFixed(3)}-t)/${f}),0,1))`).join("*") || "1";
  const ins = ["-i", file], fc = [`[0:a]aresample=48000,aformat=channel_layouts=stereo,volume='${esc(env)}':eval=frame[o]`], mix = ["[o]"];
  for (let i = 0; i < adds.length; i++) { const x = adds[i], db = await meanDb(x.file), gain = x.ref != null && db != null ? Math.max(-12, Math.min(12, x.ref - db)) : 0;
    ins.push(...(x.loop ? ["-stream_loop", "-1"] : []), "-i", x.file);
    fc.push(`[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo${x.tempo > 1.001 ? `,atempo=${x.tempo.toFixed(3)}` : ""},atrim=duration=${x.len.toFixed(3)},afade=t=in:d=0.05,afade=t=out:st=${Math.max(0, x.len - 0.25).toFixed(3)}:d=0.25,volume=${gain.toFixed(1)}dB,adelay=${Math.round(x.at * 1000)}|${Math.round(x.at * 1000)}[n${i}]`);
    mix.push(`[n${i}]`); }
  fc.push(`${mix.join("")}amix=inputs=${mix.length}:duration=first:normalize=0[a]`);
  const name = uid() + "-snd.mp4", out = path.join(MEDIA_DIR, name);
  await run132(FF(), ["-y", "-v", "error", ...ins, "-filter_complex", fc.join(";"), "-map", "0:v:0", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-t", String(info.dur), "-movflags", "+faststart", out], Math.max(120000, info.dur * 6000));
  if (!fs.existsSync(out) || !fs.statSync(out).size) throw new Error("the new sound couldn't be mixed");
  return { url: publicUrl(name), file: out };
}
// the Continuity supervisor: each change before and after → [{ id, done, other, note }] (null without a vision AI)
export async function check136({ before, after, image, changes, lang }) {
  if (!llmConfigured() || !changes.length) return null;
  const pick = changes.slice(0, 4), imgs = [], tmp = [];
  const still = async (file, t) => { const f = path.join(MEDIA_DIR, uid() + "-ck.jpg"); tmp.push(f);
    await run132(FF(), ["-y", "-v", "error", ...(t != null ? ["-ss", Math.max(0, t).toFixed(3)] : []), "-i", file, "-frames:v", "1", "-vf", "scale='min(768,iw)':-2", "-q:v", "4", f], 60000);
    return fs.existsSync(f) ? "data:image/jpeg;base64," + fs.readFileSync(f).toString("base64") : null; };
  try {
    for (const x of pick) { const t = image ? null : x.it.at; const a = await still(before, t), b = await still(after, t); if (!a || !b) return null; imgs.push(a, b); }
    const ask = `You are nooi's continuity supervisor. The pictures come in pairs: before and after a change (pair 1 = pictures 1 and 2, pair 2 = pictures 3 and 4, …). For each pair, was this change made, and did anything else change that should have stayed the same?
${pick.map((x, i) => `${i + 1}. ${oneChange(x.it, x.c, x.pic ? 0 : 0, image)}`).join("\n")}
Answer with JSON: {"checks":[{"n":1,"done":true,"other":false,"note":"one short sentence in ${lang === "ar" ? "Arabic" : "English"}"}]}`;
    const j = await llmJson(ask, { images: imgs, maxTokens: 900, tier: "quick", timeoutMs: 90000 });
    return pick.map((x, i) => { const c = ((j && j.checks) || []).find((q) => +q.n === i + 1) || {}; return { id: x.it.id, done: c.done !== false, other: !!c.other, note: String(c.note || "").slice(0, 200) }; });
  } catch (e) { console.warn("check136:", String(e.message).slice(0, 160)); return null; }
  finally { for (const f of tmp) fs.unlink(f, () => {}); }
}
