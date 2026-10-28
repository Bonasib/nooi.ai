// v132: long videos (up to 2 minutes) and Extend — the agents and the engines together. An engine makes a shot of 5–15 s;
// a longer video is made of connected parts: each part starts on the last frame of the part before it (lib/jobs.js chainAfter),
// the agents plan the whole video first (one shot per part + a continuity "bible": the characters, the place, the time, the
// light, the style — never changed between parts), and when every part is made they are joined into ONE video file (before,
// the result was only the first part, with the others listed beside it). Extend adds a new part after a finished video, from its
// last frame, and joins the two.
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { MEDIA_DIR, localPath, download, publicUrl } from "./media.js";
import { uid } from "./store.js";
import { llmConfigured, llmJson } from "../providers/anthropic.js";
import { kieDur } from "../providers/kie.js";
import { REGISTRY } from "./models.js";

export const MAX_LONG132 = 120;      // seconds: the longest video the parts can make
export const MAX_PARTS132 = 16;
// the longest shot each engine makes well (seconds) — a longer video is split into parts no longer than this
const PART_MAX = { seedance: 15, seedance20: 15, seedance25: 15, seedance2mini: 15, kling30: 15, kling30t: 15, wan30: 15, wan27: 15, wan22: 15, qwenwan: 15,
  hunyuan: 15, happyhorse: 15, grok15: 15, kling: 10, kling26: 10, kling40: 30, hailuo: 10, hailuoh3: 10, gemomni: 10, grok: 15, pixverse6: 8, veo31: 8, veo31f: 8, ltx23: 8, ltxfast: 15, auto: 15,
  veo: 8, veofast: 8 };   // (v133: Veo 3 / Veo 3 Fast make 8 s shots — they were missing, so a minute on Veo came out 48 s)
