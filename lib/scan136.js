// v136: what is in a video or a picture, for "Replace things": the people, animals, vehicles, buildings, objects, places and writing
// in it — each once, with what it looks like, where it is and when it is seen, and a small picture of it — and, for a video, what is
// heard: speech, music, the sound of the place and single sounds, with their seconds (and, when asked, the words that are said).
//  · the picture: a few frames go to the agents (the vision AI): the Continuity supervisor lists what is in them (names in the
//    customer's language, an exact English description for the engines, the frames it is in, its box where it is clearest); the Sound
//    agent names what our sound measurements found. Without a vision AI: the video's own words give a short list (by: "basic").
//  · the sound: measured here, no engine — loudness, how tonal it is (spectral flatness) and how it pulses (syllables) every quarter
//    second → speech / music / background sound / a single sound; the words said come from speech-to-text when the customer asks.
// Made once per file and language, kept next to it (MEDIA_DIR/<file>.scan136.<lang>.json; the small pictures <file>.s136.*.jpg).
import fs from "fs";
import path from "path";
import { MEDIA_DIR, publicUrl } from "./media.js";
import { FF, run132, probe132 } from "./long132.js";
import { llmJson, llmConfigured } from "../providers/anthropic.js";
import { nvOn } from "../providers/nvidia.js";
import { spawn } from "child_process";

export const KINDS136 = ["person", "animal", "vehicle", "building", "object", "place", "text"];
export const SOUNDS136 = ["speech", "music", "ambience", "effect"];
const r2 = (x) => Math.round(x * 100) / 100;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const runBuf = (args, ms = 120000) => new Promise((ok, bad) => { const p = spawn(FF(), args); const out = []; let err = "";
  const t = setTimeout(() => { try { p.kill("SIGKILL"); } catch {} bad(new Error("timed out")); }, ms);
  p.stdout.on("data", (d) => out.push(d)); p.stderr.on("data", (d) => (err = (err + d).slice(-300)));
  p.on("error", (e) => { clearTimeout(t); bad(e); }); p.on("close", (c) => { clearTimeout(t); c === 0 ? ok(Buffer.concat(out)) : bad(new Error(err.trim() || "exit " + c)); }); });

// ---- the sound map: every quarter second, how loud, how tonal, how it pulses → segments
function fft(re, im) {   // in place, radix 2
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) { const ur = re[i + k], ui = im[i + k], xr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, xi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + xr; im[i + k] = ui + xi; re[i + k + len / 2] = ur - xr; im[i + k + len / 2] = ui - xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } }
}
export async function soundMap136(file, dur) {
  const SR = 16000, W = 4000, b = await runBuf(["-v", "error", "-i", file, "-vn", "-ac", "1", "-ar", String(SR), "-f", "s16le", "-"]).catch(() => null);
  if (!b || b.length < W * 2) return [];
  const x = new Int16Array(b.buffer, b.byteOffset, b.length >> 1), N = Math.floor(x.length / W), win = [];
  const hann = Float64Array.from({ length: 512 }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / 511));
  for (let w = 0; w < N; w++) {
    const o = w * W; let s2 = 0; const env = [];
    for (let k = 0; k < 16; k++) { let e = 0; for (let i = 0; i < 250; i++) { const v = x[o + k * 250 + i] / 32768; e += v * v; } env.push(Math.sqrt(e / 250)); s2 += e; }
    const rms = Math.sqrt(s2 / W), db = 20 * Math.log10(rms + 1e-9), em = env.reduce((a, c) => a + c, 0) / 16, cv = em > 0 ? Math.sqrt(env.reduce((a, c) => a + (c - em) ** 2, 0) / 16) / em : 0;
    const P = new Float64Array(256);   // the mean spectrum of 7 short frames
    for (let f = 0; f < 7; f++) { const re = new Float64Array(512), im = new Float64Array(512); for (let i = 0; i < 512; i++) re[i] = (x[o + f * 500 + i] || 0) * hann[i]; fft(re, im); for (let k = 0; k < 256; k++) P[k] += re[k] * re[k] + im[k] * im[k]; }
    let lg = 0, ar = 0, nb = 0; for (let k = 3; k < 240; k++) { lg += Math.log(P[k] + 1e-6); ar += P[k] + 1e-6; nb++; }
    const flat = Math.exp(lg / nb) / (ar / nb);   // 0 = pure tones … 1 = noise
    win.push({ db, cv, flat });
  }
  const floor = [...win.map((w) => w.db)].sort((a, b) => a - b)[Math.floor(N * 0.5)];
  const kindOf = (w, i) => {
    if (w.db < -50) return "quiet";
    const before = win.slice(Math.max(0, i - 8), i).map((v) => v.db).sort((a, b) => a - b), base = before.length ? before[Math.floor(before.length / 2)] : floor;
    if (w.db > base + 12 && w.db > -40) return "effect";                          // a sudden loud sound
    if (w.flat > 0.3) return "ambience";                                           // noise-like: wind, rain, traffic, a crowd
    if (w.cv > 0.32) return "speech";                                              // tonal and pulsing like syllables
    return "music";                                                                // tonal and steady
  };
  const lab = win.map(kindOf), seg = [];
  for (let i = 0; i < N; i++) { const k = lab[i], last = seg[seg.length - 1];
    if (last && last.kind === k && last.to === i) last.to = i + 1; else seg.push({ kind: k, from: i, to: i + 1 }); }
  // tidy: a short stretch between two of the same kind joins them; a single sound stays short; quiet is left out
  const out = [];
  for (const s of seg) { const len = (s.to - s.from) * 0.25, prev = out[out.length - 1];
    if (s.kind === "quiet") continue;
    if (prev && prev.kind === s.kind && s.from - prev.to <= 2) { prev.to = s.to; continue; }
    if (s.kind !== "effect" && len < 0.75) { if (prev && prev.kind !== "effect" && s.from - prev.to <= 1) prev.to = s.to; continue; }   // (a single sound stays as short as it is)
    out.push({ ...s }); }
  return out.slice(0, 30).map((s, i) => { const a = s.from * 0.25, e = Math.min(dur || Infinity, s.to * 0.25), part = win.slice(s.from, s.to);
    return { id: "s" + (i + 1), kind: s.kind, from: r2(a), to: r2(e), db: Math.round(part.reduce((t, w) => t + w.db, 0) / Math.max(1, part.length)) }; });
}

