// v196: proxies for heavy footage. A 4K or 1080p clip is slow to scrub on a phone, so the editor asks for a light copy (540 px tall,
// VP9 + Opus, made here with ffmpeg, free) and previews with it; the export always reads the original. One proxy at a time;
// the copy is the customer's own file (deleted with the account), named after the source so asking twice costs nothing.
//   POST /v1/edit/proxy196 {url: "/media/…"} → {status: "done", url} | {status: "busy"} | {status: "small"} (540 px or less already)
//   GET  /v1/edit/proxy196?url=…             → {status: "done" | "busy" | "failed" | "small" | "none", url?, error?}
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { user } from "./store.js";
import { MEDIA_DIR } from "./media.js";
import { noteUpload } from "./account125.js";
import { ownFile } from "./edit145.js";

const FF = () => process.env.FFMPEG_PATH || "ffmpeg", FP = () => process.env.FFPROBE_PATH || "ffprobe";
const JOBS = new Map();   // proxy file name → {status, at, error}
let busy = 0; const WAIT = [];
const slot = () => new Promise((ok) => { if (busy < 1) { busy++; ok(); } else WAIT.push(ok); });
const free = () => { const n = WAIT.shift(); if (n) n(); else busy--; };
const run = (bin, args, ms) => new Promise((ok, bad) => {
  const p = spawn(bin, args); let out = "", err = ""; const t = setTimeout(() => { try { p.kill("SIGKILL"); } catch {} bad(new Error(path.basename(bin) + " took too long")); }, ms);
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err = (err + d).slice(-600))); p.on("error", (e) => { clearTimeout(t); bad(e); });
  p.on("close", (c) => { clearTimeout(t); c === 0 ? ok(out) : bad(new Error(path.basename(bin) + ": " + err.trim().split("\n").slice(-1)[0].slice(0, 200))); });
});
async function probe(file) {
  const j = JSON.parse(await run(FP(), ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file], 30000));
  const v = (j.streams || []).find((s) => s.codec_type === "video");
  return { w: v ? +v.width || 0 : 0, h: v ? +v.height || 0 : 0, audio: (j.streams || []).some((s) => s.codec_type === "audio"), dur: +(j.format && j.format.duration) || 0 };
}
const bad = (en, ar, code = 400) => Object.assign(new Error(en), { code, errorAr: ar });
const outName = (src) => path.basename(src).replace(/\.[^.]+$/, "") + "-px196.webm";
export const PROXY_H = 540;

function state(uidv, url) {
  const f = ownFile(user(uidv), url); if (!f) return { status: "none" };
  const o = outName(f), of = path.join(MEDIA_DIR, o), j = JOBS.get(o);
  if (j && j.status !== "done") return { status: j.status, ...(j.error ? { error: j.error } : {}) };
  return fs.existsSync(of) ? { status: "done", url: "/media/" + o } : { status: "none" };
}
function make(uidv, url) {
  const f = ownFile(user(uidv), url); if (!f) throw bad("That clip isn't one of your files on this server.", "هذا المقطع ليس من ملفاتك على هذا الخادم.", 404);
  const o = outName(f), of = path.join(MEDIA_DIR, o), j = JOBS.get(o);
  if (fs.existsSync(of) && !(j && j.status === "busy")) return { status: "done", url: "/media/" + o };
  if (j && (j.status === "busy" || j.status === "small")) return { status: j.status };
  JOBS.set(o, { status: "busy", at: Date.now() });
  (async () => {
    await slot();
    try {
      const info = await probe(f); if (!info.w || !info.h) throw new Error("not a video");
      if (info.h <= PROXY_H && info.w <= PROXY_H * 16 / 9 + 2) { JOBS.set(o, { status: "small", at: Date.now() }); return; }
      const tmp = of + ".tmp.webm";
      await run(FF(), ["-v", "error", "-y", "-i", f, "-vf", "scale=-2:" + PROXY_H, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-cpu-used", "8", "-deadline", "realtime", "-row-mt", "1", "-threads", "4", "-g", "48",
        ...(info.audio ? ["-c:a", "libopus", "-b:a", "64k", "-ac", "2"] : ["-an"]), "-f", "webm", tmp], Math.max(300000, Math.min(1800000, info.dur * 20000)));
      fs.renameSync(tmp, of); noteUpload(uidv, o); JOBS.set(o, { status: "done", at: Date.now() });
    } catch (e) { try { fs.unlinkSync(of + ".tmp.webm"); } catch {} JOBS.set(o, { status: "failed", at: Date.now(), error: String(e.message || e).slice(0, 200) }); }
    finally { free(); }
  })();
  return { status: "busy" };
}
export function registerProxy196(app, requireUser) {
  const wrap = (fn) => (req, res) => { try { res.json(fn(req)); } catch (e) { res.status(e.code >= 400 && e.code < 600 ? e.code : 500).json({ error: e.message, ...(e.errorAr ? { errorAr: e.errorAr } : {}) }); } };
  app.post("/v1/edit/proxy196", requireUser, wrap((req) => make(req.user.uid, String((req.body && req.body.url) || ""))));
  app.get("/v1/edit/proxy196", requireUser, wrap((req) => state(req.user.uid, String(req.query.url || ""))));
}
