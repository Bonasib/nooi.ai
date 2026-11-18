// v163: super slow motion that stays smooth — every slow speed gets real in-between frames (motion-compensated interpolation,
// ffmpeg minterpolate) before it is slowed, so 0.25× is 30 new pictures a second, not one picture held four times.
//   slow  0.5×   · the whole video at half speed            (5 s → 10 s)
//   super 0.25×  · super slow motion                        (5 s → 20 s)
//   ultra 0.125× · ultra slow motion                        (5 s → 40 s)
//   ramp         · cinematic: real speed → super slow in the middle → real speed again, eased in and out (5 s → about 11 s)
// The frames are made at 30 ÷ slowest speed per second (120 for super slow), then the time is bent along the speed curve and read
// back at 30 frames a second. Long videos are cut into one piece per processor core (like lib/fps96.js); each piece's time bend is
// the same curve, so the joins can't be seen. The sound is left out (slowed sound is a low drone — the editor adds music).
// Where it runs: a video made on the Video page with "Slow motion" chosen (after the engine, before the video is shown — the extra
// is refunded if it can't be made), and the editor's slowed clips (a free Finish job, tool "slowmo", started by itself — v168).
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { uid } from "./store.js";
import { MEDIA_DIR, publicUrl, localPath, download } from "./media.js";

export const SLOW163 = { slow: { speed: 0.5, extra: 2 }, super: { speed: 0.25, extra: 4 }, ultra: { speed: 0.125, extra: 6 }, ramp: { speed: 0.25, ramp: true, extra: 4 } };
export const slowKind163 = (k) => (Object.hasOwn(SLOW163, String(k || "")) ? String(k) : null);
export const SLOW_MAX163 = 120;   // (the slowed video is at most 2 minutes)
const F = 30, LOOK = 0.4;
const FF = () => process.env.FFMPEG_PATH || "ffmpeg", FP = () => process.env.FFPROBE_PATH || "ffprobe";
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// the speed at a point of the video (x from 0 to 1)
export function speedAt163(kind, x) {
  const s = SLOW163[kind]; if (!s) return 1; if (!s.ramp) return s.speed;
  const w = sstep(0.22, 0.42, x) * (1 - sstep(0.62, 0.82, x)); return 1 + (s.speed - 1) * w;
}
// the time bend: knots [time in the video, time in the slowed video], from the speed curve
export function warp163(kind, dur, n = 96) {
  const pts = [[0, 0]]; let out = 0; const d = Math.max(0.05, +dur || 0);
  for (let i = 1; i <= n; i++) { const x0 = (i - 1) / n, x1 = i / n; out += (d / n) / speedAt163(kind, (x0 + x1) / 2); pts.push([x1 * d, out]); }
  return pts;
}
export const outLen163 = (kind, dur) => { const w = warp163(kind, dur); return w[w.length - 1][1]; };
// the editor's own slow motion (any speed from 0.1×, steady or one of its ramps) made exactly as the editor times it: the speed
// is a function of the clip's time on the timeline (public/index.html edxRampW / edxRampTable), so the smooth file is as long as
// the clip already is and every moment lands where the editor put it
const RAMPW163 = { none: () => 1, in: (x) => sstep(0.15, 0.45, x), out: (x) => 1 - sstep(0.55, 0.85, x), bullet: (x) => sstep(0.15, 0.35, x) * (1 - sstep(0.65, 0.85, x)) };
export function edSpec163(m) {
  if (m?.slow163 !== "ed") return null; const sp = +m.speed163, r = String(m.ramp163 || "none");
  if (!(sp >= 0.1 && sp < 0.995) || !Object.hasOwn(RAMPW163, r)) return null; return { speed: Math.round(sp * 1000) / 1000, ramp: r, ed: true };
}
export function edWarp163(spec, len, n) {
  n = n || (spec.ramp === "none" ? 1 : 64);   // (a steady speed is one straight line; ffmpeg's expressions nest only so deep)
  const rate = (x) => 1 + (spec.speed - 1) * RAMPW163[spec.ramp](x), R = [0]; for (let i = 1; i <= n; i++) R.push(R[i - 1] + rate((i - 0.5) / n) / n);
  const A = R[n], D = len / A; return R.map((r, i) => [len * r / A, D * i / n]);   // [time in the clip, time on the timeline]
}
const at = (W, t) => { if (t <= W[0][0]) return W[0][1]; for (let i = 1; i < W.length; i++) if (t <= W[i][0]) { const [a0, b0] = W[i - 1], [a1, b1] = W[i]; return b0 + (t - a0) * (b1 - b0) / (a1 - a0 || 1); }
  const [a0, b0] = W[W.length - 2], [a1, b1] = W[W.length - 1]; return b1 + (t - a1) * (b1 - b0) / (a1 - a0 || 1); };
