// v245: a lossless "smart" cut. Cutting a video normally re-encodes all of it (slow, and a little quality is lost each time). Here
// only the few frames from the cut to the next keyframe are made again (matched to the source: same codec, size, pixel format and
// frame rate); everything from that keyframe on is copied bit for bit. The sound is cut exactly (it is small, so it is re-encoded).
// When the source can't be cut this way (not H.264, no keyframe inside the range, odd pixel format) it says so and the caller
// re-encodes as before. Our own code (the technique is the one video tools call "smart cut").
import fs from "fs";
import os from "os";
import path from "path";
import { FF, FP, run132 } from "./long132.js";

const r3 = (x) => Math.round(x * 1000) / 1000;
/** the first video stream's codec, size, pixel format and frame rate, and whether there is sound */
export async function info245(file) {
  const j = JSON.parse(await run132(FP(), ["-v", "error", "-show_entries", "stream=codec_type,codec_name,profile,pix_fmt,width,height,r_frame_rate,avg_frame_rate:format=duration", "-of", "json", file], 30000));
  const v = (j.streams || []).find((s) => s.codec_type === "video"); if (!v) return null;
  const fr = (s) => { const [a, b] = String(s || "0/1").split("/").map(Number); return b ? a / b : 0; };
  return { codec: v.codec_name, profile: v.profile, pix: v.pix_fmt, w: +v.width, h: +v.height, fps: fr(v.avg_frame_rate) || fr(v.r_frame_rate), cfr: Math.abs(fr(v.avg_frame_rate) - fr(v.r_frame_rate)) < 0.01, audio: (j.streams || []).some((s) => s.codec_type === "audio"), dur: +j.format?.duration || 0 };
}
/** the keyframes' times (seconds) between `from` and `to` (read from the packets, nothing decoded) */
export async function keyframes245(file, from = 0, to = 1e9) {
  const out = await run132(FP(), ["-v", "error", "-select_streams", "v:0", "-read_intervals", `${Math.max(0, from - 1)}%${to + 1}`, "-show_entries", "packet=pts_time,flags", "-of", "csv=p=0", file], 120000);
  return out.split(/\r?\n/).map((l) => l.split(",")).filter((p) => p[1] && p[1].includes("K")).map((p) => +p[0]).filter((t) => isFinite(t) && t >= from - 1e-3 && t <= to + 1e-3).sort((a, b) => a - b);
}
const PROFILE = { "Constrained Baseline": "baseline", Baseline: "baseline", Main: "main", High: "high" };
/** seconds a..b of an H.264 file into `out` (MP4), losslessly but for the frames before the first keyframe. null = can't (re-encode instead) */
export async function smartCut245(file, a, b, out) {
  const I = await info245(file); if (!I || I.codec !== "h264" || !/^yuvj?420p$/.test(I.pix || "") || !I.fps || !I.cfr || !PROFILE[I.profile]) return null;
  const fd = 1 / I.fps; b = Math.min(b, I.dur || b); if (b - a < 0.5) return null;
  const keys = await keyframes245(file, a - fd / 2, b - 0.2); const k1 = keys.find((k) => k >= a - fd / 2); if (k1 == null) return null;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-sc-")), list = path.join(tmp, "list.txt"), head = path.join(tmp, "head.ts"), body = path.join(tmp, "body.ts");
  try {
    const n = Math.round((k1 - a) * I.fps), lines = [];
    if (n > 0) {   // the frames before the keyframe, made again to match the source
      await run132(FF(), ["-y", "-v", "error", "-ss", r3(a).toFixed(3), "-i", file, "-frames:v", String(n), "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-profile:v", PROFILE[I.profile], "-pix_fmt", I.pix,
        "-r", String(I.fps), "-fps_mode", "cfr", "-bsf:v", "h264_mp4toannexb", "-f", "mpegts", head], 120000);
      lines.push(`file '${head}'`, `duration ${(n * fd).toFixed(6)}`);
    }
    await run132(FF(), ["-y", "-v", "error", "-ss", (k1 + 0.001).toFixed(3), "-i", file, "-t", r3(b - k1).toFixed(3), "-an", "-c:v", "copy", "-bsf:v", "h264_mp4toannexb", "-avoid_negative_ts", "make_zero", "-f", "mpegts", body], 300000);
    lines.push(`file '${body}'`); fs.writeFileSync(list, lines.join("\n") + "\n");
    await run132(FF(), ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, ...(I.audio ? ["-ss", r3(a).toFixed(3), "-t", r3(b - a).toFixed(3), "-i", file, "-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac", "-b:a", "160k", "-shortest"] : ["-map", "0:v:0"]),
      "-c:v", "copy", "-bsf:v", "filter_units=remove_types=9", "-movflags", "+faststart", out], 300000);   // (the access-unit markers the TS step added, taken out again)
    if (!fs.existsSync(out) || !fs.statSync(out).size) return null;
    const got = (await info245(out))?.dur || 0; if (Math.abs(got - (b - a)) > Math.max(0.12, 3 * fd)) { fs.rmSync(out, { force: true }); return null; }
    return { file: out, made: r3(n * fd), copied: r3(b - k1), dur: r3(got) };
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
