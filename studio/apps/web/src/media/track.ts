// (v277) Tracking on this device: the clip's own frames are decoded (WebCodecs, through mediabunny) as small grey pictures,
// 10 a second, and the picked box is followed through them (editor-core trackFrames). No server, no graphics card needed.
import { ALL_FORMATS, BlobSource, CanvasSink, Input } from "mediabunny";
import { trackFrames, type Gray, type MediaClip, type Project, type TrackPath } from "@nooi/editor-core";
import { fileOf } from "./library";

const STEP = 0.1, W = 240, MAX_SECS = 180;

export async function trackClip(p: Project, c: MediaClip, box: [number, number, number, number], onProgress?: (k: number) => void, signal?: AbortSignal): Promise<TrackPath> {
  const a = p.assets[c.asset]; if (!a || a.kind !== "video") throw new Error("Tracking works on videos.");
  const b = await fileOf(a); if (!b) throw new Error("This video isn't on this device.");
  const inp = new Input({ source: new BlobSource(b), formats: ALL_FORMATS });
  try {
    const vt = await inp.getPrimaryVideoTrack(); if (!vt) throw new Error("No picture in this file.");
    const h = Math.max(2, Math.round((W * (vt.displayHeight || 9)) / (vt.displayWidth || 16) / 2) * 2);
    const sink = new CanvasSink(vt, { width: W, height: h, fit: "fill", poolSize: 1 });
    const secs = Math.min(MAX_SECS, c.dur); const times: number[] = []; for (let s = 0; s <= secs + 1e-6; s += STEP) times.push(s);
    const frames: Gray[] = [];
    for (let i = 0; i < times.length; i++) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      const local = times[i]; const src = c.reverse ? c.in + (c.dur - local) * c.speed : c.in + local * c.speed;
      const w = await sink.getCanvas(Math.max(0, src)); const cv = w?.canvas as HTMLCanvasElement | OffscreenCanvas | undefined;
      const g = new Float32Array(W * h);
      if (cv) { const x = (cv as OffscreenCanvas).getContext("2d") as OffscreenCanvasRenderingContext2D; const d = x.getImageData(0, 0, W, h).data; for (let k = 0, j = 0; k < g.length; k++, j += 4) g[k] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2]; }
      frames.push({ data: g, w: W, h }); onProgress?.((i + 1) / times.length * 0.8);
    }
    const cs = trackFrames(frames, box); onProgress?.(1);
    return { box, pts: cs.map((q, i) => [+times[i].toFixed(3), +q[0].toFixed(5), +q[1].toFixed(5)] as [number, number, number]), lock: c.track?.lock || 0 };
  } finally { try { inp.dispose(); } catch { /* */ } }
}