export const partMax132 = (model) => PART_MAX[String(model || "auto")] || 10;
const MC = /^mc(26|30|swap)$/;
// v133: the shot lengths an engine really makes (the engine's own rule — providers/kie.js kieDur — up to the longest good shot):
// Veo 8 s only, MiniMax 6 or 10 s, Kling 2.6 5 or 10 s, Gemini Omni 4–10 s in steps of 2, the others any whole second in a range
export function shotLens133(model, key) {
  const cap = partMax132(model), k = String(key || "");
  if (k.startsWith("kie@")) { const id = k.slice(4), s = new Set();
    for (let d = 1; d <= 30; d++) { const r = Math.round(+kieDur(id, d) || 0); if (r >= 1 && r <= Math.max(cap, 8)) s.add(r); }
    const L = [...s].sort((a, b) => a - b).filter((x) => x <= cap); if (L.length) return L;
    if (s.size) return [Math.min(...s)]; }
  return Array.from({ length: Math.max(1, cap - 2) }, (_, i) => i + 3);   // (another engine: 3 s to its longest)
}
// v133: the length of every part — each a length its own engine really makes, together the asked length (a little more only when the
// engine's fixed shots don't add up to it exactly: 60 s on Veo = 8 × 8 s); as few parts as possible, as even as possible.
// lensOf(i) = the lengths part i's engine makes; want = the parts asked (the crew's shots), each part's own length if asked (wantDurs).
export function planDurs133(total, lensOf, want = 0, wantDurs = null) {
  total = Math.min(MAX_LONG132, Math.max(1, Math.round(+total || 5)));
  const mx = (i) => Math.max(...lensOf(i)), mn = (i) => Math.min(...lensOf(i));
  if (Array.isArray(wantDurs) && wantDurs.length > 1) {   // the crew's own shot lengths, each the nearest its engine makes
    return wantDurs.slice(0, MAX_PARTS132).map((d, i) => lensOf(i).reduce((b, x) => (Math.abs(x - d) < Math.abs(b - d) || (Math.abs(x - d) === Math.abs(b - d) && x > b) ? x : b), lensOf(i)[0])); }
  let n = 0, sum = 0; while (n < MAX_PARTS132 && sum < total) sum += mx(n++);
  n = Math.min(MAX_PARTS132, Math.max(n, Math.min(MAX_PARTS132, +want || 0)));
  const rest = (i) => { let s = 0; for (let j = i; j < n; j++) s += mx(j); return s; };
  const out = []; let rem = total;
  for (let i = 0; i < n; i++) { const A = lensOf(i), left = n - i;
    if (i === n - 1) { out.push(A.find((x) => x >= rem) ?? A[A.length - 1]); break; }
    const target = Math.max(mn(i), rem / left), need = rem - rest(i + 1), pool = A.filter((x) => x >= need);
    const P = pool.length ? pool : [A[A.length - 1]];
    const a = P.reduce((b, x) => (Math.abs(x - target) < Math.abs(b - target) || (Math.abs(x - target) === Math.abs(b - target) && x > b) ? x : b), P[0]);
    out.push(a); rem = Math.max(0, rem - a); }
  // one engine for every part: the longest parts first, the shortest last (a short ending, not a short shot in the middle)
  const same = out.every((_, i) => String(lensOf(i)) === String(lensOf(0)));
  return same ? out.sort((x, y) => y - x) : out;
}
// a video longer than its engine's shot: the length of each part (null = one shot is enough). keyOf(i) = part i's engine route.
export function longPlan133(body, keyOf) {
  if (!body || body.kind !== "video" || MC.test(String(body.model || "")) || body.meta?.swap93) return null;
  const pm = Array.isArray(body.meta?.partModels) ? body.meta.partModels : null, modelOf = (i) => (pm && pm[i]) || body.model || "auto";
  const lensOf = (i) => shotLens133(modelOf(i), keyOf ? keyOf(i) : "");
  const durs = planDurs133(body.dur, lensOf, +body.meta?.parts || 0, Array.isArray(body.meta?.partDurs) && body.meta.partDurs.length === +body.meta?.parts ? body.meta.partDurs.map(Number) : null);
  return durs.length > 1 ? durs : null;
}
// the shot lengths of every video engine, for the page (it plans the parts the same way: lib/long132.js planDurs133 = durs133 there)
export const shotsTable133 = (keyFor) => Object.fromEntries(Object.entries(REGISTRY).filter(([k, v]) => v.kind === "video" && !MC.test(k)).map(([k]) => { let key = ""; try { key = keyFor(k) || ""; } catch {} return [k, shotLens133(k, key)]; }));
// a video longer than its engine's shot: how many parts (0 = one shot is enough)
export function partsFor132(body, keyOf) { const d = longPlan133(body, keyOf); return d ? d.length : 0; }
const clip = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
// the plan when no text AI is connected: the same idea told as a beginning, a middle that moves on, and an end
export function offlinePlan132(idea, n) {
  const w = clip(idea, 600);
  const shots = Array.from({ length: n }, (_, i) => i === 0 ? `Opening shot — establish the scene and the characters: ${w}`
    : i === n - 1 ? `Final shot — the action reaches a natural end, the camera settles: ${w}`
    : `The action moves on to its next moment (${i + 1} of ${n}), without a cut and without a new scene: ${w}`);
  return { title: clip(idea, 60), bible: `Keep exactly the same characters (faces, hair, clothes and colours), the same place, time of day, weather, light, colour palette and visual style as in the first shot. ${w}`, shots, by: "offline" };
}
// (v155: the Writer keeps to the idea — "a story with a beginning, a middle and an end" made up events nobody asked for)
// the agents' plan: Writer (the story across the parts), Director (one shot per part, each the continuation of the one before),
// Cinematographer (one camera language), Continuity supervisor (the bible). One request to the text AI; checked; else offline.
export async function planLong132(body, n) {
  const idea = clip(body.prompt, 2000), dur = Math.round(+body.dur || n * 10), per = Math.round(dur / n);
  if (!idea || !llmConfigured()) return offlinePlan132(idea, n);
  const ask = `You are nooi's film crew making ONE continuous ${dur}-second video in ${n} connected shots of about ${per} seconds each. Every shot starts exactly on the last frame of the shot before it, so the action must flow on: same characters, same place (unless they move there in view), same time of day, light and style.
- Writer: carry the idea across the ${n} shots — the shots together show exactly what the idea asks for, with everything it names (people, animals, objects, place, actions, colours, camera, style). Add no new characters, objects, places or events it doesn't ask for; a simple idea (one action) simply goes on through the shots.
- Director: write one shot for each part, as the next moment of the shot before it — never restart the scene, never jump to a new location or a new day. End every shot but the last in the middle of an action (not on a still, a fade or a cut), so the next shot carries the movement on.
- Cinematographer: one camera language and lens for the whole video; say the camera move in each shot.
- Continuity supervisor: a short bible — every character (age, face, hair, clothes and their colours), the place, the time of day and weather, the light and colour palette, the visual style. Nothing in it changes between shots.
${body.meta?.vo ? `Voice-over to fit: "${clip(body.meta.vo, 600)}"\n` : ""}Idea: "${idea}"
Answer in English with JSON: {"title":"…","bible":"…","shots":["shot 1","shot 2",…]} — exactly ${n} shots, each under 70 words, no numbering.`;
  try {
    const r = await llmJson(ask, { maxTokens: 300 + n * 160, tier: "quick", timeoutMs: 60000 });
    const shots = (Array.isArray(r.shots) ? r.shots : []).map((s) => clip(typeof s === "string" ? s : s && (s.shot || s.text || s.action), 500)).filter(Boolean);
    if (shots.length < Math.min(n, 2)) throw new Error("the plan had " + shots.length + " shots");
    const off = offlinePlan132(idea, n);
    while (shots.length < n) shots.push(off.shots[shots.length]);
    return { title: clip(r.title, 80) || off.title, bible: clip(r.bible, 900) || off.bible, shots: shots.slice(0, n), by: "agents" };
  } catch (e) { console.warn("long video plan:", e.message); return offlinePlan132(idea, n); }
}
// the first / end frame sentences the words step puts in front of a video's words (lib/intent.js frameWords): in a long video they
// belong to the first part and the last part only, not to the idea the agents plan from
const FRAME_RE = /^The video (?:starts exactly on the first-frame picture|ends exactly on the end-frame picture)[^\n]*(?:\n|$)/;
export const stripFrames132 = (p) => String(p || "").replace(FRAME_RE, "").trim();
const KEEP = "the same place, subject, people, composition, colours, light and visual style";
// the words for part i (0-based) of n (fr: the video has a first frame / an end frame)
export function partPrompt132(body, i, n, fromPicture, fr) {
  const m = body.meta || {}, shot = (Array.isArray(m.shots) && m.shots[i]) || body.prompt, bible = m.bible ? `\n\nContinuity: ${m.bible}` : "";
  const link = fromPicture ? " — bring this storyboard picture to life: same characters, place, light and style"
    : i ? `\n\nThis shot continues seamlessly from the previous one (part ${i + 1} of ${n}): it begins exactly on the previous shot's last frame — the same characters, place, light and camera style; no cut, no new scene. The first frame is already in motion: every movement and the camera carry on at the same speed and in the same direction — no pause, no reset.` : "";
  const head = (fr && fr.first && i === 0 ? `The video starts exactly on the first-frame picture and continues from it, with ${KEEP} as that picture.\n` : "")
    + (fr && fr.end && i === n - 1 ? `The video ends exactly on the end-frame picture, with ${KEEP} as that picture; everything moves naturally toward it.\n` : "");
  return `${head}${shot}${bible}${link}`.trim();
}
// ---- joining
export const FF = () => process.env.FFMPEG_PATH || "ffmpeg", FP = () => process.env.FFPROBE_PATH || "ffprobe";
export const run132 = (bin, args, ms) => new Promise((ok, bad) => { const p = spawn(bin, args); let out = "", err = "";
  const t = setTimeout(() => { try { p.kill("SIGKILL"); } catch {} bad(new Error("timed out")); }, ms);
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err = (err + d).slice(-600)));
  p.on("error", (e) => { clearTimeout(t); bad(e); }); p.on("close", (c) => { clearTimeout(t); c === 0 ? ok(out) : bad(new Error(err.trim() || "exit " + c)); }); });
