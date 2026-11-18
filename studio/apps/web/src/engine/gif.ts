// An animated GIF from RGBA frames: one 256-colour palette per frame (6×7×6 cube + greys), ordered dithering, LZW.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((x) => (x / 16 - 0.5) * 24);
const PAL = (() => { const p: number[] = []; for (let r = 0; r < 6; r++) for (let g = 0; g < 7; g++) for (let b = 0; b < 6; b++) p.push(Math.round((r * 255) / 5), Math.round((g * 255) / 6), Math.round((b * 255) / 5)); for (let i = 0; i < 4; i++) p.push(...Array(3).fill(Math.round(((i + 1) * 255) / 5))); while (p.length < 768) p.push(0); return p; })();
function index(px: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, d = BAYER[(y & 3) * 4 + (x & 3)];
    const r = Math.round(Math.max(0, Math.min(255, px[i] + d)) / 51), g = Math.round(Math.max(0, Math.min(255, px[i + 1] + d)) / 42.5), b = Math.round(Math.max(0, Math.min(255, px[i + 2] + d)) / 51);
    out[y * w + x] = r * 42 + g * 6 + b;
  }
  return out;
}
function lzw(ix: Uint8Array, out: number[]) {
  const clear = 256, eoi = 257; out.push(8);
  let size = 9, next = 258, dict = new Map<number, number>(); const bytes: number[] = []; let cur = 0, bits = 0;
  const emit = (c: number) => { cur |= c << bits; bits += size; while (bits >= 8) { bytes.push(cur & 255); cur >>>= 8; bits -= 8; } };
  emit(clear); let w = ix[0];
  for (let i = 1; i < ix.length; i++) {
    const k = ix[i], key = w * 256 + k, hit = dict.get(key);
    if (hit !== undefined) { w = hit; continue; }
    emit(w);
    if (next < 4096) { dict.set(key, next++); if (next > 1 << size && size < 12) size++; } else { emit(clear); dict = new Map(); size = 9; next = 258; }
    w = k;
  }
  emit(w); emit(eoi); if (bits > 0) bytes.push(cur & 255);
  for (let i = 0; i < bytes.length; i += 255) { const n = Math.min(255, bytes.length - i); out.push(n); for (let j = 0; j < n; j++) out.push(bytes[i + j]); }
  out.push(0);
}
export function encodeGif(frames: Uint8Array[], w: number, h: number, delayCs: number): Blob {
  const o: number[] = [...Array.from("GIF89a").map((c) => c.charCodeAt(0)), w & 255, w >> 8, h & 255, h >> 8, 0xf7, 0, 0, ...PAL,
    0x21, 0xff, 11, ...Array.from("NETSCAPE2.0").map((c) => c.charCodeAt(0)), 3, 1, 0, 0, 0];
  const parts: BlobPart[] = [new Uint8Array(o)];
  for (const f of frames) {
    const b: number[] = [0x21, 0xf9, 4, 0, delayCs & 255, delayCs >> 8, 0, 0, 0x2c, 0, 0, 0, 0, w & 255, w >> 8, h & 255, h >> 8, 0];
    lzw(index(f, w, h), b); parts.push(new Uint8Array(b));
  }
  parts.push(new Uint8Array([0x3b]));
  return new Blob(parts, { type: "image/gif" });
}
