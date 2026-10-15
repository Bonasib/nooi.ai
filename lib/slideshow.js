// A video from your pictures, made on our own server with ffmpeg (no engine, no credits): each picture moves gently
// (zoom in, a slow pan or still), with a caption the page drew (so Arabic letters join correctly), joined by fades or slides,
// with optional music faded out at the end. Pictures and music must be files of this site (/media/…).
// POST /v1/render/slideshow → a job (kind "slideshow") the page follows like any other.
import fs from "fs"; import path from "path"; import os from "os"; import { spawn } from "child_process";
import { user, save, uid } from "./store.js";
import { MEDIA_DIR, publicUrl } from "./media.js";
const SIZE = { "9:16": [720, 1280], "16:9": [1280, 720], "1:1": [960, 960] }, FPS = 30, T = 0.6;
const busy = new Set();
// a /media/… address (relative, or with our public address in front) → the file on disk
function mediaFile(u) {
  const s = String(u || ""), base = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, ""); let rel = null;
  if (s.startsWith("/media/")) rel = s.slice(7); else if (base && s.startsWith(base + "/media/")) rel = s.slice(base.length + 7);
  if (!rel || /[\\/]|\.\./.test(rel.split("?")[0])) return null;
  const f = path.join(MEDIA_DIR, rel.split("?")[0]); return fs.existsSync(f) ? f : null;
}
export function plan(b) {
  const pics = (Array.isArray(b.pictures) ? b.pictures : []).slice(0, 12), [W, H] = SIZE[b.aspect] || SIZE["9:16"], D = Math.max(2, Math.min(6, +b.secs || 3));
  const motion = ["zoom", "pan", "still"].includes(b.motion) ? b.motion : "zoom", tr = ["fade", "slide", "none"].includes(b.transition) ? b.transition : "fade";
  if (pics.length < 2) throw Object.assign(new Error("Add at least two pictures."), { code: 400 });
  const files = pics.map((p) => mediaFile(p && p.url)); if (files.some((f) => !f)) throw Object.assign(new Error("A picture you added is no longer on the server — add it again."), { code: 400 });
  const music = b.music ? mediaFile(b.music) : null; if (b.music && !music) throw Object.assign(new Error("The music file is no longer on the server — add it again."), { code: 400 });
  const caps = pics.map((p) => { const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String((p && p.caption) || "")); return m && m[1].length < 3e6 ? Buffer.from(m[1], "base64") : null; });
  const total = +(pics.length * D - (tr === "none" ? 0 : (pics.length - 1) * T)).toFixed(2);
  return { files, caps, music, W, H, D, motion, tr, total };
}
// the ffmpeg arguments for a plan (captions as PNG files already written to capFiles[i])
export function args(p, capFiles, out) {
  const a = ["-y", "-v", "error"], f = [], frames = Math.round(p.D * FPS);
  p.files.forEach((file) => a.push("-i", file));
  capFiles.forEach((c) => { if (c) a.push("-i", c); });
  if (p.music) a.push("-i", p.music);
  let ci = p.files.length;
  p.files.forEach((_, i) => {
    const big = `scale=${p.W * 2}:${p.H * 2}:force_original_aspect_ratio=increase,crop=${p.W * 2}:${p.H * 2}`;
    const z = p.motion === "still" ? "1" : p.motion === "pan" ? "1.12" : "min(1+0.12*on/" + frames + ",1.12)";
    const x = p.motion === "pan" ? `(iw-iw/zoom)*${i % 2 ? "(1-on/" + frames + ")" : "on/" + frames}` : "iw/2-(iw/zoom/2)";
    f.push(`[${i}:v]${big},zoompan=z='${z}':x='${x}':y='ih/2-(ih/zoom/2)':d=${frames}:s=${p.W}x${p.H}:fps=${FPS},setsar=1,format=yuv420p[p${i}]`);
    if (capFiles[i]) { f.push(`[${ci}:v]scale=${p.W}:${p.H},format=rgba[c${i}]`, `[p${i}][c${i}]overlay=0:0:format=auto,format=yuv420p[v${i}]`); ci++; } else f.push(`[p${i}]null[v${i}]`);
  });
  if (p.tr === "none") f.push(p.files.map((_, i) => `[v${i}]`).join("") + `concat=n=${p.files.length}:v=1:a=0[vout]`);
  else { let last = "v0"; for (let i = 1; i < p.files.length; i++) { const off = +(i * (p.D - T)).toFixed(3), lab = i === p.files.length - 1 ? "vout" : "x" + i;
    f.push(`[${last}][v${i}]xfade=transition=${p.tr === "slide" ? "slideleft" : "fade"}:duration=${T}:offset=${off}[${lab}]`); last = lab; } }
  if (p.music) f.push(`[${ci}:a]atrim=0:${p.total},afade=t=out:st=${Math.max(0, p.total - 1.2)}:d=1.2,asetpts=PTS-STARTPTS[aout]`);
  a.push("-filter_complex", f.join(";"), "-map", "[vout]"); if (p.music) a.push("-map", "[aout]", "-c:a", "aac", "-b:a", "160k");
  a.push("-t", String(p.total), "-r", String(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out);
  return a;
}
const run = (a) => new Promise((res, rej) => { const p = spawn(process.env.FFMPEG_PATH || "ffmpeg", a); let err = ""; p.stderr.on("data", (d) => { err = (err + d).slice(-800); });
  const t = setTimeout(() => p.kill("SIGKILL"), 5 * 60e3); p.on("error", rej); p.on("close", (c) => { clearTimeout(t); c === 0 ? res() : rej(new Error("ffmpeg " + c + ": " + err.slice(-300))); }); });
export function registerSlideshow(app, requireUser) {
  app.post("/v1/render/slideshow", requireUser, async (req, res) => {
    const uidv = req.user.uid; let p;
    try { p = plan(req.body || {}); } catch (e) { return res.status(e.code || 400).json({ error: e.message }); }
    if (busy.has(uidv)) return res.status(429).json({ error: "Your last video from pictures is still being made — wait for it to finish." });
    const id = uid(), U = user(uidv); U.jobs = U.jobs || {};
    const job = U.jobs[id] = { id, kind: "slideshow", status: "rendering", progress: 0.1, created: Date.now(), cost: 0, title: String(req.body.title || "").slice(0, 80) || "Video from pictures", payload: { kind: "slideshow", dur: p.total, aspect: req.body.aspect || "9:16" }, sent: { pictures: p.files.length, duration: p.total, transition: p.tr, motion: p.motion } };
    save(); busy.add(uidv); res.json({ id, status: "rendering", kind: "slideshow", progress: 0.1, cost: 0, dur: p.total });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-show-")), name = uid() + ".mp4", out = path.join(MEDIA_DIR, name);
    try { const capFiles = p.caps.map((b, i) => { if (!b) return null; const f = path.join(tmp, "cap" + i + ".png"); fs.writeFileSync(f, b); return f; });
      await run(args(p, capFiles, out)); job.url = publicUrl(name); job.status = "done"; job.progress = 1; }
    catch (e) { job.status = "failed"; job.error = "The video couldn't be made from these pictures — try other pictures."; job.errorDetail = String(e.message || e).slice(0, 300); console.warn("slideshow:", job.errorDetail); }
    finally { busy.delete(uidv); fs.rm(tmp, { recursive: true, force: true }, () => {}); save(); }
  });
}
