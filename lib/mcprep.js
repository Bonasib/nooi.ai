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
export async function prepVideo(url) {
  const src = await toLocal(url, "movement video"), info = await probe(src).catch(() => null);
  if (!info || !info.w || !info.h) refuse("This video can't be read — save it as an MP4 and add it again.");
  if (info.dur && info.dur < 2) refuse("The movement video is shorter than 2 seconds — use a video of 2 to 30 seconds.");
  const r = info.w / info.h; if (r > 3 || r < 1 / 3) refuse("The video is too wide or too tall — use a normal portrait, landscape or square video.");
  const ok = info.codec === "h264" && info.pix === "yuv420p" && !info.rot && Math.max(info.w, info.h) <= 1280 && info.fps <= 31 && info.dur <= 30.05 && info.size < 9.5 * MB && /\.mp4$/i.test(src);
  if (ok) return { url: publicUrl(path.basename(src)), file: src, info, changed: false };
  const name = uid() + "-mc.mp4", out = path.join(MEDIA_DIR, name), long = Math.min(1280, Math.max(info.w, info.h));
  // the long side ≤ 1280 (even sizes), upright (ffmpeg turns a tagged video upright itself), 30 fps at most, first 30 s
  // (v104: the engine's 10 MB is spent on picture quality — products, text and small details are drawn from this copy:
  // up to 12 Mb/s, at least visually lossless quality (CRF 17) when that fits, a careful encode)
  const sc = info.w >= info.h ? `scale=${long}:-2` : `scale=-2:${long}`, kbps = Math.max(1500, Math.min(12000, Math.floor((9 * 8 * 1024) / Math.min(30, info.dur || 30)) - 160));
  await run(FF(), ["-y", "-v", "error", "-i", src, "-t", "30", "-vf", `${sc},fps=fps='min(source_fps,30)',format=yuv420p`, "-c:v", "libx264", "-preset", "medium", "-profile:v", "high",
    "-crf", "17", "-maxrate", kbps + "k", "-bufsize", 2 * kbps + "k", "-movflags", "+faststart", ...(info.audio ? ["-c:a", "aac", "-b:a", "128k", "-ac", "2"] : ["-an"]), out]).catch(async () => {
    // an older ffmpeg without the fps expression: a plain 30 fps
    await run(FF(), ["-y", "-v", "error", "-i", src, "-t", "30", "-vf", `${sc},fps=30,format=yuv420p`, "-c:v", "libx264", "-preset", "veryfast", "-b:v", kbps + "k", "-maxrate", kbps + "k", "-bufsize", 2 * kbps + "k", "-movflags", "+faststart", ...(info.audio ? ["-c:a", "aac", "-b:a", "96k", "-ac", "2"] : ["-an"]), out]);
  });
  const after = await probe(out).catch(() => null);
  if (!after || fs.statSync(out).size >= 10 * MB) refuse("This video couldn't be made ready for the engine — try a shorter clip.");
  return { url: publicUrl(name), file: out, info: after, changed: true, from: info };
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
  videoMany: (n) => `The video shows ${n} people — the swap works with one person in the video.`,
};
export async function lookMotion(body, photo, video, dur) {
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
"note_ar": the same note in Arabic, or "",
"sure": true only if you are certain of both counts}`, { images: tmp.map(b64), maxTokens: 300, tier: "quick", timeoutMs: 40000 });
  } catch (e) { console.warn("motion look:", e.message); return; }
  finally { for (const f of tmp) fs.unlink(f, () => {}); }
  if (!r || typeof r !== "object") return;
  const pp = Math.round(+r.photo_people), vp = Math.round(+r.video_people), sure = r.sure === true;
  if (sure && pp === 0) refuse(LOOK_MSG.photoNone);
  if (sure && pp > 1) refuse(LOOK_MSG.photoMany(pp));
  if (sure && vp === 0) refuse(LOOK_MSG.videoNone);
  if (sure && swap && vp > 1) refuse(LOOK_MSG.videoMany(vp));
  const en = String(r.note_en || "").trim().slice(0, 160), ar = String(r.note_ar || "").trim().slice(0, 160), person = ["clear", "hidden", "cut", "none"].includes(r.video_person) ? r.video_person : null;
  if (en || (person && person !== "clear")) body.meta = { ...(body.meta || {}), mcLook: { en, ar, person } };
}
// v104: the engine's video comes back silent — the person's own voice and the scene's sound (from the video the client gave) are
// put back under it; nothing changes when the result already has sound or the video had none
export async function keepSound(resultUrl, srcUrl) {
  const src = srcUrl && (localPath(srcUrl) || (/^\/media\/[^/]+$/.test(srcUrl) ? path.join(MEDIA_DIR, path.basename(srcUrl)) : null));
  if (!src || !fs.existsSync(src)) return null;
  const s = await probe(src).catch(() => null); if (!s || !s.audio) return null;
  const res = localPath(resultUrl) || (await download(resultUrl)).file, r = await probe(res).catch(() => null); if (!r || r.audio) return null;
  const name = uid() + "-snd.mp4", out = path.join(MEDIA_DIR, name);
  await run(FF(), ["-y", "-v", "error", "-i", res, "-i", src, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", ...(r.dur ? ["-t", String(r.dur)] : ["-shortest"]), "-movflags", "+faststart", out], 120000);
  return fs.existsSync(out) && fs.statSync(out).size ? publicUrl(name) : null;
}
// called by createJob for Motion Control and Character Swap, after the duplicate check and before anything is charged
export async function prepMotion(body) {
  if (!/^mc(26|30|swap)$/.test(String(body.model || "")) || !body.inputs) return body;
  // v104: always the engine's best output — the swap at 720p (at 480p the engine failed: "Internal Error (500)"), the moves at
  // 1080p; set here, before the price is worked out, so the charge is what the page showed (the page has no Quality choice now)
  body.meta = { ...(body.meta || {}), res: body.model === "mcswap" ? "720p" : "1080p" };
  const inp = { ...body.inputs }; let vfile = null, pfile = null, vdur = 0;
  if (inp.mcMove) { const v = await prepVideo(inp.mcMove); inp.mcMove = v.url; vfile = v.file; vdur = v.info.dur; body.meta = { ...(body.meta || {}), mcVideo: { w: v.info.w, h: v.info.h, dur: Math.round(v.info.dur * 10) / 10, changed: v.changed } };
  }   // (the price stays the one shown — it was worked out from this video's length)
  if (inp.mcChar) { const ph = await prepPhoto(inp.mcChar); inp.mcChar = ph.url; pfile = ph.file; }
  body.inputs = inp;
  await lookMotion(body, pfile, vfile, vdur);
  return body;
}
// the engine's own reason for a failed job, in plain words and without the engine's company name
export function engineReason(msg) {
  const s = String(msg || "").replace(/^Error:\s*/, "").replace(/\bKie\s*AI\b|\bkie\.ai\b|\bKie\b/gi, "").replace(/\s*\(\w*\d+\w*\)\s*$/, "").replace(/\(\s*[:·,-]?\s*\)/g, "").replace(/\s+([.,;:])/g, "$1").replace(/\s{2,}/g, " ").trim().replace(/^[\s:·,\-–—]+/, "");
  if (!s || /^(failed|task failed|internal error.*|an? (unknown|unexpected) error.*)$/i.test(s)) return "";
  return s.slice(0, 160);
}
