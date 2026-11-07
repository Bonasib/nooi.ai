// (v234) Cut out the person on this device — no green screen needed. MediaPipe's selfie segmenter (Apache-2.0, served by our own
// server from /studio/vendor, nothing sent anywhere) finds the person in every frame. A video becomes a cut-out: the picture on the
// top half and its see-through mask (grey) on the bottom half, which the preview, the device export and FFmpeg all read
// (asset alpha "stacked"); a picture becomes a PNG with real transparency. Free, no credits.
import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, QUALITY_HIGH, WebMOutputFormat, getFirstEncodableVideoCodec } from "mediabunny";
import type { Asset } from "@nooi/editor-core";
import { uid } from "@nooi/editor-core";
import { fileOf } from "./library";
import { putFile } from "./idb";

const BASE = (import.meta.env.BASE_URL || "/studio/") + "vendor/mediapipe-0.10.21/";
const abs = (f: string) => new URL(BASE + f, location.href).href;
interface Mask { width: number; height: number; getAsFloat32Array(): Float32Array; close(): void }
interface SegResult { confidenceMasks?: Mask[]; close(): void }
interface Seg { segmentForVideo(img: TexImageSource, ts: number): SegResult }
let seg: Promise<Seg> | null = null, clock = 0;
/** the person finder (downloaded once, about 10 MB, then kept by the browser) */
export function finder(): Promise<Seg> {
  if (!seg) seg = (async () => {
    const V = await import(/* @vite-ignore */ abs("vision_bundle.mjs"));
    return (await V.ImageSegmenter.createFromOptions({ wasmLoaderPath: abs("vision_wasm_internal.js"), wasmBinaryPath: abs("vision_wasm_internal.wasm") },
      { baseOptions: { modelAssetPath: abs("selfie_segmenter.tflite"), delegate: "CPU" }, runningMode: "VIDEO", outputConfidenceMasks: true, outputCategoryMask: false })) as Seg;
  })().catch((e) => { seg = null; throw e; });
  return seg;
}
const even = (x: number) => Math.max(2, Math.round(x / 2) * 2);
const ss = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** (v243) the person's raw confidence (0..1) for a picture, at the model's own size — for finding where they are */
export function personConf(S: Seg, img: TexImageSource): { w: number; h: number; f: Float32Array } | null {
  const r = S.segmentForVideo(img, (clock += 33)); const ms = r.confidenceMasks || []; const m = ms[ms.length - 1];
  if (!m) { r.close(); return null; } const out = { w: m.width, h: m.height, f: new Float32Array(m.getAsFloat32Array()) }; r.close(); return out;
}
/** the person's mask of a picture, as a small grey canvas (soft edges pulled in a little, so no rim of the old background; steadied against the frame before when given) */
export class Matte {
  private prev: Float32Array | null = null; cv: OffscreenCanvas | null = null;
  constructor(private S: Seg) {}
  of(img: TexImageSource, smooth = true): OffscreenCanvas {
    const r = this.S.segmentForVideo(img, (clock += 33)); const ms = r.confidenceMasks || []; const m = ms[ms.length - 1];
    if (!m) { r.close(); throw new Error("no mask"); }
    const w = m.width, h = m.height, f = m.getAsFloat32Array(); if (!this.cv || this.cv.width !== w || this.cv.height !== h) { this.cv = new OffscreenCanvas(w, h); this.prev = null; }
    const id = new ImageData(w, h), d = id.data, pv = smooth ? this.prev : null, next = new Float32Array(f.length);
    for (let i = 0; i < f.length; i++) { const v = pv ? f[i] * 0.65 + pv[i] * 0.35 : f[i]; next[i] = v; const a = Math.round(ss(0.42, 0.9, v) * 255); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = a; d[i * 4 + 3] = 255; }
    this.prev = next; this.cv.getContext("2d")!.putImageData(id, 0, 0); r.close(); return this.cv;
  }
}
function checker(x: OffscreenCanvasRenderingContext2D, w: number, h: number) {
  const s = Math.max(4, Math.round(h / 8)); x.fillStyle = "#3a3d44"; x.fillRect(0, 0, w, h); x.fillStyle = "#24262b";
  for (let yy = 0; yy < h; yy += s) for (let xx = (yy / s) % 2 ? s : 0; xx < w; xx += s * 2) x.fillRect(xx, yy, s, s);
}
const dataUrl = async (cv: OffscreenCanvas) => { const b = await cv.convertToBlob({ type: "image/jpeg", quality: 0.7 }); return await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(b); }); };

