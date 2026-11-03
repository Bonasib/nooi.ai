// .nooipack (spec §1, §8.7): one file that carries a project to another device — the .nooi project, every media file it uses
// (videos, pictures, sounds, fonts, LUTs) and the sound waveforms (.nooipeaks). It is a standard ZIP: media is stored as it is
// (it is already compressed), the project and waveforms are deflated. Opening one puts the media on this device and relinks it.
import { fromNooi, isNooi, toNooi } from "@nooi/editor-core";
import type { Project } from "@nooi/editor-core";
import { fileOf } from "./library";
import { putFile } from "./idb";

const enc = new TextEncoder();
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
async function crc32(b: Blob): Promise<number> {
  let c = 0xffffffff; const r = b.stream().getReader();
  for (;;) { const { done, value } = await r.read(); if (done) break; for (let i = 0; i < value.length; i++) c = CRC_T[(c ^ value[i]) & 0xff] ^ (c >>> 8); }
  return (c ^ 0xffffffff) >>> 0;
}
const canDeflate = () => typeof CompressionStream !== "undefined";
const deflate = (b: Blob) => new Response(b.stream().pipeThrough(new CompressionStream("deflate-raw" as CompressionFormat))).blob();
const inflate = (b: Blob) => new Response(b.stream().pipeThrough(new DecompressionStream("deflate-raw" as CompressionFormat))).blob();
const safe = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").trim().slice(0, 80) || "file";
const EXT: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/ogg": "ogg", "audio/webm": "webm", "audio/mp4": "m4a", "font/ttf": "ttf", "font/otf": "otf", "font/woff2": "woff2" };

export async function makePack(p: Project, onStep?: (k: number, name: string) => void): Promise<{ blob: Blob; name: string; files: number; missing: string[] }> {
  const items: { name: string; data: Blob; deflate: boolean }[] = []; const missing: string[] = [];
  const doc = toNooi(p) as { mediaBin: { assetId: string; packPath?: string }[] };
  const assets = Object.values(p.assets); let i = 0;
  for (const a of assets) {
    onStep?.(i++ / Math.max(1, assets.length), a.name);
    const b = await fileOf(a).catch(() => null); if (!b) { missing.push(a.name); continue; }
    const ext = EXT[b.type] || (a.kind === "lut" ? "cube" : a.kind === "font" ? "ttf" : "bin");
    const path = "media/" + a.id + "/" + safe(a.name) + "." + ext; items.push({ name: path, data: b, deflate: false });
    const row = doc.mediaBin.find((x) => x.assetId === a.id); if (row) row.packPath = path;
    if (a.waveform?.length) items.push({ name: "peaks/" + a.id + ".nooipeaks", data: new Blob([JSON.stringify({ format: "nooipeaks/1", peaks: a.waveform })]), deflate: true });
  }
  items.unshift({ name: "project.nooi", data: new Blob([JSON.stringify(doc)], { type: "application/json" }), deflate: true });
  // the ZIP: local header + data for each file, then the central directory
  const parts: BlobPart[] = [], central: Uint8Array<ArrayBuffer>[] = []; let off = 0;
  for (const it of items) {
    const crc = await crc32(it.data); const use = it.deflate && canDeflate(); const data = use ? await deflate(it.data) : it.data;
    if (off + data.size > 0xfffffff0) throw new Error("too big");
    const nm = enc.encode(it.name) as Uint8Array<ArrayBuffer>, h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, use ? 8 : 0, true); h.setUint32(10, 0x00210000, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.size, true); h.setUint32(22, it.data.size, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
    parts.push(h.buffer, nm, data);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, use ? 8 : 0, true);
    c.setUint32(12, 0x00210000, true); c.setUint32(16, crc, true); c.setUint32(20, data.size, true); c.setUint32(24, it.data.size, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    const row = new Uint8Array(46 + nm.length); row.set(new Uint8Array(c.buffer), 0); row.set(nm, 46); central.push(row);
    off += 30 + nm.length + data.size;
  }
  const cdSize = central.reduce((s, r) => s + r.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, items.length, true); e.setUint16(10, items.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
  onStep?.(1, "");
  return { blob: new Blob([...parts, ...central, e.buffer], { type: "application/zip" }), name: safe(p.name || "project") + ".nooipack", files: items.length - 1, missing };
}

export const isZip = async (f: Blob) => { const b = new Uint8Array(await f.slice(0, 4).arrayBuffer()); return b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4; };
async function entries(f: Blob): Promise<Map<string, () => Promise<Blob>>> {
  const tail = new DataView(await f.slice(Math.max(0, f.size - 65557)).arrayBuffer()); let e = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error("not a nooipack");
  const n = tail.getUint16(e + 10, true), cdSize = tail.getUint32(e + 12, true), cdOff = tail.getUint32(e + 16, true);
  const cd = new DataView(await f.slice(cdOff, cdOff + cdSize).arrayBuffer()); const out = new Map<string, () => Promise<Blob>>(); const dec = new TextDecoder();
  for (let i = 0, k = 0; k < n; k++) {
    if (cd.getUint32(i, true) !== 0x02014b50) break;
    const method = cd.getUint16(i + 10, true), size = cd.getUint32(i + 20, true), nl = cd.getUint16(i + 28, true), xl = cd.getUint16(i + 30, true), cl = cd.getUint16(i + 32, true), lo = cd.getUint32(i + 42, true);
    const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + i + 46, nl));
    out.set(name, async () => { const lh = new DataView(await f.slice(lo, lo + 30).arrayBuffer()); const start = lo + 30 + lh.getUint16(26, true) + lh.getUint16(28, true); const raw = f.slice(start, start + size); return method === 8 ? inflate(raw) : raw; });
    i += 46 + nl + xl + cl;
  }
  return out;
}
/** open a .nooipack: the project, with its media put on this device */
export async function openPack(f: Blob): Promise<{ project: Project; files: number }> {
  const es = await entries(f); const pj = es.get("project.nooi"); if (!pj) throw new Error("no project in this file");
  const doc = JSON.parse(await (await pj()).text()); if (!isNooi(doc)) throw new Error("not a nooi project");
  let files = 0;
  for (const row of (doc.mediaBin || []) as { assetId: string; packPath?: string; sourceUri?: string; proxyUri?: string | null; ext?: { mime?: string } }[]) {
    const get = row.packPath && es.get(row.packPath); if (!get) continue;
    const b = await get(); const key = "pk_" + row.assetId + "_" + Date.now().toString(36);
    await putFile(key, b.type ? b : new Blob([b], { type: row.ext?.mime || "" })); row.sourceUri = "local:" + key; row.proxyUri = null; files++;
  }
  return { project: fromNooi(doc), files };
}
