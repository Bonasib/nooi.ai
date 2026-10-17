// v95: Motion Control and Character Swap get files the engine can always read.
// A phone video is often 4K (the model refuses a side over 2048 px), HEVC, 60 fps, or stored sideways with a rotation tag
// the model ignores; a phone photo is often stored sideways with an EXIF orientation; a video from the library may still
// point at the engine's expiring link. The engine then failed with a bare "Internal Error", or worked on a sideways or
// cropped picture and made something different. Before anything is charged, the server now makes:
//   · the movement video → H.264 MP4, upright, ≤ 1280 px on the long side, ≤ 30 fps, 2–30 s, under 9.5 MB (kept as it is
//     when it already is all of that)
//   · the photo → an upright JPEG, ≤ 2048 px on the long side
// and refuses, with the reason in words and nothing charged, a file that can't be read, a video under 2 s, or a shape
// outside 1:3 … 3:1.
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { uid } from "./store.js";
import { MEDIA_DIR, publicUrl, localPath, download } from "./media.js";
import { llmConfigured, llmJson } from "../providers/anthropic.js";
import os from "os";

const FF = () => process.env.FFMPEG_PATH || "ffmpeg", FP = () => process.env.FFPROBE_PATH || "ffprobe";
const run = (bin, args, ms = 180000) => new Promise((ok, bad) => {
  const p = spawn(bin, args); let out = "", err = ""; const t = setTimeout(() => { try { p.kill("SIGKILL"); } catch {} bad(new Error(path.basename(bin) + " took too long")); }, ms);
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d)); p.on("error", (e) => { clearTimeout(t); bad(e); });
  p.on("close", (c) => { clearTimeout(t); c === 0 ? ok(out) : bad(new Error(path.basename(bin) + ": " + err.trim().split("\n").slice(-1)[0].slice(0, 200))); });
});
const refuse = (msg) => { throw Object.assign(new Error(msg), { code: 400 }); };
const MB = 1024 * 1024;

