// v195: one guard for every address the server reads on a customer's word — the website to analyse, a reference picture an
// engine receives as data — so a request can never make the server read its own network (localhost, the cloud metadata
// address, other machines behind the firewall). Public internet addresses only, checked on every redirect hop; the site's
// own media (/media/… or PUBLIC_BASE_URL/media/…) is read from disk, not through the network. In the no-sign-in mode
// (no FIREBASE_PROJECT_ID — one local user, tests and development) the loopback address is allowed, because the tests'
// stand-in engines live there and that mode is never meant to face the internet.
import fs from "node:fs"; import path from "node:path"; import net from "node:net"; import dns from "node:dns";
import { MEDIA_DIR } from "./media.js";

const loopback = (ip) => /^127\./.test(ip) || ip === "::1" || ip === "0.0.0.0" || ip === "::" || /^::ffff:127\./i.test(ip);
export const privateIp = (ip) => {
  if (net.isIPv4(ip)) { const [a, b] = ip.split(".").map(Number); return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127); }
  const v = String(ip).toLowerCase(); return v === "::" || v === "::1" || /^f[cd]/.test(v) || v.startsWith("fe80") || (v.startsWith("::ffff:") && privateIp(v.slice(7)));
};
export const devMode = () => !process.env.FIREBASE_PROJECT_ID;
const MEDIA_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;
const ownOrigins = () => { const s = new Set(); const pub = process.env.PUBLIC_BASE_URL; if (pub) { try { s.add(new URL(pub).origin); } catch { /* unset or odd */ } } return s; };

// the site's own media file behind an address (relative /media/x or the public address of it) — a path on disk, or null
export function ownMedia(u) {
  if (typeof u !== "string") return null;
  let p = null;
  if (u.startsWith("/media/")) p = u.slice(7);
  else { try { const x = new URL(u); if (x.pathname.startsWith("/media/") && (ownOrigins().has(x.origin) || (devMode() && loopback(x.hostname.replace(/^\[|\]$/g, ""))) || x.hostname === "localhost")) p = x.pathname.slice(7); } catch { return null; } }
  if (!p) return null;
  const name = decodeURIComponent(p.split("?")[0]);
  if (!MEDIA_NAME.test(name)) return null;
  const f = path.join(MEDIA_DIR, name); return fs.existsSync(f) ? f : null;
}

// may the server read this address? public http(s), no credentials in it, every resolved address public
export async function publicUrl(u, { http = false } = {}) {
  try {
    const x = new URL(String(u)); const host = x.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (x.protocol !== "https:" && !(http && x.protocol === "http:") && !(devMode() && x.protocol === "http:")) return false;
    if (x.username || x.password) return false;
    if (host === "localhost" || /\.(local|internal|localhost|home|lan|corp)$/.test(host)) return devMode() && host === "localhost";
    const addrs = net.isIP(host) ? [{ address: host }] : await dns.promises.lookup(host, { all: true });
    if (!addrs.length) return false;
    return addrs.every((a) => !privateIp(a.address) || (devMode() && loopback(a.address)));
  } catch { return false; }
}
export const refuse = (u) => Object.assign(new Error("That address can't be read — only public internet addresses (https) are read."), { code: 400, errorAr: "لا يمكن قراءة هذا العنوان — تُقرأ عناوين الإنترنت العامة (https) فقط.", url: String(u).slice(0, 200) });

// fetch that follows redirects by hand, checking every hop (a public address may answer "go to http://169.254.169.254/…")
export async function fetchPublic(u, init = {}, { http = false, hops = 5 } = {}) {
  let cur = String(u);
  for (let i = 0; i <= hops; i++) {
    if (!(await publicUrl(cur, { http }))) throw refuse(cur);
    const r = await fetch(cur, { ...init, redirect: "manual" });
    if ([301, 302, 303, 307, 308].includes(r.status) && r.headers.get("location")) {
      if (i === hops) throw Object.assign(new Error("Too many redirects"), { code: 400 });
      cur = new URL(r.headers.get("location"), cur).href; if (r.status === 303 || ((r.status === 301 || r.status === 302) && init.method && init.method !== "GET")) init = { ...init, method: "GET", body: undefined }; continue;
    }
    return r;
  }
  throw refuse(cur);
}

const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif", ".svg": "image/svg+xml", ".bmp": "image/bmp", ".heic": "image/heic",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".mkv": "video/x-matroska", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".ogg": "audio/ogg", ".flac": "audio/flac", ".glb": "model/gltf-binary", ".json": "application/json" };
export const mediaType = (f) => TYPES[path.extname(String(f)).toLowerCase()] || "application/octet-stream";

// read a customer-given address as bytes: the site's own media from disk, anything else through the guard
export async function readPublic(u, { http = false, maxBytes = 64 * 1024 * 1024 } = {}) {
  const f = ownMedia(u);
  if (f) { const st = fs.statSync(f); if (st.size > maxBytes) throw Object.assign(new Error("The file is too large to read"), { code: 413 }); return { buf: fs.readFileSync(f), type: mediaType(f) }; }
  const r = await fetchPublic(u, {}, { http });
  if (!r.ok) throw Object.assign(new Error("Couldn't read the picture (" + r.status + ")"), { code: 400 });
  const len = +r.headers.get("content-length") || 0; if (len > maxBytes) throw Object.assign(new Error("The file is too large to read"), { code: 413 });
  const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > maxBytes) throw Object.assign(new Error("The file is too large to read"), { code: 413 });
  return { buf, type: (r.headers.get("content-type") || mediaType(new URL(r.url || u).pathname)).split(";")[0].trim() };
}
// a data: URL of the bytes — what the engines that take pictures inline receive
export async function toDataUrl(u, opts) { if (!u) return null; const s = String(u); if (s.startsWith("data:")) return s; const { buf, type } = await readPublic(s, opts); return "data:" + (type || "image/png") + ";base64," + buf.toString("base64"); }
