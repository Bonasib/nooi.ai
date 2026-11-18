// v187: the Download button opens a menu — the video (MP4), its sound (MP3, only when the video has a sound track) or a picture of
// one frame (PNG: the frame on screen, the first or the last). The page asks for a link (POST /v1/media/dl187, signed in), the link
// works for 10 minutes without the sign-in header (a phone opens it like any download), and the answer always comes as a file
// (Content-Disposition: attachment) with a readable name. Only files of this server's media folder; the work is done by ffmpeg here.
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { MEDIA_DIR, localPath } from "./media.js";

const FF = () => process.env.FFMPEG_PATH || "ffmpeg", FP = () => process.env.FFPROBE_PATH || "ffprobe";
const sig = (s) => crypto.createHmac("sha256", process.env.SECRET_KEY || "nooi").update("dl187:" + s).digest("hex").slice(0, 32);
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|mkv)$/i, AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/i, IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif)$/i;
// a /media/… address (or the full one) → the file here, or null
export function fileOf187(u) {
  let s = String(u || "").split("#")[0].split("?")[0]; if (!s) return null;
  if (!s.startsWith("/media/")) { const lp = localPath(s); if (!lp) { if (/^[\w.-]+$/.test(s)) s = "/media/" + s; else return null; } else s = "/media/" + path.basename(lp); }
  const name = path.basename(s); if (!/^[\w.-]+$/.test(name)) return null;
  const f = path.join(MEDIA_DIR, name); return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
}
function run(bin, args, ms = 60000) {
  return new Promise((resolve) => { const p = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] }); let o = "", e = "";
    const t = setTimeout(() => p.kill("SIGKILL"), ms); p.stdout.on("data", (d) => (o += d)); p.stderr.on("data", (d) => (e += d));
    p.on("close", (code) => { clearTimeout(t); resolve({ code, out: o, err: e }); }); p.on("error", () => { clearTimeout(t); resolve({ code: -1, out: "", err: "" }); }); });
}
// what is in the file: a picture, a sound track, its length
export async function probe187(f) {
  const r = await run(FP(), ["-v", "error", "-show_entries", "stream=codec_type:format=duration", "-of", "json", f], 20000);
  let d = {}; try { d = JSON.parse(r.out || "{}"); } catch {}
  const types = (d.streams || []).map((s) => s.codec_type), img = IMAGE_EXT.test(f);
  return { video: types.includes("video") && !img, audio: types.includes("audio"), image: img, dur: +((d.format || {}).duration) || 0 };
}
const cleanName = (n) => String(n || "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "nooi";
const asciiName = (n) => n.replace(/[^\x20-\x7e]+/g, "_").replace(/"/g, "'") || "nooi";

export function registerDownload187(app, requireUser) {
  // what the menu can offer for this file
  app.get("/v1/media/info187", requireUser, async (req, res) => {
    const f = fileOf187(req.query.u); if (!f) return res.status(404).json({ error: "This file isn't on the server.", errorAr: "هذا الملف ليس على الخادم." });
    const p = await probe187(f); res.json({ ...p, ext: path.extname(f).slice(1).toLowerCase() });
  });
  // a link for one download (10 minutes)
  app.post("/v1/media/dl187", requireUser, async (req, res) => {
    const b = req.body || {}, f = fileOf187(b.u), as = String(b.as || "file");
    if (!f) return res.status(404).json({ error: "This file isn't on the server.", errorAr: "هذا الملف ليس على الخادم." });
    if (!["file", "mp4", "mp3", "png"].includes(as)) return res.status(400).json({ error: "Unknown format" });
    if (as === "mp3") { const p = await probe187(f); if (!p.audio) return res.status(409).json({ error: "This video has no sound track.", errorAr: "هذا الفيديو بلا مسار صوت." }); }
    const t = b.t === "first" || b.t === "last" ? b.t : Number.isFinite(+b.t) && b.t !== "" && b.t != null ? String(Math.max(0, +b.t).toFixed(3)) : "";
    const q = new URLSearchParams({ u: path.basename(f), as, t, n: cleanName(b.name), e: String(Date.now() + 10 * 60e3) });
    q.set("s", sig(q.toString())); res.json({ href: "/v1/media/download187?" + q.toString() });
  });
  app.get("/v1/media/download187", async (req, res) => {
    const Q = req.query || {}, q = new URLSearchParams({ u: String(Q.u || ""), as: String(Q.as || ""), t: String(Q.t || ""), n: String(Q.n || ""), e: String(Q.e || "") });
    const good = Q.s && String(Q.s).length === 32 && crypto.timingSafeEqual(Buffer.from(sig(q.toString())), Buffer.from(String(Q.s)));
    if (!good || +Q.e < Date.now()) return res.status(403).json({ error: "This download link has expired — tap Download again.", errorAr: "انتهت صلاحية رابط التنزيل — اضغط «تنزيل» مرة أخرى." });
    const f = fileOf187(Q.u); if (!f) return res.status(404).json({ error: "This file isn't on the server." });
    const as = String(Q.as), base = cleanName(Q.n), ext = path.extname(f).slice(1).toLowerCase();
    const send = (name, type) => { res.setHeader("Content-Type", type); res.setHeader("Content-Disposition", `attachment; filename="${asciiName(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`); res.setHeader("Cache-Control", "no-store"); };
    const pipe = (args, name, type) => { const p = spawn(FF(), args, { stdio: ["ignore", "pipe", "ignore"] }); let sent = false;
      const t = setTimeout(() => p.kill("SIGKILL"), 180000);
      p.stdout.once("data", () => { sent = true; }); send(name, type); p.stdout.pipe(res);
      p.on("close", (code) => { clearTimeout(t); if (code && !sent && !res.headersSent) res.status(500).end(); else if (code && !res.writableEnded) res.end(); });
      p.on("error", () => { clearTimeout(t); if (!res.headersSent) res.status(500).end(); });
      req.on("close", () => { if (!res.writableEnded) p.kill("SIGKILL"); }); };
    if (as === "file" || (as === "mp4" && ext === "mp4")) {
      const type = VIDEO_EXT.test(f) ? "video/" + (ext === "mov" ? "quicktime" : ext === "m4v" ? "mp4" : ext) : AUDIO_EXT.test(f) ? "audio/" + (ext === "mp3" ? "mpeg" : ext) : "image/" + (ext === "jpg" ? "jpeg" : ext);
      send(base + "." + ext, type); res.setHeader("Content-Length", fs.statSync(f).size); return fs.createReadStream(f).pipe(res);
    }
    if (as === "mp4") return pipe(["-v", "error", "-i", f, "-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "frag_keyframe+empty_moov", "-f", "mp4", "pipe:1"], base + ".mp4", "video/mp4");
    if (as === "mp3") { const p = await probe187(f); if (!p.audio) return res.status(409).json({ error: "This video has no sound track." });
      return pipe(["-v", "error", "-i", f, "-vn", "-c:a", "libmp3lame", "-q:a", "2", "-f", "mp3", "pipe:1"], base + ".mp3", "audio/mpeg"); }
    if (as === "png") {
      if (IMAGE_EXT.test(f)) return pipe(["-v", "error", "-i", f, "-frames:v", "1", "-f", "image2pipe", "-c:v", "png", "pipe:1"], base + ".png", "image/png");
      const t = String(Q.t || "first"), tag = t === "last" ? "last" : t === "first" ? "first" : "frame";
      const seek = t === "last" ? ["-sseof", "-0.25"] : t === "first" ? [] : ["-ss", String(Math.max(0, +t || 0))];
      return pipe(["-v", "error", ...seek, "-i", f, "-frames:v", "1", "-update", "1", "-f", "image2pipe", "-c:v", "png", "pipe:1"], base + "-" + tag + ".png", "image/png");
    }
    res.status(400).json({ error: "Unknown format" });
  });
}