export interface CutResult { asset: Asset; from: number }
/** a video's seconds [from, to] cut out: a new asset (kept on this device) — the sound stays with the original clip */
export async function cutoutVideo(a: Asset, from: number, to: number, o: { onProgress?: (k: number) => void; signal?: AbortSignal } = {}): Promise<CutResult> {
  const f = await fileOf(a); if (!f) throw new Error("file");
  const S = await finder(), matte = new Matte(S);
  const input = new Input({ source: new BlobSource(f), formats: ALL_FORMATS }); const vt = await input.getPrimaryVideoTrack(); if (!vt) throw new Error("video");
  const W0 = vt.displayWidth, H0 = vt.displayHeight, k = Math.min(1, 1920 / W0, 1080 / H0), w = even(W0 * k), h = even(H0 * k);
  const dur0 = await input.computeDuration(); to = Math.min(to, dur0); from = Math.max(0, Math.min(from, to - 0.05));
  let format: WebMOutputFormat | Mp4OutputFormat = new WebMOutputFormat();
  let codec = await getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), { width: w, height: h * 2 });
  if (!codec) { format = new Mp4OutputFormat({ fastStart: "in-memory" }); codec = await getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), { width: w, height: h * 2 }); }
  if (!codec) throw Object.assign(new Error("This browser can't encode video here."), { code: "NO_ENCODER" });
  const out = new Output({ format, target: new BufferTarget() });
  const pic = new OffscreenCanvas(w, h), px = pic.getContext("2d")!, cv = new OffscreenCanvas(w, h * 2), x = cv.getContext("2d")!;
  const sh = 54, sw = Math.round((sh * w) / h), N = 6, strip = new OffscreenCanvas(sw * N, sh), sx = strip.getContext("2d")!, thumb = new OffscreenCanvas(160, 90), tx = thumb.getContext("2d")!;
  let shot = 0, thumbDone = false; const len = to - from;
  const conv = await Conversion.init({ input, output: out, trim: { start: from, end: to }, showWarnings: false, audio: { discard: true },
    video: { forceTranscode: true, codec, bitrate: QUALITY_HIGH, width: w, height: h, fit: "fill", processedWidth: w, processedHeight: h * 2, keyFrameInterval: 2,
      process: (s) => {
        if (o.signal?.aborted) throw new DOMException("Cancelled", "AbortError");
        px.clearRect(0, 0, w, h); s.draw(px, 0, 0, w, h);
        const m = matte.of(pic);
        x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
        x.drawImage(pic, 0, 0); x.drawImage(m, 0, 0, m.width, m.height, 0, h, w, h);
        const tt = s.timestamp - from;
        // the library's pictures: the person over a grey checker
        const put = (c: OffscreenCanvasRenderingContext2D, X: number, Y: number, ww: number, hh: number) => {
          const tmp = new OffscreenCanvas(ww, hh), t2 = tmp.getContext("2d")!; t2.drawImage(m, 0, 0, ww, hh); t2.globalCompositeOperation = "source-in"; t2.drawImage(pic, 0, 0, ww, hh);
          const ck = new OffscreenCanvas(ww, hh), c2 = ck.getContext("2d")!; checker(c2, ww, hh); const al = c2.getImageData(0, 0, ww, hh);
          const md = new OffscreenCanvas(ww, hh), m2 = md.getContext("2d")!; m2.drawImage(m, 0, 0, ww, hh); const mm = m2.getImageData(0, 0, ww, hh).data, pp = (() => { const q = new OffscreenCanvas(ww, hh), q2 = q.getContext("2d")!; q2.drawImage(pic, 0, 0, ww, hh); return q2.getImageData(0, 0, ww, hh).data; })();
          for (let i = 0; i < al.data.length; i += 4) { const k2 = mm[i] / 255; for (let j = 0; j < 3; j++) al.data[i + j] = al.data[i + j] * (1 - k2) + pp[i + j] * k2; }
          c.putImageData(al, X, Y); };
        while (shot < N && tt >= (len * (shot + 0.5)) / N - 1e-3) { put(sx, shot * sw, 0, sw, sh); shot++; }
        if (!thumbDone && tt >= len * 0.4) { const hh = 90, ww = Math.round((hh * w) / h); const tmp = new OffscreenCanvas(ww, hh); put(tmp.getContext("2d")!, 0, 0, ww, hh); checker(tx, 160, 90); tx.drawImage(tmp, (160 - ww) / 2, 0); thumbDone = true; }
        o.onProgress?.(Math.min(0.99, tt / Math.max(0.05, len)));
        return cv;
      } } });
  if (!conv.isValid) throw new Error("This video can't be read here.");
  if (o.signal) o.signal.addEventListener("abort", () => void conv.cancel(), { once: true });
  await conv.execute();
  const mp4 = format instanceof Mp4OutputFormat, blob = new Blob([(out.target as BufferTarget).buffer!], { type: mp4 ? "video/mp4" : "video/webm" });
  const id = uid("a"), key = "f_" + id; await putFile(key, blob);
  const asset: Asset = { id, kind: "video", name: (a.name + " · cut-out").slice(0, 80), src: "local:" + key, size: blob.size, mime: blob.type, w, h, duration: Math.round(len * 1000) / 1000, fps: a.fps,
    hasAudio: false, alpha: "stacked", folder: a.folder ?? null, createdAt: Date.now(), thumb: thumbDone ? await dataUrl(thumb) : undefined, strip: shot ? await dataUrl(strip) : undefined };
  o.onProgress?.(1); return { asset, from };
}

