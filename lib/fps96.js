// v96: 60 and 120 fps on the Video page were charged (+2 / +4 cr) but no engine makes them — every engine makes 24–30 fps —
// so the client got the usual video. A finished video asked for at 50 fps or more now gets its in-between frames made here
// before it is shown (motion-compensated interpolation: ffmpeg minterpolate), one video at a time since it is heavy work.
// If it can't be done in time, the video comes as the engine made it and the extra for the frame rate is refunded.
// The "120 fps" button under a video (a Finish job, tool "interp") had no engine at all ("This engine isn't available") —
// it now uses the same smoothing (fpsAdapter), on a video that is on this server.
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { uid } from "./store.js";
import { MEDIA_DIR, publicUrl, localPath, download } from "./media.js";

export const FPS_EXTRA = { 60: 2, 120: 4 };
const FF = () => process.env.FFMPEG_PATH || "ffmpeg";
const run = (args, ms) => new Promise((ok, bad) => {
  const p = spawn(FF(), args); let err = ""; const t = setTimeout(() => { try { p.kill("SIGKILL"); } catch {} bad(new Error("took too long")); }, ms);
  p.stderr.on("data", (d) => (err = (err + d).slice(-2000))); p.on("error", (e) => { clearTimeout(t); bad(e); });
  p.on("close", (c) => { clearTimeout(t); c === 0 ? ok() : bad(new Error("ffmpeg: " + err.trim().split("\n").slice(-1)[0].slice(0, 200))); });
});
let line = Promise.resolve();
export function smoothFps(url, fps) { const job = line.then(() => smooth(url, fps)); line = job.catch(() => {}); return job; }
const onServer = (u) => { const s = String(u || "").split("?")[0], loc = /^\/media\/[^/]+$/.test(s) ? path.join(MEDIA_DIR, path.basename(s)) : localPath(s); return loc && fs.existsSync(loc) ? loc : null; };
// v119: ffmpeg's frame maker (minterpolate) works on one processor core only — 86 s for 5 s of 720p on a 2-core server, and
// the same on 4 cores. So the video is cut into as many pieces as the server has cores, the pieces are made side by side,
// then joined with the video's own sound: about 2× faster on 2 cores, 4× on 4 (and a bigger server now helps). Each piece
// but the last reads 0.4 s past its end so its last in-between frames have a next frame, then is cut back to its exact length.
const LOOK = 0.4, MAKE = (fps) => `minterpolate=fps=${fps}:mi_mode=mci:mc_mode=obmc:me_mode=bilat`, X264 = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18"];
export const smoothParts = (dur) => { const cores = +process.env.SMOOTH_PARTS || (os.availableParallelism ? os.availableParallelism() : os.cpus().length) || 1;
  return Math.max(1, Math.min(cores, 16, Math.floor((+dur || 0) / 1.5))); };   // (pieces of at least 1.5 s)
const lengthOf = (src) => new Promise((ok) => { const p = spawn(process.env.FFPROBE_PATH || "ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]); let o = "";
  p.stdout.on("data", (d) => (o += d)); p.on("error", () => ok(0)); p.on("close", () => ok(+o.trim() || 0)); });
async function smooth(url, fps) {
  const src = onServer(url) || (await download(url, null, { tries: 2, timeoutMs: 120000 })).file;
  const name = uid() + "-" + fps + "fps.mp4", out = path.join(MEDIA_DIR, name);
  const ms = (+process.env.FPS_SMOOTH_MINUTES || 20) * 60e3, dur = await lengthOf(src), n = smoothParts(dur);
  if (n < 2) {
    await run(["-y", "-v", "error", "-i", src, "-vf", `${MAKE(fps)},format=yuv420p`, ...X264, "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out], ms).catch((e) => { try { fs.unlinkSync(out); } catch {} throw e; });
    return publicUrl(name);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-fps-")), len = dur / n, parts = [];
  try {
    await Promise.all(Array.from({ length: n }, (_, i) => { const f = path.join(dir, "p" + i + ".mp4"), last = i === n - 1; parts.push(f);
      return run(["-y", "-v", "error", "-ss", (i * len).toFixed(3), ...(last ? [] : ["-t", (len + LOOK).toFixed(3)]), "-i", src, "-an",
        "-vf", `${MAKE(fps)},${last ? "" : `trim=duration=${len.toFixed(3)},setpts=PTS-STARTPTS,`}format=yuv420p`, ...X264, f], ms); }));
    const list = path.join(dir, "list.txt"); fs.writeFileSync(list, parts.map((f) => "file '" + f + "'").join("\n"));
    await run(["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-i", src, "-map", "0:v:0", "-map", "1:a:0?", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out], ms);
  } catch (e) { try { fs.unlinkSync(out); } catch {} throw e; }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return publicUrl(name);
}
// the "120 fps" button: a Finish job (tool "interp") on one of the client's videos on this server
export const fpsAdapter = () => ({
  name: "Smooth motion", configured: true,
  async submit(p) {
    const src = [p.inputs?.fin, p.meta?.sourceUrl].find((u) => onServer(u));
    if (!src) throw Object.assign(new Error("This video isn't on the server yet — try again in a minute."), { type: "input", noFallback: true, userMsg: "This video isn't on the server yet — try again in a minute. Nothing was charged." });
    const fps = +p.meta?.fps === 60 ? 60 : 120;
    const url = await smoothFps(src, fps).catch((e) => { throw Object.assign(e, { type: "input", retryable: false, noFallback: true, userMsg: "The smooth version couldn't be made — nothing was charged." }); });
    return { done: true, url, sent: { tool: "smooth motion", fps } };
  },
  async poll() { return { status: "rendering" }; },
});
