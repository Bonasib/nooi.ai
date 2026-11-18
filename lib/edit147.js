// v147: the editor's Stabilise. The part of a clip used on the timeline (from → to, in the file's own seconds) with the camera
// shake taken out — made here with ffmpeg, free. Two passes of vid.stab (the motion of each frame measured, then the frames moved
// back along a smoothed path, with the least zoom that hides the moving edges); an ffmpeg without vid.stab uses its own deshake
// filter and a small zoom. The result is the client's own clip (like /v1/clips140 and Reverse), so the editor uses it as any clip.
//   POST /v1/edit147/stabilise {url: "/media/…", from, to, strength: 1–3, title} → {id, kind: "video", url, title, dur}
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { user, uid, save } from "./store.js";
import { MEDIA_DIR, publicUrl } from "./media.js";
import { noteUpload } from "./account125.js";
import { ownFile } from "./edit145.js";

const FF = () => process.env.FFMPEG_PATH || "ffmpeg", FP = () => process.env.FFPROBE_PATH || "ffprobe";
const MAX_SECS = 180;
const run = (bin, args, ms = 600000) => new Promise((ok, bad) => {
  const p = spawn(bin, args); let out = "", err = ""; const t = setTimeout(() => { try { p.kill("SIGKILL"); } catch {} bad(new Error(path.basename(bin) + " took too long")); }, ms);
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err = (err + d).slice(-4000))); p.on("error", (e) => { clearTimeout(t); bad(e); });
  p.on("close", (c) => { clearTimeout(t); c === 0 ? ok(out + err) : bad(new Error(path.basename(bin) + ": " + err.trim().split("\n").slice(-1)[0].slice(0, 200))); });
});
const refuse = (msg, msgAr, code = 400) => { throw Object.assign(new Error(msg), { code, errorAr: msgAr }); };
let busy = 0; const WAIT = [];
const slot = () => new Promise((ok) => { if (busy < 1) { busy++; ok(); } else WAIT.push(ok); });
const free = () => { const n = WAIT.shift(); if (n) n(); else busy--; };
let VIDSTAB = null;   // (does this ffmpeg have vid.stab? asked once)
async function hasVidstab() { if (VIDSTAB == null) { try { VIDSTAB = /vidstabdetect/.test(await run(FF(), ["-hide_banner", "-filters"], 20000)); } catch { VIDSTAB = false; } } return VIDSTAB; }
async function info(file) {
  const j = JSON.parse(await run(FP(), ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file], 30000));
  return { video: (j.streams || []).some((s) => s.codec_type === "video"), audio: (j.streams || []).some((s) => s.codec_type === "audio"), dur: +(j.format && j.format.duration) || 0 };
}

export async function stabilise147(src, from, to, strength) {
  const s = await info(src).catch(() => null);
  if (!s || !s.video) refuse("This clip can't be read — save it as an MP4 and add it again.", "تعذّرت قراءة هذا المقطع — احفظه بصيغة MP4 وأضفه مرة أخرى.");
  const a = Math.max(0, +from || 0), b = Math.min(s.dur || a + 1, +to > a ? +to : s.dur), len = b - a;
  if (!(len > 0.3)) refuse("This part of the clip is too short to steady.", "هذا الجزء من المقطع أقصر من أن يُثبَّت.");
  if (len > MAX_SECS) refuse("Stabilise works on up to 3 minutes — trim the clip first.", "التثبيت يعمل حتى 3 دقائق — قصّ المقطع أولاً.");
  const k = Math.max(1, Math.min(3, Math.round(+strength || 2))), id = uid(), trf = path.join(MEDIA_DIR, id + "-stab.trf"), name = id + "-steady.mp4", out = path.join(MEDIA_DIR, name);
  const cut = ["-ss", a.toFixed(3), "-t", len.toFixed(3), "-i", src], scale = "scale='min(1920,iw)':-2,format=yuv420p";   // (vid.stab reads planar YUV only — some files decode as RGB or 10-bit)
  const enc = [...(s.audio ? ["-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2"] : ["-an"]), "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out];
  try {
    if (await hasVidstab()) {
      await run(FF(), ["-y", "-v", "error", ...cut, "-vf", scale + ",vidstabdetect=shakiness=" + (3 + k * 2) + ":accuracy=15:result=" + trf, "-f", "null", "-"]);
      await run(FF(), ["-y", "-v", "error", ...cut, "-vf", scale + ",vidstabtransform=input=" + trf + ":smoothing=" + [0, 15, 30, 60][k] + ":optzoom=1:interpol=bicubic,unsharp=5:5:0.5:3:3:0.25", ...enc]);
    } else {
      const z = [0, 0.04, 0.06, 0.09][k];
      await run(FF(), ["-y", "-v", "error", ...cut, "-vf", scale + ",deshake=rx=" + (16 * k + 16) + ":ry=" + (16 * k + 16) + ",crop=iw*" + (1 - z).toFixed(2) + ":ih*" + (1 - z).toFixed(2) + ",scale=trunc(iw/" + (1 - z).toFixed(2) + "/2)*2:-2", ...enc]);
    }
    const r = await info(out).catch(() => null); if (!r || !r.video) refuse("The steady clip couldn't be made — try again.", "تعذّر صنع المقطع الثابت — حاول مجدداً.", 500);
    return { name, url: publicUrl(name), dur: Math.round((r.dur || len) * 100) / 100, how: VIDSTAB ? "vidstab" : "deshake" };
  } finally { fs.rm(trf, { force: true }, () => {}); }
}

export function registerEdit147(app, requireUser) {
  app.post("/v1/edit147/stabilise", requireUser, async (req, res) => {
    const U = user(req.user.uid), b = req.body || {}, src = ownFile(U, b.url);
    if (!src) return res.status(404).json({ error: "Only a clip of yours on the server can be steadied — add it again.", errorAr: "يمكن تثبيت مقاطعك الموجودة على الخادم فقط — أضفه مرة أخرى." });
    await slot();
    try {
      const r = await stabilise147(src, b.from, b.to, b.strength); noteUpload(req.user.uid, r.name);
      const jid = uid(), title = (String(b.title || "My clip").slice(0, 70) + " · steady");
      U.jobs[jid] = { id: jid, kind: "video", status: "done", progress: 1, url: r.url, title, created: Date.now(), payload: { prompt: "" }, clip140: true, dur: r.dur }; save();
      res.json({ id: jid, kind: "video", url: r.url, title, dur: r.dur, how: r.how });
    } catch (e) {
      // (a failure of ffmpeg itself is said plainly: this tool is free, nothing was charged)
      if (!e.code) { console.error("stabilise:", String(e.message || e).slice(0, 300)); return res.status(422).json({ error: "This clip couldn't be steadied — try again, or trim it first.", errorAr: "تعذّر تثبيت هذا المقطع — حاول مجدداً أو قصّه أولاً." }); }
      res.status(e.code).json({ error: String(e.message || e).slice(0, 200), errorAr: e.errorAr });
    }
    finally { free(); }
  });
}