// ---- the picture
const shot = (file, t, to) => run132(FF(), ["-y", "-v", "error", ...(t != null ? ["-ss", t.toFixed(3)] : []), "-i", file, "-frames:v", "1", "-vf", "scale='min(768,iw)':-2", "-q:v", "4", to], 60000);
const asData = (f) => "data:image/jpeg;base64," + fs.readFileSync(f).toString("base64");
// where something is, in words (for the engines): left / middle / right, top / bottom, near / far
export function whereWords136(box) {
  if (!Array.isArray(box) || box.length < 4) return "";
  const [x, y, w, h] = box.map((v) => clamp(+v || 0, 0, 1)), cx = x + w / 2, cy = y + h / 2, area = w * h;
  const side = cx < 0.36 ? "on the left" : cx > 0.64 ? "on the right" : "in the middle", up = cy < 0.33 ? "at the top" : cy > 0.7 ? "at the bottom" : "";
  return [side, up, area > 0.25 ? "in the foreground" : area < 0.03 ? "small, in the background" : ""].filter(Boolean).join(", ");
}
// a few words that name things, for the list made without a vision AI (English and Arabic)
const WORDS136 = {
  person: ["man", "men", "woman", "women", "girl", "boy", "child", "children", "kid", "person", "people", "lady", "guy", "soldier", "soldiers", "raider", "raiders", "chef", "dancer", "worker", "driver", "family", "crowd", "رجل", "امرأة", "فتاة", "ولد", "طفل", "أطفال", "شخص", "ناس", "جنود"],
  animal: ["dog", "cat", "horse", "bird", "falcon", "eagle", "lion", "tiger", "cow", "camel", "fish", "elephant", "كلب", "قطة", "حصان", "طائر", "صقر", "أسد", "جمل", "سمكة"],
  vehicle: ["car", "cars", "truck", "bus", "bike", "bicycle", "motorcycle", "train", "boat", "ship", "plane", "helicopter", "taxi", "سيارة", "شاحنة", "حافلة", "دراجة", "قطار", "قارب", "سفينة", "طائرة"],
  building: ["house", "building", "buildings", "tower", "castle", "church", "mosque", "bridge", "palace", "shop", "café", "cafe", "skyscraper", "منزل", "بيت", "مبنى", "برج", "قلعة", "مسجد", "جسر", "قصر", "متجر"],
  object: ["cup", "phone", "bag", "hat", "chair", "table", "sword", "ball", "flower", "flowers", "book", "bottle", "lamp", "umbrella", "guitar", "laptop", "box", "coat", "dress", "كوب", "هاتف", "حقيبة", "قبعة", "كرسي", "طاولة", "كرة", "زهرة", "كتاب", "زجاجة", "مظلة"],
  place: ["street", "beach", "forest", "desert", "city", "room", "garden", "sky", "sea", "ocean", "mountain", "mountains", "road", "park", "field", "river", "شارع", "شاطئ", "غابة", "صحراء", "مدينة", "غرفة", "حديقة", "سماء", "بحر", "جبل", "طريق", "نهر"],
};
export function basicItems136(prompt) {
  const words = String(prompt || "").toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter(Boolean), seen = new Set(), out = [];
  for (const w of words) for (const [kind, list] of Object.entries(WORDS136)) {
    if (!list.includes(w)) continue; const key = w.replace(/s$/, ""); if (seen.has(key)) continue; seen.add(key);
    out.push({ kind, name: w, en: "the " + w, frames: null, box: null }); }
  return out.slice(0, 12);
}
// a box in whatever form the vision AI gave it → [x, y, w, h], fractions: [x, y, w, h] 0–1 (asked), the same 0–1000 or in pixels of a
// 1000-wide frame, [x1, y1, x2, y2], or Gemini's "box_2d" [ymin, xmin, ymax, xmax] 0–1000
export function box136(it) {
  let b = it && Array.isArray(it.box_2d) && it.box_2d.length >= 4 ? [it.box_2d[1], it.box_2d[0], it.box_2d[3], it.box_2d[2]].map(Number) : null, corners = !!b;
  if (!b) { if (!it || !Array.isArray(it.box) || it.box.length < 4) return null; b = it.box.slice(0, 4).map(Number); }
  if (b.some((v) => !Number.isFinite(v))) return null;
  if (b.some((v) => v > 1.5)) { const m = Math.max(...b) > 1000 ? Math.max(...b) : 1000; b = b.map((v) => v / m); }
  if (!corners && (b[0] + b[2] > 1.05 || b[1] + b[3] > 1.05) && b[2] > b[0] && b[3] > b[1]) corners = true;   // (x1, y1, x2, y2)
  if (corners) b = [b[0], b[1], b[2] - b[0], b[3] - b[1]];
  b = b.map((v) => clamp(v, 0, 1)); if (b[2] < 0.01 || b[3] < 0.01) return null;
  return b.map(r2);
}
// a small picture with nothing in it (one flat colour)
async function flat136(file) { try { const g = await runBuf(["-v", "error", "-i", file, "-vf", "scale=24:24,format=gray", "-f", "rawvideo", "-"], 20000); if (g.length < 64) return true;
  let s = 0, q = 0; for (const v of g) { s += v; q += v * v; } const m = s / g.length; return Math.sqrt(Math.max(0, q / g.length - m * m)) < 5; } catch { return false; } }
