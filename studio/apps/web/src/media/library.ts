// Bringing media in: kept on this device at once (IndexedDB), probed (size, length, sound), a small picture and a waveform made
// here, then sent to the account in the background when signed in (the project keeps working offline either way).
import { uid } from "@nooi/editor-core";
import type { Asset, AssetKind } from "@nooi/editor-core";
import { getFile, putFile } from "./idb";
import { api } from "../api";
import { at, SITE } from "../site";
import { peaks } from "@nooi/editor-core";

const urls = new Map<string, string>();
export function kindOf(f: { type?: string; name?: string }): AssetKind | null {
  const t = f.type || "", n = (f.name || "").toLowerCase();
  if (t.startsWith("video/") || /\.(mp4|mov|webm|m4v|mkv)$/.test(n)) return "video";
  if (t.startsWith("image/") || /\.(png|jpe?g|webp|gif|avif|bmp)$/.test(n)) return "image";
  if (t.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/.test(n)) return "audio";
  if (/\.cube$/.test(n)) return "lut";
  if (/\.(ttf|otf|woff2?)$/.test(n)) return "font";
  return null;
}
// a playable address for an asset (a file on this device becomes a blob: URL; the server's files are used as they are)
export async function urlOf(a: Asset, preferProxy = true): Promise<string | null> {
  const src = preferProxy && a.proxy ? a.proxy : a.src;
  if (!src.startsWith("local:")) return at(src);
  if (urls.has(src)) return urls.get(src)!;
  const b = await getFile(src.slice(6)); if (!b) return null;
  const u = URL.createObjectURL(b); urls.set(src, u); return u;
}
export async function fileOf(a: Asset): Promise<Blob | null> {
  if (a.src.startsWith("local:")) return (await getFile(a.src.slice(6))) || null;
  try { const r = await fetch(at(a.src)); return r.ok ? await r.blob() : null; } catch { return null; }
}

function probeVideo(url: string): Promise<{ w: number; h: number; duration: number; thumb: string }> {
  return new Promise((res) => {
    const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto"; v.crossOrigin = "anonymous";
    let done = false; const fin = (o: { w: number; h: number; duration: number; thumb: string }) => { if (!done) { done = true; clearTimeout(to); v.removeAttribute("src"); v.load(); res(o); } };
    const to = setTimeout(() => fin({ w: v.videoWidth || 1920, h: v.videoHeight || 1080, duration: isFinite(v.duration) ? v.duration : 0, thumb: "" }), 10000);
    v.onloadedmetadata = () => { try { v.currentTime = Math.min(1, (v.duration || 0) / 3); } catch { fin({ w: v.videoWidth, h: v.videoHeight, duration: v.duration || 0, thumb: "" }); } };
    v.onseeked = () => fin({ w: v.videoWidth, h: v.videoHeight, duration: isFinite(v.duration) ? v.duration : 0, thumb: shot(v, v.videoWidth, v.videoHeight) });
    v.onerror = () => fin({ w: 0, h: 0, duration: 0, thumb: "" }); v.src = url;
  });
}
// a filmstrip: `n` frames across the video, side by side in one small JPEG (the timeline repeats it along a clip)
export function filmStrip(url: string, duration: number, n = 6, fh = 54): Promise<string> {
  return new Promise((res) => {
    const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto"; v.crossOrigin = "anonymous";
    let i = 0, cv: HTMLCanvasElement | null = null, x: CanvasRenderingContext2D | null = null, fw = 96; const T = (k: number) => Math.max(0.05, (duration || 1) * (k + 0.5) / n);
    const fin = (ok: boolean) => { clearTimeout(to); v.removeAttribute("src"); v.load(); res(ok && cv ? cv.toDataURL("image/jpeg", 0.7) : ""); };
    const to = setTimeout(() => fin(i > 0), 15000);
    v.onloadedmetadata = () => { fw = Math.round(fh * (v.videoWidth || 16) / (v.videoHeight || 9)); cv = Object.assign(document.createElement("canvas"), { width: fw * n, height: fh }); x = cv.getContext("2d"); try { v.currentTime = T(0); } catch { fin(false); } };
    v.onseeked = () => { try { x!.drawImage(v, i * fw, 0, fw, fh); } catch { return fin(false); } i++; if (i >= n) fin(true); else v.currentTime = T(i); };
    v.onerror = () => fin(false); v.src = url;
  });
}
// what an asset still lacks for the library and the timeline (a nooi result or a file from an older project): picture, length,
// filmstrip, waveform — made on this device, once, and kept in the project
export async function visualsFor(a: Asset): Promise<Partial<Asset> | null> {
  if (a.kind !== "video" && a.kind !== "audio") return null;
  const out: Partial<Asset> = {}; const u = await urlOf(a, false); if (!u) return null;
  if (a.kind === "video" && (!a.thumb || !a.duration || !a.w)) { const p = await probeVideo(u); if (p.w) Object.assign(out, { w: p.w, h: p.h, duration: a.duration || p.duration, thumb: a.thumb || p.thumb }); }
  if (a.kind === "video" && !a.strip) { const sp = await filmStrip(u, out.duration || a.duration || 0); if (sp) out.strip = sp; }
  if (!a.waveform && a.hasAudio !== false) { const b = await fileOf(a); if (b && b.size < 300 * 1024 * 1024) { const ab = await decodeSound(b); if (ab) { out.hasAudio = true; out.waveform = peaks(mono(ab), Math.min(2000, Math.max(100, Math.round(ab.duration * 25)))); if (a.kind === "audio" && !a.duration) out.duration = ab.duration; } else if (a.kind === "video") out.hasAudio = false; } }
  return Object.keys(out).length ? out : null;
}
function probeImage(url: string): Promise<{ w: number; h: number; thumb: string }> {
  return new Promise((res) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight, thumb: shot(im, im.naturalWidth, im.naturalHeight) }); im.onerror = () => res({ w: 0, h: 0, thumb: "" }); im.src = url; });
}
function shot(el: CanvasImageSource, w: number, h: number): string {
  try { if (!w || !h) return ""; const W = 160, H = 90, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d")!; x.fillStyle = "#111"; x.fillRect(0, 0, W, H); const s = Math.max(W / w, H / h); x.drawImage(el, (W - w * s) / 2, (H - h * s) / 2, w * s, h * s); return c.toDataURL("image/jpeg", 0.7); } catch { return ""; }
}
let actx: AudioContext | null = null;
export async function decodeSound(b: Blob): Promise<AudioBuffer | null> {
  if (b.size > 250e6) return null;
  try { actx = actx || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); return await actx.decodeAudioData(await b.arrayBuffer()); } catch { return null; }
}
const mono = (ab: AudioBuffer) => { const d = new Float32Array(ab.length); for (let c = 0; c < ab.numberOfChannels; c++) { const ch = ab.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] += ch[i] / ab.numberOfChannels; } return d; };
export const monoOf = mono;

