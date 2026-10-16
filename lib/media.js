import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { uid } from "./store.js";
export const MEDIA_DIR = path.resolve("media");
fs.mkdirSync(MEDIA_DIR, { recursive: true });
export const publicUrl = (name) => (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "") + "/media/" + name;
export const localPath = (url) => { const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "") + "/media/"; return url && url.startsWith(base) ? path.join(MEDIA_DIR, path.basename(url)) : null; };

// a file from another server, kept here. A server that hangs never holds a job forever (a time limit on the whole
// download), and a dropped connection or a busy server (5xx, 429) is tried again twice.
export async function download(url, ext, { tries = 3, timeoutMs = 180000 } = {}) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) { last = new Error("Download failed " + r.status); if (r.status < 500 && r.status !== 429) break; }
      else {
        const type = r.headers.get("content-type") || "", buf = Buffer.from(await r.arrayBuffer());
        const e = ext || (type.includes("mp4") ? ".mp4" : type.includes("webm") ? ".webm" : type.includes("png") ? ".png" : type.includes("jpeg") ? ".jpg" : type.includes("mpeg") ? ".mp3" : type.includes("wav") ? ".wav" : path.extname(new URL(url).pathname) || ".bin");
        const name = uid() + e; fs.writeFileSync(path.join(MEDIA_DIR, name), buf);
        return { name, url: publicUrl(name), file: path.join(MEDIA_DIR, name) };
      }
    } catch (e) { last = e.name === "AbortError" ? new Error("Download timed out") : e; }
    finally { clearTimeout(t); }
    if (i < tries - 1) await new Promise((ok) => setTimeout(ok, 1500 * (i + 1)));
  }
  throw last || new Error("Download failed");
}
export function saveBuffer(buf, ext) { const name = uid() + ext; fs.writeFileSync(path.join(MEDIA_DIR, name), buf); return { name, url: publicUrl(name), file: path.join(MEDIA_DIR, name) }; }

// Extract the last frame of a video → PNG (used to chain Chapter Story shots)
export async function lastFrame(videoUrl) {
  const src = localPath(videoUrl) || (await download(videoUrl)).file;
  const name = uid() + ".png", out = path.join(MEDIA_DIR, name);
  await new Promise((res, rej) => {
    const p = spawn(process.env.FFMPEG_PATH || "ffmpeg", ["-y", "-sseof", "-0.1", "-i", src, "-frames:v", "1", "-update", "1", out]);
    p.on("error", rej); p.on("close", (c) => (c === 0 ? res() : rej(new Error("ffmpeg exited " + c))));
  });
  return publicUrl(name);
}
