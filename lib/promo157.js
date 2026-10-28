// v157: a promo from a picture and a word. The engines can't be trusted with a word (Arabic letters come out as shapes, Latin
// ones misspelled), so the engine makes the cinematic film with no writing on it and the word — exactly as typed, drawn on the
// customer's page where Arabic is shaped right (a transparent PNG at the film's shape) — is laid over the film's last seconds:
// the picture darkens a little and the word fades in. In place, before the "Made with AI" mark and the content credentials.
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { MEDIA_DIR } from "./media.js";
import { uid } from "./store.js";

const fileOf = (url) => { const m = /^(?:https?:\/\/[^/]+)?\/media\/([A-Za-z0-9][A-Za-z0-9._-]{0,200})(?:[?#]|$)/.exec(String(url || "")); if (!m) return null;
  const f = path.join(MEDIA_DIR, path.basename(m[1])); return fs.existsSync(f) ? f : null; };
const run = (bin, args, ms, out) => new Promise((ok, no) => { const p = spawn(bin, args); let o = "", err = ""; const t = setTimeout(() => p.kill("SIGKILL"), ms);
  p.stdout.on("data", (d) => (o += d)); p.stderr.on("data", (d) => (err = (err + d).slice(-400))); p.on("error", (e) => { clearTimeout(t); no(e); });
  p.on("close", (c) => { clearTimeout(t); c === 0 ? ok(out ? o : null) : no(new Error(path.basename(bin) + " " + c + " " + err.trim())); }); });
async function probe(file) {
  const j = JSON.parse(await run(process.env.FFPROBE_PATH || "ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", file], 30000, true));
  const s = (j.streams || [])[0] || {}; return { w: +s.width || 0, h: +s.height || 0, dur: +(j.format || {}).duration || 0 };
}
// the title's time: the last 40 % of the film, 0.8–3 s
export const titleSpan157 = (dur) => { const T = Math.max(0.8, Math.min(3, dur * 0.4)); return { t0: Math.max(0, +(dur - T).toFixed(2)), T }; };
export async function title157(job, url) {
  const t = job?.payload?.meta?.title157, file = fileOf(url); if (!t || !file || job.parent || !/\.(mp4|mov|m4v)$/i.test(file)) return false;
  const png = fileOf(t.url); if (!png || !/\.png$/i.test(png)) return false;
  const d = await probe(file); if (!d.w || !d.h || !d.dur) return false;
  const { t0 } = titleSpan157(d.dur), W = d.w - (d.w % 2), H = d.h - (d.h % 2), tmp = path.join(path.dirname(file), "." + uid() + path.extname(file));
  const fc = `[1:v]format=rgba,scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black@0,fade=t=in:st=${t0}:d=0.7:alpha=1[t];` +
    `[0:v]scale=${W}:${H},drawbox=x=0:y=0:w=iw:h=ih:color=black@0.35:t=fill:enable='gte(t,${t0})'[b];[b][t]overlay=0:0:shortest=1,format=yuv420p[v]`;
  try {
    await run(process.env.FFMPEG_PATH || "ffmpeg", ["-y", "-v", "error", "-i", file, "-loop", "1", "-t", (d.dur + 0.1).toFixed(2), "-i", png, "-filter_complex", fc, "-map", "[v]", "-map", "0:a?", "-c:a", "copy",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-movflags", "+faststart", "-t", d.dur.toFixed(3), tmp], 20 * 60000);
    await fs.promises.rename(tmp, file); job.title157 = { word: String(t.word || "").slice(0, 60), at: t0 }; return true;
  } finally { fs.unlink(tmp, () => {}); }
}