export interface ImportResult { assets: Asset[]; skipped: string[] }
export async function importFiles(files: File[] | FileList, folder: string | null = null, onAsset?: (a: Asset) => void): Promise<ImportResult> {
  const out: Asset[] = [], skipped: string[] = [];
  for (const f of Array.from(files)) {
    const kind = kindOf(f); if (!kind) { skipped.push(f.name); continue; }
    if (f.size > 4 * 1024 ** 3) { skipped.push(f.name); continue; }
    const id = uid("a"), key = "f_" + id; await putFile(key, f);
    const a: Asset = { id, kind, name: f.name.replace(/\.\w+$/, "").slice(0, 80), src: "local:" + key, size: f.size, mime: f.type, folder, createdAt: Date.now() };
    const u = (await urlOf(a))!;
    if (kind === "video") { const p = await probeVideo(u); Object.assign(a, { w: p.w, h: p.h, duration: p.duration, thumb: p.thumb }); const sp = await filmStrip(u, p.duration); if (sp) a.strip = sp; }
    if (kind === "image") { const p = await probeImage(u); Object.assign(a, { w: p.w, h: p.h, thumb: p.thumb }); }
    if (kind === "video" || kind === "audio") {
      const ab = await decodeSound(f);
      if (ab) { a.hasAudio = true; if (kind === "audio") a.duration = ab.duration; a.waveform = peaks(mono(ab), Math.min(2000, Math.max(100, Math.round(ab.duration * 25)))); }
      else a.hasAudio = kind === "audio";
    }
    if (kind === "font") { try { const ff = new FontFace(a.name, await f.arrayBuffer()); await ff.load(); document.fonts.add(ff); } catch { /* not a font */ } }
    out.push(a); onAsset?.(a);
  }
  return { assets: out, skipped };
}
// send a device file to the account (the server's disk); returns the server address
// the file's path on this site when it is already on the server (/media/… from nooi or an upload, or a render-service upload),
// whether written as a path or as a full address on this same site; null for files only on this device or elsewhere
export function serverPath(src: string): string | null {
  let u: URL; try { u = new URL(src, SITE || location.href); } catch { return null; }
  if (u.origin !== (SITE ? new URL(SITE).origin : location.origin) || u.search || u.hash) return null;
  return /^\/media\/[A-Za-z0-9._-]+$/.test(u.pathname) || /^\/render-api\/uploads\/[A-Za-z0-9_-]+\.[a-z0-9]+$/.test(u.pathname) ? u.pathname : null;
}
export async function uploadAsset(a: Asset, onProgress?: (k: number) => void): Promise<string | null> {
  if (!a.src.startsWith("local:") || !api.online || !api.me.signedIn) return null;
  const b = await getFile(a.src.slice(6)); if (!b) return null;
  try { return await api.upload(b, a.name + extOf(a), onProgress); } catch { return null; }
}
const extOf = (a: Asset) => (a.mime ? "." + (a.mime.split("/")[1] || "bin").replace("quicktime", "mov").replace("mpeg", "mp3") : "");
// a finished nooi.ai job (a video, a picture, a sound) as an asset
export function assetFromJob(j: { id: string; kind: string; resultUrl?: string; title?: string; prompt?: string; dur?: number; aspect?: string }): Asset | null {
  if (!j.resultUrl) return null;
  const kind: AssetKind | null = j.kind === "video" || j.kind === "chapter" || /\.(mp4|webm|mov)(\?|$)/i.test(j.resultUrl) ? "video" : j.kind === "image" || /\.(png|jpe?g|webp)(\?|$)/i.test(j.resultUrl) ? "image" : /\.(mp3|wav|m4a|ogg)(\?|$)/i.test(j.resultUrl) || j.kind === "voice" || j.kind === "music" ? "audio" : null;
  if (!kind) return null;
  const [aw, ah] = (j.aspect || "16:9").split(":").map(Number);
  return { id: "j_" + j.id, kind, name: String(j.title || j.prompt || j.kind).slice(0, 80), src: j.resultUrl, duration: j.dur, w: aw * 120, h: ah * 120, job: j.id, createdAt: Date.now(), hasAudio: kind !== "image" };
}