// a file on this server for a /media link (relative or absolute), else a copy of a remote one
async function toLocal(url, what) {
  const u = String(url || ""); if (!u) return null;
  const rel = /^\/media\/[^/]+$/.test(u) ? path.join(MEDIA_DIR, path.basename(u)) : null, loc = rel || localPath(u);
  if (loc) { if (fs.existsSync(loc)) return loc; refuse(`The ${what} isn't on the server any more — add it again.`); }
  if (!/^https?:\/\//.test(u)) refuse(`The ${what} couldn't be read — add it again.`);
  try { return (await download(u, null, { tries: 2, timeoutMs: 120000 })).file; }
  catch { refuse(`The ${what} couldn't be downloaded (its link may have expired) — add it again from your device.`); }
}
async function probe(file) {
  const j = JSON.parse(await run(FP(), ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file], 30000));
  const v = (j.streams || []).find((s) => s.codec_type === "video" && !(s.disposition && s.disposition.attached_pic));
  if (!v) return null;
  const sd = (v.side_data_list || []).find((x) => x.rotation != null), rot = Math.abs(Math.round(+(sd ? sd.rotation : (v.tags || {}).rotate) || 0)) % 360;
  const [a, b] = String(v.avg_frame_rate || v.r_frame_rate || "0/1").split("/").map(Number), fps = b ? a / b : 0;
  const w = rot === 90 || rot === 270 ? +v.height : +v.width, h = rot === 90 || rot === 270 ? +v.width : +v.height;
  return { codec: v.codec_name, pix: v.pix_fmt, w, h, rot, fps, dur: +(j.format && j.format.duration) || +v.duration || 0, size: +(j.format && j.format.size) || fs.statSync(file).size, audio: (j.streams || []).some((s) => s.codec_type === "audio") };
}
// (v105: max = the longest video the engine takes — 15 s for the swap on MiniMax H3, 30 s for the moves; a longer swap video is
// refused with the reason, nothing charged — the page says the same before)
export async function prepVideo(url, max = 30) {
  const src = await toLocal(url, "movement video"), info = await probe(src).catch(() => null);
  if (!info || !info.w || !info.h) refuse("This video can't be read — save it as an MP4 and add it again.");
  if (info.dur && info.dur < 2) refuse("The movement video is shorter than 2 seconds — use a video of 2 to 30 seconds.");
  if (max < 30 && info.dur > max + 0.5) refuse(`This video is ${Math.round(info.dur)} s — Replace the person takes videos of up to ${max} s. Trim it in the editor first.`);
  const r = info.w / info.h; if (r > 3 || r < 1 / 3) refuse("The video is too wide or too tall — use a normal portrait, landscape or square video.");
  const ok = info.codec === "h264" && info.pix === "yuv420p" && !info.rot && Math.max(info.w, info.h) <= 1280 && info.fps <= 31 && info.dur <= max + 0.05 && info.size < 9.5 * MB && /\.mp4$/i.test(src);
  if (ok) return { url: publicUrl(path.basename(src)), file: src, info, changed: false };
  const name = uid() + "-mc.mp4", out = path.join(MEDIA_DIR, name), after = await encodeMc(src, info, out, 0, Math.min(max, info.dur || max));
  return { url: publicUrl(name), file: out, info: after, changed: true, from: info };
}
// one engine-ready copy of a video, from `start`, `len` seconds long: the long side ≤ 1280 (even sizes), upright (ffmpeg turns a
// tagged video upright itself), 30 fps at most, under 10 MB
// (v104: the engine's 10 MB is spent on picture quality — products, text and small details are drawn from this copy:
// up to 12 Mb/s, at least visually lossless quality (CRF 17) when that fits, a careful encode)
async function encodeMc(src, info, out, start, len) {
  const long = Math.min(1280, Math.max(info.w, info.h)), sc = info.w >= info.h ? `scale=${long}:-2` : `scale=-2:${long}`;
  const kbps = Math.max(1500, Math.min(12000, Math.floor((9 * 8 * 1024) / Math.min(30, len || 30)) - 160)), cut = [...(start ? ["-ss", String(start)] : []), "-i", src, "-t", String(len)];
  const snd = (k) => (info.audio ? ["-c:a", "aac", "-b:a", k, "-ac", "2"] : ["-an"]);
  await run(FF(), ["-y", "-v", "error", ...cut, "-vf", `${sc},fps=fps='min(source_fps,30)',format=yuv420p`, "-c:v", "libx264", "-preset", "medium", "-profile:v", "high",
    "-crf", "17", "-maxrate", kbps + "k", "-bufsize", 2 * kbps + "k", "-movflags", "+faststart", ...snd("128k"), out]).catch(async () => {
    // an older ffmpeg without the fps expression: a plain 30 fps
    await run(FF(), ["-y", "-v", "error", ...cut, "-vf", `${sc},fps=30,format=yuv420p`, "-c:v", "libx264", "-preset", "veryfast", "-b:v", kbps + "k", "-maxrate", kbps + "k", "-bufsize", 2 * kbps + "k", "-movflags", "+faststart", ...snd("96k"), out]);
  });
  const after = await probe(out).catch(() => null);
  if (!after || fs.statSync(out).size >= 10 * MB) refuse("This video couldn't be made ready for the engine — try a shorter clip.");
  return after;
}
// v107: Replace the person takes videos of up to 2 minutes. The engine takes 15 s at a time, so a longer video is cut into equal
// parts of up to 15 s — each its own engine-ready copy (the 10 MB spent on each part), swapped on its own and joined again after
export const SWAP_MAX = 120, SWAP_PART = 15;
export async function prepSwapVideo(url) {
  const src = await toLocal(url, "video"), info = await probe(src).catch(() => null);
  if (!info || !info.w || !info.h) refuse("This video can't be read — save it as an MP4 and add it again.");
  if (info.dur > SWAP_MAX + 0.5) refuse(`This video is ${Math.round(info.dur)} s — Replace the person takes videos of up to 2 minutes. Trim it in the editor first.`);
  if (!info.dur || info.dur <= SWAP_PART + 0.5) { const v = await prepVideo(url, SWAP_PART); return { ...v, src, parts: [{ url: v.url, file: v.file, start: 0, dur: v.info.dur }] }; }
  const r = info.w / info.h; if (r > 3 || r < 1 / 3) refuse("The video is too wide or too tall — use a normal portrait, landscape or square video.");
  const n = Math.ceil(info.dur / SWAP_PART), len = info.dur / n, parts = [];
  for (let i = 0; i < n; i++) {   // one after another: a long phone video is heavy work for a small server
    const name = uid() + `-mc${i + 1}.mp4`, out = path.join(MEDIA_DIR, name), a = await encodeMc(src, info, out, i * len, i === n - 1 ? info.dur - i * len + 0.1 : len);
    parts.push({ url: publicUrl(name), file: out, start: Math.round(i * len * 1000) / 1000, dur: a.dur || len });
  }
  return { url: parts[0].url, file: parts[0].file, info, src, parts, changed: true };
}
export async function prepPhoto(url) {
  const src = await toLocal(url, "photo"), name = uid() + "-mc.jpg", out = path.join(MEDIA_DIR, name);
  // ImageMagick turns it upright from its EXIF orientation (what the phone shows); ffmpeg is the fallback
  try { await run(process.env.MAGICK_PATH || "convert", [src + "[0]", "-auto-orient", "-resize", "2048x2048>", "-strip", "-quality", "92", out], 60000); }
  catch { try { await run(FF(), ["-y", "-v", "error", "-i", src, "-frames:v", "1", "-vf", "scale='min(2048,iw)':'min(2048,ih)':force_original_aspect_ratio=decrease", "-q:v", "3", out], 60000); }
    catch { refuse("This photo can't be read — use a JPG or PNG photo."); } }
  if (!fs.existsSync(out) || !fs.statSync(out).size) refuse("This photo can't be read — use a JPG or PNG photo.");
  return { url: publicUrl(name), file: out };
}
// v103: before anything is charged, the text AI (when one is connected — they all read pictures) looks at the photo and three
// frames of the video. The swap engine says only "Internal Error" when it can't find one clear person, so: a photo with no
// person or several (a front / side / back sheet shows the same person three times), or a video with no person (or several,
// for a swap), is refused here with the reason in words, nothing charged — only when the AI is sure. Anything else it notices
// (the person hidden behind an object, the body mostly out of the frame) is kept on the job (meta.mcLook) and said if the
// engine then fails. No AI, or no answer within 40 s: the job goes on as before.
const still = (src, at, out, w) => run(FF(), ["-y", "-v", "error", ...(at != null ? ["-ss", String(at)] : []), "-i", src, "-frames:v", "1", "-vf", `scale='min(${w},iw)':-2`, "-q:v", "4", out], 30000);
const b64 = (f) => "data:image/jpeg;base64," + fs.readFileSync(f).toString("base64");
export const LOOK_MSG = {
  photoNone: "We can't see a person in the photo — use a photo of one person, facing the camera.",
  photoMany: (n) => `This photo shows ${n} people (or the same person ${n} times) — use a photo of just one person, facing the camera.`,
  videoNone: "We can't see a person in the video — use a video of one person.",
  videoMany: (n) => `The video shows ${n} people — tap the person to replace in the video, or add a picture of them.`,
};
// (v107: target = the client pointed at the person to replace, so a video with several people is fine)
export async function lookMotion(body, photo, video, dur, target = false) {
  if (!llmConfigured() || !photo || !video) return;
  const swap = body.model === "mcswap" || !!body.meta?.swap93, tmp = [];
  let r = null;
  try {
    const p = path.join(os.tmpdir(), uid() + ".jpg"); tmp.push(p); await still(photo, null, p, 768);
    for (const f of [0.1, 0.5, 0.9]) { const o = path.join(os.tmpdir(), uid() + ".jpg"); try { await still(video, Math.max(0, (dur || 3) * f), o, 640); tmp.push(o); } catch { /* fewer frames */ } }
    if (tmp.length < 2) return;
    r = await llmJson(`You check the two inputs of a video tool that ${swap ? "replaces the person in a video with the person in a photo" : "makes the character in a photo perform the movement of the person in a video"}.
Image 1 is the photo. The other images are frames from the video.
Return JSON: {"photo_people": how many separate human figures are in image 1 (the same person shown several times — e.g. front, side and back views — counts as several),
"video_people": the largest number of people visible in one video frame,
"video_person": "clear" if one person is well visible (face and most of the body in the frame), "hidden" if something in front of them hides much of the body, "cut" if most of the body is out of the frame, "none" if there is no person,
"note_en": at most 14 words on what in the photo or the video may stop the tool, or "" if nothing,
"note_ar": the same note in Arabic, or "",${swap ? `
"keep_en": the products, objects, logos and written words seen in the video frames that must stay exactly as they are (colour, shape, brand, label), as a short English list of at most 25 words, or "",` : ""}
"sure": true only if you are certain of both counts}`, { images: tmp.map(b64), maxTokens: 400, tier: "quick", timeoutMs: 40000 });
  } catch (e) { console.warn("motion look:", e.message); return; }
  finally { for (const f of tmp) fs.unlink(f, () => {}); }
  if (!r || typeof r !== "object") return;
  const pp = Math.round(+r.photo_people), vp = Math.round(+r.video_people), sure = r.sure === true;
  if (sure && pp === 0) refuse(LOOK_MSG.photoNone);
  if (sure && pp > 1) refuse(LOOK_MSG.photoMany(pp));
  if (sure && vp === 0) refuse(LOOK_MSG.videoNone);
  if (sure && swap && vp > 1 && !target) refuse(LOOK_MSG.videoMany(vp));
  const en = String(r.note_en || "").trim().slice(0, 160), ar = String(r.note_ar || "").trim().slice(0, 160), person = ["clear", "hidden", "cut", "none"].includes(r.video_person) ? r.video_person : null;
  if (en || (person && person !== "clear")) body.meta = { ...(body.meta || {}), mcLook: { en, ar, person } };
  // v105: what the swap must keep exactly → listed in the engine's words (providers/kie.js swapWords)
  const keep = swap ? String(r.keep_en || "").replace(/[\r\n"]+/g, " ").trim().slice(0, 200) : "";
  if (keep) body.meta = { ...(body.meta || {}), mcKeep: keep };
}
// v104: the engine's video comes back silent — the person's own voice and the scene's sound (from the video the client gave) are
// put back under it; nothing changes when the result already has sound or the video had none.
// v105 swap (MiniMax H3 makes its own sound and at least 4 s): the result always gets the client's own sound (or none, like the
// video) and is cut to the video's length — the swap changes the person, nothing else
export async function keepSound(resultUrl, srcUrl, swap = false) {
  const src = srcUrl && (localPath(srcUrl) || (/^\/media\/[^/]+$/.test(srcUrl) ? path.join(MEDIA_DIR, path.basename(srcUrl)) : null));
  if (!src || !fs.existsSync(src)) return null;
  const s = await probe(src).catch(() => null); if (!s || (!s.audio && !swap)) return null;
  const res = localPath(resultUrl) || (await download(resultUrl)).file, r = await probe(res).catch(() => null); if (!r || (r.audio && !swap)) return null;
  const longer = swap && s.dur && r.dur > s.dur + 0.3;
  if (swap && !s.audio && !r.audio && !longer) return null;
  const t = longer ? s.dur : r.dur, name = uid() + "-snd.mp4", out = path.join(MEDIA_DIR, name);
  await run(FF(), ["-y", "-v", "error", "-i", res, ...(s.audio ? ["-i", src, "-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac", "-b:a", "160k"] : ["-map", "0:v:0", "-an"]), "-c:v", "copy",
    ...(t ? ["-t", String(t)] : ["-shortest"]), "-movflags", "+faststart", out], 120000);
  return fs.existsSync(out) && fs.statSync(out).size ? publicUrl(name) : null;
}
// v107: the person to replace, followed through the video. The client points at them — a tap on a frame of the video (the page
// sends that frame and where it was tapped) or a picture of them. The text AI finds the tapped person (a red box is drawn where the
// tap was) and the frame is cut to just them; then it looks at three frames of each part: is that person there, and where (the
// engine's words: "the man in the blue shirt, second from the left"). Refused before anything is charged, only when the AI is
// sure: several people and nobody pointed at, or the person pointed at in no part of the video. A part the person is surely not
// in is kept as it is (not sent, not charged). No text AI: every part is swapped and the picture goes to the engine as it is.
export const TRACE_MSG = {
  who: "The video shows several people — tap the person to replace in the video, or add a picture of them.",
  gone: "We can't find the person you picked anywhere in the video — tap them on a frame where they're clearly seen, or use a clearer picture of them.",
};
const words107 = (v, n = 140) => String(v || "").replace(/[\r\n"]+/g, " ").replace(/\s{2,}/g, " ").trim().replace(/[.\s]+$/, "").slice(0, n);
const frac = (b) => (Array.isArray(b) && b.length === 4 && b.every((v) => isFinite(+v)) ? b.map((v) => Math.min(1, Math.max(0, +v))) : null);
// the tapped frame → just that person (a JPEG of them) and what they look like
async function pickedPerson(file, tap) {
  const d = await probe(file).catch(() => null); if (!d || !d.w || !d.h) refuse("The picture of the person to replace can't be read — tap them again.");
  const W = d.w, H = d.h, s = Math.max(16, Math.round(Math.min(W, H) * 0.12)), t = Math.max(3, Math.round(Math.min(W, H) / 160)), tmp = path.join(os.tmpdir(), uid() + ".jpg");
  const bx = Math.round(Math.min(W - s, Math.max(0, tap[0] * W - s / 2))), by = Math.round(Math.min(H - s, Math.max(0, tap[1] * H - s / 2)));
  let b = null, who = "";
  try {
    if (llmConfigured()) {
      await run(FF(), ["-y", "-v", "error", "-i", file, "-vf", `scale='min(1024,iw)':-2,drawbox=x=${bx}*iw/${W}:y=${by}*ih/${H}:w=${s}*iw/${W}:h=${s}*ih/${H}:color=red@1:t=${t}`, "-q:v", "3", tmp], 30000);
      const r = await llmJson(`Image 1 is a frame from a video. A red box marks one person in it — the person to replace.
Return JSON: {"box": [left, top, right, bottom] — the whole visible body of the marked person (head to feet, or as much as is in the frame), as fractions from 0 to 1 of the picture's width and height,
"who_en": that person in at most 14 words (clothes, hair, build)}`, { images: [b64(tmp)], maxTokens: 300, tier: "quick", timeoutMs: 40000 }).catch((e) => { console.warn("swap pick:", e.message); return null; });
      const f = frac(r && r.box); if (f && f[2] - f[0] > 0.02 && f[3] - f[1] > 0.04 && tap[0] >= f[0] - 0.05 && tap[0] <= f[2] + 0.05) b = f;   // a box around the tap
      who = words107(r && r.who_en);
    }
  } finally { fs.unlink(tmp, () => {}); }
  if (!b) b = [tap[0] - 0.14, tap[1] - 0.45, tap[0] + 0.14, tap[1] + 0.45];   // no answer: a tall box around the tap
  const x0 = Math.max(0, b[0] - 0.03) * W, y0 = Math.max(0, b[1] - 0.03) * H, x1 = Math.min(1, b[2] + 0.03) * W, y1 = Math.min(1, b[3] + 0.03) * H;
  const cw = Math.max(16, Math.round(x1 - x0)) & ~1, ch = Math.max(16, Math.round(y1 - y0)) & ~1, name = uid() + "-who.jpg", out = path.join(MEDIA_DIR, name);
  await run(FF(), ["-y", "-v", "error", "-i", file, "-vf", `crop=${Math.min(cw, W)}:${Math.min(ch, H)}:${Math.round(Math.min(x0, W - cw))}:${Math.round(Math.min(y0, H - ch))}`, "-q:v", "2", out], 30000);
  return { url: publicUrl(name), file: out, who };
}
// three frames of one part (+ the picture of the person to replace) → {people, present, where_en, who_en, sure}, or null
async function partLook(part, target) {
  const tmp = [];
  try {
    if (target) { const p = path.join(os.tmpdir(), uid() + ".jpg"); await still(target, null, p, 640); tmp.push(p); }
    for (const f of [0.15, 0.5, 0.85]) { const o = path.join(os.tmpdir(), uid() + ".jpg"); try { await still(part.file, Math.max(0, part.dur * f), o, 640); tmp.push(o); } catch { /* fewer frames */ } }
    if (tmp.length < (target ? 2 : 1)) return null;
    const r = await llmJson(target ? `Image 1 shows one person — the person to replace in a video. The other images are frames from one part of that video.
Return JSON: {"people": the largest number of people visible in one of these frames,
"present": "yes" if the person from image 1 is in these frames, "no" if they are surely not, "unsure" otherwise,
"where_en": where that person is in these frames and what they wear, at most 16 words (e.g. "the man in the blue shirt, second from the left"), or "",
"who_en": the person in image 1 in at most 14 words,
"sure": true only if you are certain}` : `These images are frames from one part of a video.
Return JSON: {"people": the largest number of people visible in one frame, "sure": true only if you are certain of the count}`, { images: tmp.map(b64), maxTokens: 300, tier: "quick", timeoutMs: 40000 });
    return r && typeof r === "object" ? r : null;
  } catch (e) { console.warn("swap trace:", e.message); return null; }
  finally { for (const f of tmp) fs.unlink(f, () => {}); }
}
export async function traceSwap(body, parts) {
  const inp = body.inputs, t = body.meta?.whoTap, tap = Array.isArray(t) && t.length === 2 && t.every((v) => isFinite(+v) && +v >= 0 && +v <= 1) ? t.map(Number) : null;
  let target = null, who = "";
  if (inp.mcWho) {
    const f = await toLocal(inp.mcWho, "picture of the person to replace");
    if (tap) { const pk = await pickedPerson(f, tap); inp.mcWho = pk.url; target = pk.file; who = pk.who; }
    else { const ph = await prepPhoto(inp.mcWho); inp.mcWho = ph.url; target = ph.file; }
  }
  const looks = llmConfigured() && (target || parts.length > 1) ? await Promise.all(parts.map((p) => partLook(p, target))) : parts.map(() => null);
  if (!target && looks.some((r) => r && r.sure === true && Math.round(+r.people) > 1)) refuse(TRACE_MSG.who);
  if (target && looks.every((r) => r && r.sure === true && r.present === "no")) refuse(TRACE_MSG.gone);
  who = who || words107(looks.find((r) => r && r.who_en)?.who_en);
  const out = parts.map((p, i) => { const r = looks[i] || {};
    return { url: p.url, start: p.start, dur: Math.round(p.dur * 1000) / 1000, swap: !(target && r.sure === true && r.present === "no"), where: target ? words107(r.where_en) : "" }; });
  body.meta = { ...body.meta, ...(who ? { swapWho: who } : {}), ...(out.length > 1 ? { swapParts: out } : out[0].where ? { swapWhere: out[0].where } : {}) };
}
// the parts back into one video: the swapped ones (the engine's, each cut — or held on its last frame — to its part's length) and
// the ones kept as they were, at one size and 30 fps, with the client's own sound from start to end
export async function joinSwap(parts, soundUrl) {
  const loc = async (u) => localPath(u) || (/^\/media\/[^/]+$/.test(u) ? path.join(MEDIA_DIR, path.basename(u)) : (await download(u)).file), files = [];
  for (const p of parts) files.push(await loc(p.url));
  const k = Math.max(0, parts.findIndex((p) => p.swapped)), ri = await probe(files[k]); if (!ri) throw new Error("The swapped part can't be read");
  const W = ri.w - (ri.w % 2), H = ri.h - (ri.h % 2), snd = soundUrl ? await loc(soundUrl).catch(() => null) : null, si = snd && fs.existsSync(snd) ? await probe(snd).catch(() => null) : null;
  const total = parts.reduce((a, p) => a + p.dur, 0), name = uid() + "-swap.mp4", out = path.join(MEDIA_DIR, name);
  const fc = parts.map((p, i) => `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p,tpad=stop_mode=clone:stop_duration=5,trim=duration=${p.dur},setpts=PTS-STARTPTS[v${i}]`).join(";") +
    ";" + parts.map((_, i) => `[v${i}]`).join("") + `concat=n=${parts.length}:v=1:a=0[v]`;
  await run(FF(), ["-y", "-v", "error", ...files.flatMap((f) => ["-i", f]), ...(si && si.audio ? ["-i", snd] : []), "-filter_complex", fc, "-map", "[v]",
    ...(si && si.audio ? ["-map", `${files.length}:a:0`, "-c:a", "aac", "-b:a", "160k"] : ["-an"]), "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-t", String(total), "-movflags", "+faststart", out], 20 * 60000);
  if (!fs.existsSync(out) || !fs.statSync(out).size) throw new Error("The parts couldn't be joined");
  return publicUrl(name);
}
// called by createJob for Motion Control and Character Swap, after the duplicate check and before anything is charged
export async function prepMotion(body) {
  if (!/^mc(26|30|swap)$/.test(String(body.model || "")) || !body.inputs) return body;
  // v104: always the engine's best output, set here before the price is worked out, so the charge is what the page showed (the
  // page has no Quality choice): the moves at 1080p; v105: the swap on MiniMax H3 at 2K (its best; was 720p on the old engine)
  const swap = body.model === "mcswap";
  body.meta = { ...(body.meta || {}), res: swap ? "2K" : "1080p" };
  const inp = { ...body.inputs }; let vfile = null, pfile = null, vdur = 0, parts = null;
  // v107: the swap takes up to 2 minutes, in parts of up to 15 s (the whole video is looked at; its own sound is kept for the end)
  if (inp.mcMove && swap) { const v = await prepSwapVideo(inp.mcMove); parts = v.parts; vfile = v.src; vdur = v.info.dur;
    body.meta = { ...(body.meta || {}), swapSrc: inp.mcMove, mcVideo: { w: v.info.w, h: v.info.h, dur: Math.round(v.info.dur * 10) / 10, changed: v.changed, parts: parts.length } }; inp.mcMove = v.url; }
  else if (inp.mcMove) { const v = await prepVideo(inp.mcMove, 30); inp.mcMove = v.url; vfile = v.file; vdur = v.info.dur; body.meta = { ...(body.meta || {}), mcVideo: { w: v.info.w, h: v.info.h, dur: Math.round(v.info.dur * 10) / 10, changed: v.changed } };
  }   // (the price stays the one shown — it was worked out from this video's length)
  if (inp.mcChar) { const ph = await prepPhoto(inp.mcChar); inp.mcChar = ph.url; pfile = ph.file; }
  // v105: the swap's optional product photo (Image 2: the product must look exactly like it); the moves don't use one
  if (inp.mcProd && swap) inp.mcProd = (await prepPhoto(inp.mcProd)).url; else delete inp.mcProd;
  if (!swap) delete inp.mcWho;
  body.inputs = inp;
  await lookMotion(body, pfile, vfile, vdur, !!inp.mcWho);
  if (swap && parts) await traceSwap(body, parts);
  return body;
}
// the engine's own reason for a failed job, in plain words and without the engine's company name
export function engineReason(msg) {
  const s = String(msg || "").replace(/^Error:\s*/, "").replace(/\bKie\s*AI\b|\bkie\.ai\b|\bKie\b/gi, "").replace(/\s*\(\w*\d+\w*\)\s*$/, "").replace(/\(\s*[:·,-]?\s*\)/g, "").replace(/\s+([.,;:])/g, "$1").replace(/\s{2,}/g, " ").trim().replace(/^[\s:·,\-–—]+/, "");
  if (!s || /^(failed|task failed|internal error.*|an? (unknown|unexpected) error.*)$/i.test(s)) return "";
  return s.slice(0, 160);
}
