// Where a project's media lives on the VPS and how files are sent back. Only two places are allowed: the nooi.ai /media folder
// (what nooi made or the user uploaded to nooi.ai) and this service's own uploads. No outside URLs are ever fetched.
import fs from "node:fs";
import path from "node:path";
import type { FastifyReply, FastifyRequest } from "fastify";
import { CFG } from "./config";
import type { Store } from "./store";
import type { Who } from "./auth";

export const UPLOAD_PREFIX = "/render-api/uploads/";
const inside = (root: string, p: string) => { const r = path.resolve(root), f = path.resolve(p); return f === r ? false : f.startsWith(r + path.sep); };

// a URL from the project → a file on this disk, or an error the user can read
export async function resolveSrc(store: Store, who: Who, src: string): Promise<{ path: string } | { error: string }> {
  const clean = String(src || "").split(/[?#]/)[0];
  let rel: string;
  try { rel = decodeURIComponent(clean); } catch { return { error: "bad media address" }; }
  if (rel.startsWith(CFG.publicMedia)) {
    const f = path.join(CFG.mediaDir, rel.slice(CFG.publicMedia.length));
    if (!inside(CFG.mediaDir, f) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return { error: "media file not found: " + path.basename(f) };
    return { path: f };
  }
  if (rel.startsWith(UPLOAD_PREFIX)) {
    const name = rel.slice(UPLOAD_PREFIX.length); if (!/^[A-Za-z0-9_-]+\.[a-z0-9]{2,5}$/.test(name)) return { error: "bad upload name" };
    const row = await store.getMedia(name.replace(/\.[^.]+$/, ""));
    if (!row || (row.owner !== who.uid && !who.staff && !who.admin)) return { error: "upload not found" };
    if (!inside(CFG.uploadDir, row.path) || !fs.existsSync(row.path)) return { error: "upload not found" };
    return { path: row.path };
  }
  return { error: "only files on nooi.ai can be rendered — upload this file first" };
}

const MIME: Record<string, string> = { ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".gif": "image/gif", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ogg": "audio/ogg", ".flac": "audio/flac", ".cube": "text/plain" };
// a file with Range support (video players seek), or 404
export function sendFile(req: FastifyRequest, reply: FastifyReply, root: string, name: string, download = false) {
  const f = path.join(root, name);
  if (!/^[A-Za-z0-9_.-]+$/.test(name) || !inside(root, f) || !fs.existsSync(f)) return reply.code(404).send({ error: "not found" });
  const size = fs.statSync(f).size, type = MIME[path.extname(f).toLowerCase()] || "application/octet-stream";
  reply.header("content-type", type).header("accept-ranges", "bytes").header("cache-control", "private, max-age=86400").header("x-content-type-options", "nosniff");
  if (download) reply.header("content-disposition", `attachment; filename="nooi-${name}"`);
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ""));
  if (m && size > 0) {
    let a = m[1] === "" ? size - Number(m[2]) : Number(m[1]), b = m[1] !== "" && m[2] !== "" ? Number(m[2]) : size - 1;
    a = Math.max(0, a); b = Math.min(size - 1, b);
    if (a > b) return reply.code(416).header("content-range", `bytes */${size}`).send();
    return reply.code(206).header("content-range", `bytes ${a}-${b}/${size}`).header("content-length", b - a + 1).send(fs.createReadStream(f, { start: a, end: b }));
  }
  return reply.header("content-length", size).send(fs.createReadStream(f));
}