export async function probe132(file) {
  const j = JSON.parse(await run132(FP(), ["-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate:format=duration", "-of", "json", file], 30000));
  const v = (j.streams || []).find((s) => s.codec_type === "video"), a = (j.streams || []).some((s) => s.codec_type === "audio");
  if (!v) throw new Error("no picture in " + path.basename(file));
  const [fn, fd] = String(v.r_frame_rate || "24/1").split("/").map(Number);
  return { w: +v.width, h: +v.height, fps: fd ? fn / fd : 24, audio: a, dur: +j.format?.duration || 0 };
}
// a file on this server for a URL (our own /media files are read in place)
export async function fileOf132(u) {
  const loc = localPath(u) || (/^\/media\/[A-Za-z0-9._-]+$/.test(String(u)) ? path.join(MEDIA_DIR, path.basename(u)) : null);
  if (loc && fs.existsSync(loc)) return loc;
  return (await download(u)).file;
}
// the parts end to end in one MP4: every part at the first part's size and frame rate, the repeated first frame of each next part
// dropped (it is the last frame of the part before), the sound kept (silence where a part has none), short fades at the joins
export async function joinLong132(urls) {
  const files = []; for (const u of urls) files.push(await fileOf132(u));
  const info = []; for (const f of files) info.push(await probe132(f));
  const W = Math.max(2, info[0].w - (info[0].w % 2)), H = Math.max(2, info[0].h - (info[0].h % 2)), F = Math.min(30, Math.max(12, Math.round(info[0].fps) || 24)), sound = info.some((i) => i.audio);
  const fc = [];
  info.forEach((it, i) => {
    const s = i ? 1 / F : 0, d = Math.max(0.2, (it.dur || 5) - s);
    fc.push(`[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${F},format=yuv420p,trim=start=${s.toFixed(4)}:duration=${d.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`);
    if (sound) fc.push(it.audio ? `[${i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=start=${s.toFixed(4)}:duration=${d.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.04,afade=t=out:st=${Math.max(0, d - 0.06).toFixed(3)}:d=0.06[a${i}]`
      : `anullsrc=r=48000:cl=stereo,atrim=duration=${d.toFixed(3)},aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`);
  });
  fc.push(info.map((_, i) => `[v${i}]` + (sound ? `[a${i}]` : "")).join("") + `concat=n=${info.length}:v=1:a=${sound ? 1 : 0}[v]` + (sound ? "[a]" : ""));
  const name = uid() + "-long.mp4", out = path.join(MEDIA_DIR, name), total = info.reduce((a, i) => a + (i.dur || 5), 0);
  await run132(FF(), ["-y", "-v", "error", ...files.flatMap((f) => ["-i", f]), "-filter_complex", fc.join(";"), "-map", "[v]", ...(sound ? ["-map", "[a]", "-c:a", "aac", "-b:a", "160k"] : ["-an"]),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], Math.max(120000, total * 6000));
  if (!fs.existsSync(out) || !fs.statSync(out).size) throw new Error("the parts couldn't be joined");
  const r = await probe132(out);
  return { url: publicUrl(name), dur: Math.round(r.dur * 10) / 10, w: r.w, h: r.h };
}
export const durOf132 = async (u) => (await probe132(await fileOf132(u))).dur;
