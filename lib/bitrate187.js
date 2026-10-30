// v187: Bitrate "Standard" in the prompt box's settings — the finished video is made again here as a smaller file (H.264, CRF 28,
// the sound kept), so it shares and downloads faster; "High" keeps the file as the engine made it. If it can't be made smaller (or
// comes out bigger) the engine's file is kept.
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { uid } from "./store.js";
import { MEDIA_DIR, localPath, publicUrl } from "./media.js";

export async function lighter187(url) {
  const src = localPath(url) || (/^\/media\//.test(String(url)) ? path.join(MEDIA_DIR, path.basename(String(url))) : null);
  if (!src || !fs.existsSync(src)) return url;
  const name = uid() + "-std.mp4", out = path.join(MEDIA_DIR, name);
  const ok = await new Promise((resolve) => { const p = spawn(process.env.FFMPEG_PATH || "ffmpeg", ["-v", "error", "-y", "-i", src, "-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", out], { stdio: "ignore" });
    const t = setTimeout(() => p.kill("SIGKILL"), 300000); p.on("close", (c) => { clearTimeout(t); resolve(c === 0); }); p.on("error", () => { clearTimeout(t); resolve(false); }); });
  if (!ok || !fs.existsSync(out) || fs.statSync(out).size >= fs.statSync(src).size) { try { fs.unlinkSync(out); } catch {} return url; }
  return publicUrl(name);
}