async function crop(frame, box, to) {
  const b = Array.isArray(box) && box.length >= 4 ? box.map((v) => clamp(+v || 0, 0, 1)) : null;
  const vf = b ? `crop=iw*${clamp(b[2] * 1.3, 0.05, 1).toFixed(4)}:ih*${clamp(b[3] * 1.3, 0.05, 1).toFixed(4)}:iw*${clamp(b[0] - b[2] * 0.15, 0, 1 - clamp(b[2] * 1.3, 0.05, 1)).toFixed(4)}:ih*${clamp(b[1] - b[3] * 0.15, 0, 1 - clamp(b[3] * 1.3, 0.05, 1)).toFixed(4)},scale=160:-2` : "scale=160:-2";
  await run132(FF(), ["-y", "-v", "error", "-i", frame, "-vf", vf, "-q:v", "5", to], 30000);
  return fs.existsSync(to) ? publicUrl(path.basename(to)) : null;
}
const LANGS = { ar: "Arabic", en: "English", fr: "French", es: "Spanish", de: "German", tr: "Turkish", ur: "Urdu", hi: "Hindi", id: "Indonesian", ru: "Russian", zh: "Chinese", pt: "Portuguese", it: "Italian", ja: "Japanese", ko: "Korean" };
const RUNNING = new Map();
// what is in it: { kind: video|image, dur, w, h, scene, items:[{id, kind, name, en, where, seen:[[a,b]], at, box, thumb}], sounds:[…], by }
export async function scan136(file, { lang = "en", prompt = "", isImage = false } = {}) {
  const base = path.basename(file).replace(/\.[^.]+$/, ""), L = LANGS[lang] ? lang : "en", cache = path.join(MEDIA_DIR, `${base}.scan136.${L}.json`);
  const vision = () => llmConfigured() || nvOn("vision");
  try { if (fs.existsSync(cache)) { const c = JSON.parse(fs.readFileSync(cache, "utf8")); if (!(c.by === "basic" && vision()) && (c.items || []).every((i) => !i.thumb || fs.existsSync(path.join(MEDIA_DIR, path.basename(i.thumb))))) return c; } } catch {}   // (v136: a short list made because the agents couldn't look isn't kept once they can)
  if (RUNNING.has(cache)) return RUNNING.get(cache);
  const job = (async () => {
    const info = isImage ? null : await probe132(file), dur = isImage ? 0 : info.dur || 0;
    const n = isImage ? 1 : dur <= 6 ? 4 : dur <= 15 ? 6 : dur <= 40 ? 8 : 10, step = isImage ? 0 : dur / n, times = isImage ? [null] : Array.from({ length: n }, (_, k) => r2(step * (k + 0.5)));
    const frames = [];
    for (let k = 0; k < times.length; k++) { const f = path.join(MEDIA_DIR, `${base}.s136.f${k}.jpg`); await shot(file, times[k], f); if (fs.existsSync(f)) frames.push(f); }
    if (!frames.length) throw new Error("the video can't be read");
    const sound = !isImage && info.audio ? await soundMap136(file, dur) : [];
    let got = null, by = "basic", err = null;
    // v136: the frames go as ONE picture — a grid, read left to right then top to bottom (frame 0 top-left). Several pictures in
    // one request failed on vision models that take one picture at a time (NVIDIA's), and the short list made instead was empty
    // ("no people, no things — only blank pictures").
    const cols = isImage ? 1 : frames.length <= 4 ? 2 : frames.length <= 6 ? 3 : frames.length <= 8 ? 4 : 5, rows = isImage ? 1 : Math.ceil(frames.length / cols);
    let sheet = frames[0];
    if (!isImage) { sheet = path.join(MEDIA_DIR, `${base}.s136.grid.jpg`);
      await run132(FF(), ["-y", "-v", "error", "-start_number", "0", "-i", path.join(MEDIA_DIR, `${base}.s136.f%d.jpg`), "-vf", `scale=${frames.length <= 4 ? 512 : 384}:-2,tile=${cols}x${rows}:padding=8:color=white`, "-frames:v", "1", "-q:v", "4", sheet], 60000).catch(() => {});
      if (!fs.existsSync(sheet)) sheet = null; }
    if (vision()) {
      const ask = `You are nooi's analysis team, looking at ${isImage ? "a picture" : `one picture made of ${frames.length} frames of a ${r2(dur)}-second video, laid out in a grid of ${cols} columns and ${rows} rows with white lines between them, in order left to right and then top to bottom — frame 0 is top-left (frame k is at ${times.map((t, k) => `${k}: ${t} s`).join(", ")})`}, so the customer can pick things to change or replace.
- Continuity supervisor: list every person, animal, vehicle, building, object, place feature and visible writing or logo someone might want to change — each one once even when it is in several frames (a group of similar people in the background is one item). Most important first, at most 16.
  For each: "kind" (person | animal | vehicle | building | object | place | text), "name" — a short name in ${LANGS[L]} the customer will recognise ("the woman in the red coat"), "en" — an exact description in English that finds it again (colours, clothes, material, size, what it is doing), "frames" — the frame numbers it is seen in${isImage ? " (use [0])" : ""}, "best" — the frame where it is clearest, "box" — its box in that frame as [x, y, width, height], fractions of that ${isImage ? "picture" : "frame (not of the whole grid)"} from its top-left corner (0–1).
${sound.length ? `- Sound agent: our measurements of the sound found these stretches: ${sound.map((s) => `${s.id} ${s.from}–${s.to} s ${s.kind === "effect" ? "a short loud sound" : s.kind === "ambience" ? "a noise-like background sound" : s.kind === "speech" ? "something like a voice" : "tonal, steady (like music)"}`).join("; ")}. From what is seen, name what each probably is, in ${LANGS[L]} ("a man talking", "soft piano", "a door slams", "rain on the street"), and correct its kind (speech | music | ambience | effect).\n` : ""}${prompt ? `What the ${isImage ? "picture" : "video"} was made from: "${String(prompt).slice(0, 500)}"\n` : ""}Answer with JSON: {"scene":"one sentence in ${LANGS[L]}","items":[{"kind":"person","name":"…","en":"…","frames":[0,1],"best":0,"box":[0.1,0.2,0.3,0.6]}]${sound.length ? ',"sounds":[{"id":"s1","kind":"speech","name":"…"}]' : ""}}`;
      try { if (!sheet) throw new Error("the frames couldn't be put together"); got = await llmJson(ask, { images: [asData(sheet)], maxTokens: 3000, tier: "quick", timeoutMs: 120000 }); by = "agents"; }
      catch (e) { err = String(e.message || e).slice(0, 300); console.warn("scan136:", err); got = null; }
    }
    const raw = got && Array.isArray(got.items) ? got.items : basicItems136(prompt);
    const items = [];
    for (const it of raw.slice(0, 16)) {
      const kind = KINDS136.includes(it && it.kind) ? it.kind : "object", name = String((it && it.name) || "").trim().slice(0, 80), en = String((it && it.en) || name).trim().slice(0, 300);
      if (!name && !en) continue;
      const fr = (Array.isArray(it.frames) && it.frames.length ? it.frames : frames.map((_, k) => k)).map((k) => Math.round(+k)).filter((k) => k >= 0 && k < frames.length).sort((a, b) => a - b);
      const best = fr.includes(Math.round(+it.best)) ? Math.round(+it.best) : fr[Math.floor(fr.length / 2)] ?? 0;
      // the seconds it is seen: frames next to each other run together, half a step either side
      const seen = []; if (!isImage) for (const k of fr) { const a = Math.max(0, times[k] - step / 2), b = Math.min(dur, times[k] + step / 2), last = seen[seen.length - 1]; if (last && a <= last[1] + 1e-6) last[1] = b; else seen.push([a, b]); }
      const id = "i" + (items.length + 1), box = box136(it);
      let thumb = await crop(frames[best] || frames[0], box, path.join(MEDIA_DIR, `${base}.s136.${id}.jpg`)).catch(() => null);
      if (thumb && box && (await flat136(path.join(MEDIA_DIR, `${base}.s136.${id}.jpg`)))) thumb = await crop(frames[best] || frames[0], null, path.join(MEDIA_DIR, `${base}.s136.${id}.jpg`)).catch(() => null);
      items.push({ id, kind, name: name || en, en, where: whereWords136(box), seen: seen.map(([a, b]) => [r2(a), r2(b)]), at: isImage ? null : times[best], box, thumb });
    }
    const named = new Map(((got && got.sounds) || []).map((s) => [String(s.id), s]));
    const sounds = sound.map((s) => { const g = named.get(s.id) || {}; return { ...s, kind: SOUNDS136.includes(g.kind) ? g.kind : s.kind, name: String(g.name || "").slice(0, 80) || null }; });
    const out = { kind: isImage ? "image" : "video", dur: r2(dur), w: isImage ? null : info.w, h: isImage ? null : info.h, scene: String((got && got.scene) || "").slice(0, 300), items, sounds, by, lang: L, frames: frames.map((f, k) => ({ t: times[k], url: publicUrl(path.basename(f)) })), ...(err ? { err } : {}) };
    if (!err) fs.writeFileSync(cache, JSON.stringify(out));   // (a failed look isn't kept: the next time, the agents look again)
    return out;
  })();
  RUNNING.set(cache, job); try { return await job; } finally { RUNNING.delete(cache); }
}
// the words said, laid on the speech stretches (speech-to-text, when the customer asks for it): the scan with lines added
export function withWords136(scan, lines) {
  const sp = (scan.sounds || []).filter((s) => s.kind === "speech"), L = (lines || []).map((l) => ({ s: +l.s || 0, e: +l.e || +l.s || 0, text: String(l.text || "").trim(), spk: +l.spk || 0 })).filter((l) => l.text);
  for (const s of sp) { const mine = L.filter((l) => l.e > s.from - 0.25 && l.s < s.to + 0.25); s.text = mine.map((l) => l.text).join(" ").slice(0, 600) || null; s.who = mine.length ? "Speaker " + (mine[0].spk + 1) : null; }
  // speech the measurements missed (quiet or under music) is added as its own stretch
  for (const l of L) if (!sp.some((s) => l.e > s.from - 0.25 && l.s < s.to + 0.25)) scan.sounds.push({ id: "s" + (scan.sounds.length + 1), kind: "speech", from: r2(l.s), to: r2(Math.max(l.e, l.s + 0.5)), db: null, name: null, text: l.text, who: "Speaker " + (l.spk + 1) });
  scan.sounds.sort((a, b) => a.from - b.from); scan.heard = true; return scan;
}
export const scanCache136 = (file, lang) => path.join(MEDIA_DIR, `${path.basename(file).replace(/\.[^.]+$/, "")}.scan136.${LANGS[lang] ? lang : "en"}.json`);