// setpts for the piece that starts at `a` in the video (its T starts at 0): the slowed time from the piece's start, piece by piece of the curve
export function setpts163(W, a, b) {
  const ks = W.filter(([t]) => t > a + 1e-6 && t < b - 1e-6).map(([t]) => t), xs = [a, ...ks, b], base = at(W, a), f = (v) => (+v).toFixed(5);
  const seg = (i) => { const x0 = xs[i], x1 = xs[i + 1], y0 = at(W, x0) - base, k = (at(W, x1) - at(W, x0)) / (x1 - x0 || 1); return `${f(y0)}+(T-${f(x0 - a)})*${f(k)}`; };
  let e = seg(xs.length - 2); for (let i = xs.length - 3; i >= 0; i--) e = `if(lt(T,${f(xs[i + 1] - a)}),${seg(i)},${e})`;
  return `setpts='(${e})/TB'`;
}
const run = (bin, args, ms) => new Promise((ok, bad) => {
  const p = spawn(bin, args); let out = "", err = ""; const t = setTimeout(() => { try { p.kill("SIGKILL"); } catch {} bad(new Error("took too long")); }, ms);
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err = (err + d).slice(-2000))); p.on("error", (e) => { clearTimeout(t); bad(e); });
  p.on("close", (c) => { clearTimeout(t); c === 0 ? ok(out) : bad(new Error(path.basename(bin) + ": " + err.trim().split("\n").slice(-1)[0].slice(0, 200))); });
});
const lengthOf = async (src) => +(await run(FP(), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src], 30000).catch(() => "0")).trim() || 0;
const onServer = (u) => { const s = String(u || "").split("?")[0], loc = /^\/media\/[^/]+$/.test(s) ? path.join(MEDIA_DIR, path.basename(s)) : localPath(s); return loc && fs.existsSync(loc) ? loc : null; };
export const slowParts163 = (dur) => { const cores = +process.env.SMOOTH_PARTS || (os.availableParallelism ? os.availableParallelism() : os.cpus().length) || 1;
  return Math.max(1, Math.min(cores, 16, Math.floor((+dur || 0) / 1.5))); };
