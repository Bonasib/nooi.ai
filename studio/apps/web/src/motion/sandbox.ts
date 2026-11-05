// Motion code runs here: a worker started inside a sealed frame (its own empty origin: no access to the page, the account, the
// saved projects or the cookies). It draws one frame on its own canvas and sends back the picture. Too slow → the frame stops it.
import { Motion } from "@nooi/editor-core";

type Req = { req: number; code: string; p: Record<string, unknown>; W: number; H: number; frame: number; fps: number; dur: number; audio: number; bars: number[] };
const g = self as unknown as Record<string, unknown>;
// (the frame's policy already blocks every network request; the doors are also taken away, down the prototype chain)
for (const k of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "indexedDB", "caches", "Worker", "SharedWorker", "WebTransport", "FontFace", "fonts", "BroadcastChannel", "navigator", "location"]) {
  for (let o: object | null = g; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) if (o === g || Object.prototype.hasOwnProperty.call(o, k)) { try { Object.defineProperty(o, k, { value: undefined, writable: false, configurable: false }); } catch { /* */ } }
}
const fns = new Map<string, (m: unknown, M: typeof Motion) => void>(); let cv: OffscreenCanvas | null = null;
const resample = (b: number[], n: number) => Array.from({ length: Math.max(1, Math.round(n)) }, (_, i) => b[Math.min(b.length - 1, Math.floor((i / Math.max(1, n)) * b.length))] || 0);

self.onmessage = (e: MessageEvent<Req>) => {
  const d = e.data;
  try {
    let f = fns.get(d.code);
    if (!f) { f = new Function("m", "M", '"use strict";\n' + d.code) as (m: unknown, M: typeof Motion) => void; fns.set(d.code, f); if (fns.size > 24) fns.delete(fns.keys().next().value!); }
    if (!cv || cv.width !== d.W || cv.height !== d.H) cv = new OffscreenCanvas(d.W, d.H);
    const ctx = cv.getContext("2d")!; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.clearRect(0, 0, d.W, d.H); ctx.save();
    f({ ctx, W: d.W, H: d.H, u: Math.min(d.W, d.H), frame: d.frame, fps: d.fps, t: d.frame / d.fps, dur: d.dur, durF: Math.round(d.dur * d.fps), p: d.p, audio: () => d.audio, bars: (n: number) => resample(d.bars, n) }, Motion);
    ctx.restore(); const bmp = cv.transferToImageBitmap(); (self as unknown as Worker).postMessage({ req: d.req, bmp }, [bmp]);
  } catch (err) { (self as unknown as Worker).postMessage({ req: d.req, err: String((err as Error)?.message || err).slice(0, 300) }); }
};
