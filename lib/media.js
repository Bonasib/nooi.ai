import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { uid } from "./store.js";
export const MEDIA_DIR = path.resolve("media");
fs.mkdirSync(MEDIA_DIR, { recursive: true });
export const publicUrl = (name) => (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "") + "/media/" + name;
export const localPath = (url) => { const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "") + "/media/"; return url && url.startsWith(base) ? path.join(MEDIA_DIR, path.basename(url)) : null; };

export async function download(url, ext) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Download failed " + r.status);
  const type = r.headers.get("content-type") || "";
  const e = ext || (type.includes("mp4") ? ".mp4" : type.includes("webm") ? ".webm" : type.includes("png") ? ".png" : type.includes("jpeg") ? ".jpg" : type.includes("mpeg") ? ".mp3" : type.includes("wav") ? ".wav" : path.extname(new URL(url).pathname) || ".bin");
  const name = uid() + e;
  fs.writeFileSync(path.join(MEDIA_DIR, name), Buffer.from(await r.arrayBuffer()));
  return { name, url: publicUrl(name), file: path.join(MEDIA_DIR, name) };
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
