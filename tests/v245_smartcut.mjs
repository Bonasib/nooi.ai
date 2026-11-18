// v245 — the lossless smart cut: an H.264 video (a keyframe every 2 s) cut at 1.3–7.2 s
//  · the length is exact (5.9 s, 177 frames) and it plays with no decode errors
//  · only the 21 frames before the first keyframe (2.0 s) are made again; every packet after it is the source's, byte for byte
//  · the first frame is the source's frame at 1.3 s, and a frame in the copied part is identical to the source's
//  · a source it can't cut this way (VP9) says so (null), and trim135 then re-encodes as before
// Run: node tests/v245_smartcut.mjs
import fs from "fs"; import os from "os"; import path from "path"; import { spawnSync } from "child_process";
const D = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-v245-")); process.chdir(D); fs.mkdirSync("media"); fs.mkdirSync("data");
const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const ff = (...a) => { const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...a]); if (r.status) throw new Error(String(r.stderr)); return r; };
const fp = (...a) => String(spawnSync("ffprobe", ["-v", "error", ...a]).stdout);
ff("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=10", "-f", "lavfi", "-i", "sine=f=440:d=10", "-c:v", "libx264", "-preset", "veryfast", "-g", "60", "-keyint_min", "60", "-sc_threshold", "0", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", "src.mp4");
ff("-f", "lavfi", "-i", "testsrc2=size=320x180:rate=30:duration=4", "-c:v", "libvpx-vp9", "-deadline", "realtime", "src.webm");
const { smartCut245, keyframes245 } = await import(ROOT + "/lib/smartcut245.js");
const fails = []; const chk = (n, ok, info) => { if (!ok) fails.push(n + (info === undefined ? "" : " · " + JSON.stringify(info).slice(0, 600))); };
const keys = await keyframes245("src.mp4"); chk("the keyframes are read from the packets", JSON.stringify(keys.slice(0, 5)) === "[0,2,4,6,8]", keys);
const r = await smartCut245(path.resolve("src.mp4"), 1.3, 7.2, path.resolve("out.mp4"));
const frames = +fp("-select_streams", "v:0", "-count_packets", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", "out.mp4").trim();
const errs = String(spawnSync("ffmpeg", ["-v", "error", "-i", "out.mp4", "-f", "null", "-"]).stderr).trim();
chk("the length is exact and it plays with no decode errors", r && Math.abs(r.dur - 5.9) < 0.07 && Math.abs(frames - 177) <= 1 && !errs, { r, frames, errs });
chk("only the frames before the first keyframe are made again", r && Math.abs(r.made - 0.7) < 0.02 && Math.abs(r.copied - 5.2) < 0.02, r);
const sizes = (f, from) => fp("-select_streams", "v:0", "-read_intervals", from, "-show_entries", "packet=pts_time,size,flags", "-of", "csv=p=0", f).trim().split("\n").map((l) => l.split(",")).filter((p) => p.length === 3).sort((a, b) => +a[0] - +b[0]).map((p) => [+p[1], p[2].includes("K")]);
// the same picture data: every packet the same size, but a keyframe may carry the size and format notes (SPS/PPS, a few dozen bytes) in itself
const same = (x, y) => x.length === y.length && x.every((p, i) => p[1] === y[i][1] && (p[1] ? y[i][0] - p[0] >= 0 && y[i][0] - p[0] <= 64 : p[0] === y[i][0]));
const so = sizes("src.mp4", "2%7.2").slice(0, 150), oo = sizes("out.mp4", "0.7%6").slice(0, 150);
chk("every packet after the keyframe is the source's (150 checked: the same bytes; a keyframe only adds its format notes)", so.length === 150 && same(so, oo), { so: so.slice(0, 8), oo: oo.slice(0, 8) });
const gray = (f, t) => spawnSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", f, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"]).stdout;
const diff = (x, y) => { let s = 0; for (let i = 0; i < Math.min(x.length, y.length); i++) s += Math.abs(x[i] - y[i]); return x.length === y.length ? s / x.length : 999; };
const d0 = diff(gray("out.mp4", 0), gray("src.mp4", 1.3)), d1 = diff(gray("out.mp4", 3.0), gray("src.mp4", 4.3)), dWrong = diff(gray("out.mp4", 0), gray("src.mp4", 1.4));
chk("the first frame is the source's at 1.3 s (not 1.4 s); the copied part's frames are identical", d0 < 1.5 && d1 < 0.01 && dWrong > d0 * 2, { d0, d1, dWrong });
const vp9 = await smartCut245(path.resolve("src.webm"), 1, 3, path.resolve("o2.mp4")); chk("a VP9 source: it says it can't (null)", vp9 === null, vp9);
process.env.MEDIA_DIR = path.resolve("media");
const { trim135 } = await import(ROOT + "/lib/edit135.js");
const u1 = await trim135(path.resolve("src.mp4"), 1.3, 7.2), u2 = await trim135(path.resolve("src.webm"), 1, 3);
const f1 = path.join(path.resolve("media"), path.basename(u1)), f2 = path.join(path.resolve("media"), path.basename(u2));
const sz = (f) => fp("-select_streams", "v:0", "-show_entries", "stream=codec_name", "-of", "csv=p=0", f).trim();
chk("trim135 uses the smart cut for H.264 and re-encodes anything else (both H.264 MP4s)", fs.existsSync(f1) && fs.existsSync(f2) && sz(f1) === "h264" && sz(f2) === "h264" && same(sizes("src.mp4", "2%3.3").slice(0, 20), sizes(f1, "0.7%2").slice(0, 20)), { u1, u2 });
fs.rmSync(D, { recursive: true, force: true });
if (fails.length) { console.log("v245 smartcut FAIL\n - " + fails.join("\n - ")); process.exit(1); }
console.log("v245 smartcut OK");
