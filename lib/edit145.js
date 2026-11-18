// v145: the editor's Reverse. The part of a clip used on the timeline (from → to, in the file's own seconds) played backwards —
// picture and sound — made here with ffmpeg, free. ffmpeg's reverse keeps every frame of what it reverses in memory, so the part
// is cut into short pieces, each piece is reversed, and the pieces are joined last-first (a minute of 1080p stays well under
// a gigabyte at a time). The result is the client's own clip (like /v1/clips140), so the editor uses it as any other clip.
//   POST /v1/edit145/reverse {url: "/media/…", from, to} → {id, kind: "video", url, title, dur}
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { user, uid, save } from "./store.js";
import { MEDIA_DIR, publicUrl } from "./media.js";
import { noteUpload } from "./account125.js";

const FF = () => process.env.FFMPEG_PATH || "ffmpeg", FP = () => process.env.FFPROBE_PATH || "ffprobe";
const MAX_SECS = 120, PIECE = 4;
const run = (bin, args, ms = 180000) => new Promise((ok, bad) => {
  const p = spawn(bin, args); let out = "", err = ""; const t = setTimeout(() => { try { p.kill("SIGKILL"); } catch {} bad(new Error(path.basename(bin) + " took too long")); }, ms);
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err = (err + d).slice(-600))); p.on("error", (e) => { clearTimeout(t); bad(e); });
  p.on("close", (c) => { clearTimeout(t); c === 0 ? ok(out) : bad(new Error(path.basename(bin) + ": " + err.trim().split("\n").slice(-1)[0].slice(0, 200))); });
});
const refuse = (msg, msgAr, code = 400) => { throw Object.assign(new Error(msg), { code, errorAr: msgAr }); };
let busy = 0; const WAIT = [];
const slot = () => new Promise((ok) => { if (busy < 1) { busy++; ok(); } else WAIT.push(ok); });
const free = () => { const n = WAIT.shift(); if (n) n(); else busy--; };

// the client's own file on this server (an upload of theirs, or one of their results), else null
export function ownFile(U, url) {
  let p = String(url || ""); const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
  if (base && p.startsWith(base)) p = p.slice(base.length);
  const m = /^\/media\/([A-Za-z0-9][A-Za-z0-9._-]{0,200})$/.exec(p.split(/[?#]/)[0]); if (!m) return null;
  const name = m[1], mine = (U.uploads || []).includes(name) || Object.values(U.jobs || {}).some((j) => String(j.url || "").split("?")[0].endsWith("/media/" + name));
  const f = path.join(MEDIA_DIR, name); return mine && fs.existsSync(f) ? f : null;
}
async function info(file) {
  const j = JSON.parse(await run(FP(), ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file], 30000));
  return { video: (j.streams || []).some((s) => s.codec_type === "video"), audio: (j.streams || []).some((s) => s.codec_type === "audio"), dur: +(j.format && j.format.duration) || 0 };
}

export async function reverse145(src, from, to) {
  const s = await info(src).catch(() => null);
  if (!s || !s.video) refuse("This clip can't be read — save it as an MP4 and add it again.", "تعذّرت قراءة هذا المقطع — احفظه بصيغة MP4 وأضفه مرة أخرى.");
  const a = Math.max(0, +from || 0), b = Math.min(s.dur || a + 1, +to > a ? +to : s.dur), len = b - a;
  if (!(len > 0.05)) refuse("This part of the clip is too short to reverse.", "هذا الجزء من المقطع أقصر من أن يُعكس.");
  if (len > MAX_SECS) refuse("Reverse works on up to 2 minutes — trim the clip first.", "العكس يعمل حتى دقيقتين — قصّ المقطع أولاً.");
  const id = uid(), parts = [], n = Math.ceil(len / PIECE - 1e-6), list = path.join(MEDIA_DIR, id + "-rev.txt");
  try {
    for (let k = 0; k < n; k++) {
      const p = path.join(MEDIA_DIR, id + "-rev" + k + ".mp4"), t0 = a + k * PIECE, d = Math.min(PIECE, b - t0);
      await run(FF(), ["-y", "-v", "error", "-ss", t0.toFixed(3), "-t", d.toFixed(3), "-i", src, "-vf", "scale='min(1920,iw)':-2,reverse", ...(s.audio ? ["-af", "areverse", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2"] : ["-an"]),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", "-r", "30", p]);
      parts.push(p);
    }
    fs.writeFileSync(list, parts.slice().reverse().map((p) => "file '" + p.replace(/'/g, "'\\''") + "'").join("\n"));
    const name = id + "-reversed.mp4", out = path.join(MEDIA_DIR, name);
    await run(FF(), ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", out]);
    const r = await info(out).catch(() => null); if (!r || !r.video) refuse("The reversed clip couldn't be made — try again.", "تعذّر صنع المقطع المعكوس — حاول مجدداً.", 500);
    return { name, url: publicUrl(name), dur: Math.round((r.dur || len) * 100) / 100 };
  } finally { for (const p of parts) fs.rm(p, { force: true }, () => {}); fs.rm(list, { force: true }, () => {}); }
}

export function registerEdit145(app, requireUser) {
  app.post("/v1/edit145/reverse", requireUser, async (req, res) => {
    const U = user(req.user.uid), b = req.body || {}, src = ownFile(U, b.url);
    if (!src) return res.status(404).json({ error: "Only a clip of yours on the server can be reversed — add it again.", errorAr: "يمكن عكس مقاطعك الموجودة على الخادم فقط — أضفه مرة أخرى." });
    await slot();
    try {
      const r = await reverse145(src, b.from, b.to); noteUpload(req.user.uid, r.name);
      const jid = uid(), title = (String(b.title || "My clip").slice(0, 70) + " · reversed");
      U.jobs[jid] = { id: jid, kind: "video", status: "done", progress: 1, url: r.url, title, created: Date.now(), payload: { prompt: "" }, clip140: true, dur: r.dur }; save();
      res.json({ id: jid, kind: "video", url: r.url, title, dur: r.dur });
    } catch (e) { res.status(e.code || 500).json({ error: String(e.message || e).slice(0, 200), errorAr: e.errorAr }); }
    finally { free(); }
  });
}