/** a picture cut out: a PNG with real transparency */
export async function cutoutImage(a: Asset): Promise<Asset> {
  const f = await fileOf(a); if (!f) throw new Error("file");
  const bm = await createImageBitmap(f), W0 = bm.width, H0 = bm.height, k = Math.min(1, 4096 / Math.max(W0, H0)), w = Math.round(W0 * k), h = Math.round(H0 * k);
  const S = await finder(), pic = new OffscreenCanvas(w, h), px = pic.getContext("2d")!; px.drawImage(bm, 0, 0, w, h); bm.close();
  const m = new Matte(S).of(pic, false), mk = new OffscreenCanvas(w, h), mx = mk.getContext("2d")!; mx.imageSmoothingQuality = "high"; mx.drawImage(m, 0, 0, w, h);
  const md = mx.getImageData(0, 0, w, h).data, im = px.getImageData(0, 0, w, h); for (let i = 0; i < md.length; i += 4) im.data[i + 3] = md[i];
  px.putImageData(im, 0, 0); const blob = await pic.convertToBlob({ type: "image/png" });
  const tb = new OffscreenCanvas(160, 90), t2 = tb.getContext("2d")!; checker(t2, 160, 90); const s = Math.min(160 / w, 90 / h); t2.drawImage(pic, (160 - w * s) / 2, (90 - h * s) / 2, w * s, h * s);
  const id = uid("a"), key = "f_" + id; await putFile(key, blob);
  return { id, kind: "image", name: (a.name + " · cut-out").slice(0, 80), src: "local:" + key, size: blob.size, mime: "image/png", w, h, folder: a.folder ?? null, createdAt: Date.now(), thumb: await dataUrl(tb) };
}
