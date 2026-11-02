// Every upload is checked before it is kept: what the bytes really are (not the name), the size, and ClamAV when it is configured.
import fs from "node:fs";
import net from "node:net";
import { CFG } from "./config";

const SIGS: [string, (b: Buffer) => boolean][] = [
  ["video/mp4", (b) => b.slice(4, 8).toString() === "ftyp" && !/^(qt  )/.test(b.slice(8, 12).toString())],
  ["video/quicktime", (b) => b.slice(4, 8).toString() === "ftyp" || b.slice(4, 8).toString() === "moov"],
  ["video/webm", (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3],
  ["image/png", (b) => b[0] === 0x89 && b.slice(1, 4).toString() === "PNG"],
  ["image/jpeg", (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ["image/gif", (b) => b.slice(0, 4).toString() === "GIF8"],
  ["image/webp", (b) => b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP"],
  ["audio/wav", (b) => b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WAVE"],
  ["audio/mpeg", (b) => b.slice(0, 3).toString() === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)],
  ["audio/ogg", (b) => b.slice(0, 4).toString() === "OggS"],
  ["audio/flac", (b) => b.slice(0, 4).toString() === "fLaC"],
  ["text/x-cube", (b) => /^(\s*#.*\n|\s*TITLE.*\n|\s*LUT_3D_SIZE)/m.test(b.slice(0, 512).toString("latin1")) && /LUT_3D_SIZE/.test(b.toString("latin1"))],
];
export function sniff(file: string): string | null {
  const fd = fs.openSync(file, "r"); const b = Buffer.alloc(4096); const n = fs.readSync(fd, b, 0, 4096, 0); fs.closeSync(fd);
  const head = b.slice(0, n); for (const [m, f] of SIGS) { try { if (f(head)) return m; } catch { /* */ } } return null;
}
export const EXT: Record<string, string> = { "video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm", "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp", "audio/wav": ".wav", "audio/mpeg": ".mp3", "audio/ogg": ".ogg", "audio/flac": ".flac", "text/x-cube": ".cube" };
// clamd INSTREAM: "clean", "infected: <name>" or "skipped" when no scanner is configured
export function clamScan(file: string): Promise<string> {
  if (!CFG.clamHost) return Promise.resolve("skipped");
  return new Promise((res, rej) => {
    const s = net.connect(CFG.clamPort, CFG.clamHost); let out = ""; s.setTimeout(120_000, () => { s.destroy(); rej(new Error("scan timeout")); });
    s.on("connect", () => { s.write("zINSTREAM\0"); const rs = fs.createReadStream(file, { highWaterMark: 64 * 1024 });
      rs.on("data", (c) => { const buf = Buffer.isBuffer(c) ? c : Buffer.from(c); const len = Buffer.alloc(4); len.writeUInt32BE(buf.length); s.write(len); s.write(buf); });
      rs.on("end", () => s.write(Buffer.alloc(4))); rs.on("error", rej); });
    s.on("data", (d) => { out += d.toString(); }); s.on("end", () => { const r = out.replace(/\0/g, "").trim(); res(/OK$/.test(r) ? "clean" : /FOUND$/.test(r) ? "infected: " + r.replace(/^stream:\s*/, "").replace(/\s*FOUND$/, "") : "error: " + r); });
    s.on("error", rej);
  });
}