const MAKE = (fps) => `minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`, X264 = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p"];
let line = Promise.resolve();
// one slow-motion video at a time (it is heavy work); from → to cuts the part of the video first (the editor's clip)
// (kind: one of SLOW163, or the editor's own {speed, ramp} from edSpec163)
export function slowmo163(url, kind, opts = {}) { const job = line.then(() => make(url, kind, opts)); line = job.catch(() => {}); return job; }
async function make(url, kind, { from, to } = {}) {
  const s = kind && typeof kind === "object" && kind.ed ? kind : SLOW163[kind]; if (!s) throw new Error("unknown slow motion " + kind);
  const warp = (d) => (s.ed ? edWarp163(s, d) : warp163(kind, d)), tag = s.ed ? "ed" : kind;
  const src0 = onServer(url) || (await download(url, null, { tries: 2, timeoutMs: 120000 })).file, full = await lengthOf(src0);
  const a = Math.max(0, +from || 0), b = Math.min(full || a + 1, +to > a ? +to : full || a + 1), dur = b - a;
  if (!(dur > 0.2)) throw Object.assign(new Error("too short"), { userMsg: "This part of the video is too short for slow motion." });
  const W = warp(dur); if (W[W.length - 1][1] > SLOW_MAX163) throw Object.assign(new Error("too long"), { userMsg: "Slow motion makes videos up to 2 minutes long — pick a slower part or a shorter clip." });
  const H = Math.round(F / s.speed), total = W[W.length - 1][1], n = slowParts163(dur), len = dur / n, ms = (+process.env.SLOWMO_MINUTES || 25) * 60e3;
  const name = uid() + "-slow-" + tag + ".mp4", out = path.join(MEDIA_DIR, name), dir = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-slow-")), parts = [];
  // (pictures above 1080 lines are brought down first: the in-between frames cost grows with every pixel)
  const scale = "scale='if(gt(ih,1080),-2,iw)':'min(1080,ih)'";
  try {
    await Promise.all(Array.from({ length: n }, (_, i) => { const p0 = a + i * len, p1 = p0 + len, last = i === n - 1, f = path.join(dir, "p" + i + ".mp4"); parts.push(f);
      const keep = (at(W, p1 - a) - at(W, p0 - a)).toFixed(4);
      return run(FF(), ["-y", "-v", "error", "-ss", p0.toFixed(3), "-t", (last ? len : len + LOOK).toFixed(3), "-i", src0, "-an",
        "-vf", `${scale},${MAKE(H)},${setpts163(W, p0 - a, p1 - a + (last ? 0 : LOOK))},fps=${F},trim=duration=${keep},setpts=PTS-STARTPTS,format=yuv420p`, ...X264, "-r", String(F), f], ms); }));
    if (parts.length === 1) fs.renameSync(parts[0], out);
    else { const list = path.join(dir, "list.txt"); fs.writeFileSync(list, parts.map((f) => "file '" + f.replace(/'/g, "'\\''") + "'").join("\n"));
      await run(FF(), ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", out], ms); }
    if (!fs.existsSync(out) || fs.statSync(out).size < 2000) throw new Error("no video came out");
    return { url: publicUrl(name), name, dur: Math.round(((await lengthOf(out)) || total) * 100) / 100, frames: H };
  } catch (e) { try { fs.unlinkSync(out); } catch {} throw e; }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
// a video of this client's on this server (an upload of theirs, or one of their results) — nobody slows someone else's file
export function ownsMedia163(U, url) {
  let p = String(url || ""); const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, ""); if (base && p.startsWith(base)) p = p.slice(base.length);
  const m = /^\/media\/([A-Za-z0-9][A-Za-z0-9._-]{0,200})$/.exec(p.split(/[?#]/)[0]); if (!m || !U) return false;
  return (U.uploads || []).includes(m[1]) || Object.values(U.jobs || {}).some((j) => String(j.url || "").split("?")[0].endsWith("/media/" + m[1]));
}
// the prompt's words for a video that will be slowed: real speed and crisp frames give the in-between frames the most to work with
export const SLOW_WORDS163 = "Action at natural real-time speed, crisp high-shutter frames, minimal motion blur, steady exposure — it will be turned into smooth cinematic slow motion.";
// the editor's slowed clips and a library video: a Finish job (tool "slowmo") on a video of the client's on this server
export const slowAdapter163 = () => ({
  name: "Slow motion", configured: true,
  async submit(p) {
    const m = p.meta || {}, kind = edSpec163(m) || slowKind163(m.slow163) || "super", src = [p.inputs?.fin, m.sourceUrl].find((u) => onServer(u));
    if (!src) throw Object.assign(new Error("This video isn't on the server yet — try again in a minute."), { type: "input", noFallback: true, userMsg: "This video isn't on the server yet — try again in a minute. Nothing was charged." });
    const r = await slowmo163(src, kind, { from: m.from163, to: m.to163 }).catch((e) => { throw Object.assign(e, { type: "input", retryable: false, noFallback: true, userMsg: (e.userMsg ? e.userMsg + " " : "The slow-motion video couldn't be made. ") + "Nothing was charged." }); });
    const sp = kind.ed ? kind.speed + "×" + (kind.ramp !== "none" ? " · " + kind.ramp + " ramp" : "") : SLOW163[kind].ramp ? "ramp" : SLOW163[kind].speed + "×";
    return { done: true, url: r.url, sent: { tool: "slow motion", speed: sp, frames: r.frames + " a second, then slowed" } };
  },
  async poll() { return { status: "rendering" }; },
});
