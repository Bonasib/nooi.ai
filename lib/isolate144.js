// v144: "Isolate the voice" in the editor. The page sends the clip's file on this server and the part of it used on the timeline
// (from → to, in the file's own seconds). Before the job is priced, that part's sound is cut out as an mp3 here (the engine's voice
// isolation reads sound, not video), and its real length is what the job is priced on: per started minute.
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { uid } from "./store.js";
import { MEDIA_DIR, publicUrl, localPath } from "./media.js";
import { jobHooks } from "./jobs.js";

const FF = () => process.env.FFMPEG_PATH || "ffmpeg", FP = () => process.env.FFPROBE_PATH || "ffprobe";
const run = (bin, args, ms = 120000) => new Promise((ok, bad) => {
  const p = spawn(bin, args); let out = "", err = ""; const t = setTimeout(() => { try { p.kill("SIGKILL"); } catch {} bad(new Error(path.basename(bin) + " took too long")); }, ms);
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d)); p.on("error", (e) => { clearTimeout(t); bad(e); });
  p.on("close", (c) => { clearTimeout(t); c === 0 ? ok(out) : bad(new Error(path.basename(bin) + ": " + err.trim().split("\n").slice(-1)[0].slice(0, 200))); });
});
const refuse = (msg) => { throw Object.assign(new Error(msg), { code: 400 }); };
const MAX_SECS144 = 30 * 60;   // half an hour of sound at most in one job

// a /media file of this server (a relative or a full link), else null
const fileOf = (u) => { u = String(u || "").split("?")[0]; const f = /^\/media\/[^/]+$/.test(u) ? path.join(MEDIA_DIR, path.basename(u)) : localPath(u); return f && fs.existsSync(f) ? f : null; };
async function info(file) {
  const j = JSON.parse(await run(FP(), ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file], 30000));
  return { audio: (j.streams || []).some((s) => s.codec_type === "audio"), dur: +(j.format && j.format.duration) || 0 };
}

// the clip's sound from → to as an mp3 on this server; its length in seconds
export async function clipSound144(srcUrl, from, to) {
  const src = fileOf(srcUrl); if (!src) refuse("The clip isn't on the server any more — add it to the editor again.");
  const s = await info(src).catch(() => null); if (!s) refuse("This clip can't be read — save it as an MP4 and add it again.");
  if (!s.audio) refuse("This clip has no sound — there is no voice to keep.");
  const a = Math.max(0, +from || 0), b = Math.min(s.dur || Infinity, +to > a ? +to : s.dur || a + 1), len = Math.max(0.2, (isFinite(b) ? b : a + 1) - a);
  if (len > MAX_SECS144) refuse("This clip is longer than 30 minutes — split it and isolate each part.");
  const name = uid() + "-iso.mp3", out = path.join(MEDIA_DIR, name);
  await run(FF(), ["-y", "-v", "error", "-ss", a.toFixed(3), "-t", len.toFixed(3), "-i", src, "-vn", "-ac", "1", "-ar", "44100", "-b:a", "128k", out]);
  if (!fs.existsSync(out) || !fs.statSync(out).size) refuse("The clip's sound couldn't be read — try again.");
  return { url: publicUrl(name), secs: Math.round(len * 100) / 100 };
}

jobHooks.before.push(async (u, body) => {
  if (body.kind !== "isolate") return;
  const inp = (body.inputs = { ...(body.inputs || {}) }), m = (body.meta = { ...(body.meta || {}) });
  const src = inp.iso144 || inp.voice; if (!src) refuse("Pick a video clip with sound first.");
  const { url, secs } = await clipSound144(src, m.from, m.to);
  inp.voice = url; delete inp.iso144;
  m.secs144 = secs;   // (set here, never by the page: the price is per started minute of this)
  body.dur = Math.ceil(secs); body.prompt = "";
});
