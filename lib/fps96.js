// v96: 60 and 120 fps on the Video page were charged (+2 / +4 cr) but no engine makes them — every engine makes 24–30 fps —
// so the client got the usual video. A finished video asked for at 50 fps or more now gets its in-between frames made here
// before it is shown (motion-compensated interpolation: ffmpeg minterpolate), one video at a time since it is heavy work.
// If it can't be done in time, the video comes as the engine made it and the extra for the frame rate is refunded.
// The "120 fps" button under a video (a Finish job, tool "interp") had no engine at all ("This engine isn't available") —
// it now uses the same smoothing (fpsAdapter), on a video that is on this server.
import fs from "fs";
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
async function smooth(url, fps) {
  const src = onServer(url) || (await download(url, null, { tries: 2, timeoutMs: 120000 })).file;
  const name = uid() + "-" + fps + "fps.mp4", out = path.join(MEDIA_DIR, name);
  const ms = (+process.env.FPS_SMOOTH_MINUTES || 20) * 60e3;
  await run(["-y", "-v", "error", "-i", src, "-vf", `minterpolate=fps=${fps}:mi_mode=mci:mc_mode=obmc:me_mode=bilat,format=yuv420p`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out], ms).catch((e) => { try { fs.unlinkSync(out); } catch {} throw e; });
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
