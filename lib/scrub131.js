// v131: a light copy of a clip for dragging the editor's playhead. A phone jumps to a moment by decoding from the keyframe
// before it; videos from the engines often have one keyframe every few seconds, so each jump took long and the picture lagged
// behind the finger. The copy (≤ 640 px, no sound, a keyframe every 6 frames, no B-frames) lands any jump at once; the page
// shows it only while you drag and goes back to the clip itself when you let go.
//   POST /v1/media/scrub {url: "/media/…"} → {url: "/media/….scrub.mp4"}   (made once, then kept next to the clip)
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { MEDIA_DIR } from "./media.js";

const MAX_SEC = 15 * 60, RUNNING = new Map(), WAIT = [];
let busy = 0;
const slot = () => new Promise((ok) => { if (busy < 2) { busy++; ok(); } else WAIT.push(ok); });
const free = () => { const n = WAIT.shift(); if (n) n(); else busy--; };
const run = (bin, args, ms) => new Promise((ok, bad) => { const p = spawn(bin, args); let out = "", err = "";
  const t = setTimeout(() => { try { p.kill("SIGKILL"); } catch {} bad(new Error("timed out")); }, ms);
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err = (err + d).slice(-400)));
  p.on("error", (e) => { clearTimeout(t); bad(e); }); p.on("close", (c) => { clearTimeout(t); c === 0 ? ok(out) : bad(new Error(err.trim() || "exit " + c)); }); });

// the clip's file on this server, or null (only /media files: never a path the client makes up)
export function mediaFile131(url) {
  let p = String(url || "");
  try { if (/^https?:\/\//i.test(p)) { const u = new URL(p), base = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, ""); if (!base || !p.startsWith(base + "/media/")) return null; p = u.pathname; } } catch { return null; }
  const m = /^\/media\/([A-Za-z0-9._-]+)$/.exec(p.split(/[?#]/)[0]); if (!m || /\.scrub\.mp4$/.test(m[1])) return null;
  const f = path.join(MEDIA_DIR, m[1]); return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
}
export async function scrubCopy(src) {
  const name = path.basename(src).replace(/\.[^.]+$/, "") + ".scrub.mp4", out = path.join(MEDIA_DIR, name);
  if (fs.existsSync(out) && fs.statSync(out).size > 0) return "/media/" + name;
  if (RUNNING.has(out)) return RUNNING.get(out);
  const job = (async () => {
    await slot();
    try {
      let dur = 0; try { dur = +(await run(process.env.FFPROBE_PATH || "ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", src], 20000)) || 0; } catch {}
      if (dur > MAX_SEC) throw Object.assign(new Error("This clip is too long for a quick drag copy."), { code: 413 });
      const tmp = out + ".part.mp4";
      await run(process.env.FFMPEG_PATH || "ffmpeg", ["-y", "-v", "error", "-i", src, "-an", "-sn", "-vf", "scale='min(640,iw)':-2:flags=fast_bilinear", "-c:v", "libx264", "-preset", "veryfast",
        "-tune", "fastdecode", "-crf", "30", "-g", "6", "-keyint_min", "6", "-sc_threshold", "0", "-bf", "0", "-pix_fmt", "yuv420p", "-movflags", "+faststart", tmp], Math.max(60000, dur * 4000));
      fs.renameSync(tmp, out);
      return "/media/" + name;
    } finally { free(); RUNNING.delete(out); }
  })();
  RUNNING.set(out, job); return job;
}
// v135: the clip's film strip — small pictures of it (the longer side 320 px), up to 12 a second, in one picture (at most 3840 px
// a side, what every phone can draw). While the playhead is dragged the editor shows the strip's frame at once, with no jump of the
// video at all; when the finger stops the video itself goes there. (A jump of the light copy still waited for the one before, so on
// a phone the picture trailed the finger.)  POST /v1/media/sprite {url} → {url, fps, cols, w, h, n}
const SIDE = 320, SHEET = 3840;
export async function sprite135(src) {
  const base = path.basename(src).replace(/\.[^.]+$/, ""), meta = path.join(MEDIA_DIR, base + ".sprite.json"), out = path.join(MEDIA_DIR, base + ".sprite.jpg");
  try { if (fs.existsSync(meta) && fs.existsSync(out)) return JSON.parse(fs.readFileSync(meta, "utf8")); } catch {}
  if (RUNNING.has(meta)) return RUNNING.get(meta);
  const job = (async () => {
    await slot();
    try {
      const j = JSON.parse(await run(process.env.FFPROBE_PATH || "ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", src], 20000) || "{}");
      const st = (j.streams || [])[0] || {}, dur = +(j.format || {}).duration || 0, iw = +st.width || 16, ih = +st.height || 9;
      if (!dur || dur > MAX_SEC) throw Object.assign(new Error("This clip can't have a film strip."), { code: 413 });
      const w = iw >= ih ? SIDE : Math.max(2, Math.round((SIDE * iw) / ih / 2) * 2), h = iw >= ih ? Math.max(2, Math.round((SIDE * ih) / iw / 2) * 2) : SIDE;
      const cols = Math.floor(SHEET / w), cap = cols * Math.floor(SHEET / h), fps = Math.min(12, cap / dur), n = Math.max(1, Math.min(cap, Math.ceil(dur * fps))), rows = Math.ceil(n / cols);
      const tmp = out + ".part.jpg";
      await run(process.env.FFMPEG_PATH || "ffmpeg", ["-y", "-v", "error", "-i", src, "-an", "-sn", "-vf", `fps=${fps.toFixed(4)},scale=${w}:${h}:flags=bilinear,tile=${cols}x${rows}`, "-frames:v", "1", "-q:v", "6", tmp], Math.max(60000, dur * 3000));
      fs.renameSync(tmp, out);
      const r = { url: "/media/" + base + ".sprite.jpg", fps: Math.round(fps * 10000) / 10000, cols, w, h, n };
      fs.writeFileSync(meta, JSON.stringify(r)); return r;
    } finally { free(); RUNNING.delete(meta); }
  })();
  RUNNING.set(meta, job); return job;
}
export function registerScrub131(app, requireUser) {
  app.post("/v1/media/sprite", requireUser, async (req, res) => {
    const src = mediaFile131(req.body?.url);
    if (!src) return res.status(404).json({ error: "This clip isn't on the server.", errorAr: "هذا المقطع غير موجود على الخادم." });
    try { res.json(await sprite135(src)); }
    catch (e) { res.status(e.code || 500).json({ error: String(e.message || e).slice(0, 200) }); }
  });
  app.post("/v1/media/scrub", requireUser, async (req, res) => {
    const src = mediaFile131(req.body?.url);
    if (!src) return res.status(404).json({ error: "This clip isn't on the server.", errorAr: "هذا المقطع غير موجود على الخادم." });
    try { res.json({ url: await scrubCopy(src) }); }
    catch (e) { res.status(e.code || 500).json({ error: String(e.message || e).slice(0, 200) }); }
  });
}
