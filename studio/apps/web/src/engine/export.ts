// Export on this device: frames decoded with WebCodecs (mediabunny), drawn by the same compositor as the preview at full size,
// encoded to MP4 (H.264/AAC), WebM (VP9/Opus) or MOV; GIF and WAV/MP3 too. Nothing is uploaded and no credits are used.
import {
  ALL_FORMATS, AudioBufferSource, BlobSource, BufferTarget, CanvasSink, CanvasSource, Input, MovOutputFormat, Mp3OutputFormat, Mp4OutputFormat, Output,
  QUALITY_HIGH, QUALITY_MEDIUM, QUALITY_LOW, WebMOutputFormat, getFirstEncodableAudioCodec, getFirstEncodableVideoCodec, canEncodeAudio,
} from "mediabunny";
import { clipEnd, duckGain, duration, frameSize, gainAt, aspectOf, layersAt, srcLimit, sourceTime } from "@nooi/editor-core";
import type { Asset, ExportSettings, MediaClip, Project } from "@nooi/editor-core";
import { Compositor, parseCube } from "./compositor";
import { drawMoment, type Frame } from "./render";
import { decodeSound, fileOf } from "../media/library";
import { encodeGif } from "./gif";
import { encodeWav } from "./wav";

export interface ExportOpts extends ExportSettings { range?: [number, number]; onProgress?: (k: number, note: string) => void; signal?: AbortSignal; width?: number; height?: number }
export interface ExportResult { blob: Blob; name: string; mime: string; width: number; height: number; seconds: number }

class Cursor {            // frames of one clip, decoded in order (fast), or one by one when the clip runs backwards / is frozen
  private it: AsyncGenerator<{ canvas: HTMLCanvasElement | OffscreenCanvas; timestamp: number; duration: number }, void, unknown> | null = null;
  private cur: { canvas: HTMLCanvasElement | OffscreenCanvas; timestamp: number; duration: number } | null = null;
  private nxt: typeof this.cur = null;
  constructor(private sink: CanvasSink, private start: number, private random: boolean) {}
  async at(t: number) {
    if (this.random) { const w = await this.sink.getCanvas(t); return w ? w.canvas : null; }
    if (!this.it) { this.it = this.sink.canvases(Math.max(0, this.start - 0.001)); this.nxt = (await this.it.next()).value || null; }
    while (this.nxt && this.nxt.timestamp <= t + 1e-4) { this.cur = this.nxt; const r = await this.it.next(); this.nxt = r.done ? null : r.value; }
    return (this.cur || this.nxt)?.canvas || null;
  }
}

export async function exportProject(p: Project, o: ExportOpts): Promise<ExportResult> {
  const report = o.onProgress || (() => undefined);
  const [t0, t1] = o.range || [0, duration(p)]; const secs = Math.max(0.1, t1 - t0);
  const { w, h } = o.width && o.height ? { w: o.width, h: o.height } : frameSize(aspectOf(p.width, p.height), o.res);
  const fps = o.format === "gif" ? Math.min(15, o.fps) : o.fps;
  const name = (p.name || "nooi").replace(/[^\p{L}\p{N} _-]+/gu, "").trim().slice(0, 60) || "nooi";
  if (o.format === "wav" || o.format === "mp3") {
    report(0, "sound"); const ab = await mixSound(p, t0, t1, o.signal);
    if (o.format === "wav") return { blob: encodeWav(ab), name: name + ".wav", mime: "audio/wav", width: 0, height: 0, seconds: secs };
    const { registerMp3Encoder } = await import("@mediabunny/mp3-encoder"); if (!(await canEncodeAudio("mp3"))) registerMp3Encoder();
    const out = new Output({ format: new Mp3OutputFormat(), target: new BufferTarget() }); const src = new AudioBufferSource({ codec: "mp3", bitrate: 192e3 });
    out.addAudioTrack(src); await out.start(); await src.add(ab); await out.finalize();
    return { blob: new Blob([(out.target as BufferTarget).buffer!], { type: "audio/mpeg" }), name: name + ".mp3", mime: "audio/mpeg", width: 0, height: 0, seconds: secs };
  }
  // ---- frames
  const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
  const comp = new Compositor(canvas); comp.resize(w, h);
  const inputs = new Map<string, Input>(), sinks = new Map<string, CanvasSink>(), cursors = new Map<string, Cursor>(), imgs = new Map<string, ImageBitmap>(), luts = new Map<string, { tex: WebGLTexture; size: number }>();
  const need = new Set<string>(); for (const t of p.tracks) for (const c of t.clips) if (c.type === "media") need.add(c.asset);
  report(0, "media");
  for (const id of need) {
    const a = p.assets[id]; if (!a) continue; const b = await fileOf(a); if (!b) continue;
    if (a.kind === "image") { try { imgs.set(id, await createImageBitmap(b)); } catch { /* unreadable */ } }
    if (a.kind === "video") { const inp = new Input({ source: new BlobSource(b), formats: ALL_FORMATS }); inputs.set(id, inp); const vt = await inp.getPrimaryVideoTrack(); if (vt) sinks.set(id, new CanvasSink(vt, { poolSize: 2 })); }
    if (a.kind === "lut") { try { const { size, data } = parseCube(await b.text()); luts.set(id, { tex: comp.makeLut(data, size), size }); } catch { /* bad lut */ } }
  }
  for (const t of p.tracks) for (const c of t.clips) if (c.type === "media" && c.lut && !luts.has(c.lut.asset)) { const a = p.assets[c.lut.asset]; const b = a && await fileOf(a); if (b) { try { const { size, data } = parseCube(await b.text()); luts.set(c.lut.asset, { tex: comp.makeLut(data, size), size }); } catch { /* */ } } }
  const frames = Math.max(1, Math.round(secs * fps));
  const frameAt = async (t: number) => {
    const ready = new Map<string, Frame>();
    for (const L of layersAt(p, t)) {
      const c = L.clip; if (c.type !== "media") continue; const a = p.assets[c.asset]; if (!a) continue;
      if (a.kind === "image") { const im = imgs.get(a.id); if (im) ready.set(c.id, { src: im, w: im.width, h: im.height, key: "i:" + a.id, dynamic: false }); continue; }
      const sink = sinks.get(a.id); if (!sink) continue;
      let cur = cursors.get(c.id); if (!cur) { cur = new Cursor(sink, (c as MediaClip).in, (c as MediaClip).reverse || (c as MediaClip).freeze != null || (c as MediaClip).speed > 4); cursors.set(c.id, cur); }
      const cv = await cur.at(sourceTime(c as MediaClip, L.local, srcLimit(p, c)));
      if (cv) ready.set(c.id, { src: cv as unknown as TexImageSource, w: cv.width, h: cv.height, key: "v:" + c.id, dynamic: true });
    }
    drawMoment(comp, p, t, (c) => ready.get(c.id) || null, (id) => luts.get(id) || null);
  };
  try {
    if (o.format === "gif") {
      const gw = Math.min(w, 480), gh = Math.round((gw * h) / w / 2) * 2; const shots: Uint8Array[] = [];
      for (let i = 0; i < frames; i++) {
        if (o.signal?.aborted) throw new DOMException("Cancelled", "AbortError");
        const t = t0 + i / fps; await frameAt(t);
        const bmp = await createImageBitmap(canvas as unknown as ImageBitmapSource, { resizeWidth: gw, resizeHeight: gh });
        const cv = new OffscreenCanvas(gw, gh); const x = cv.getContext("2d")!; x.drawImage(bmp, 0, 0); shots.push(new Uint8Array(x.getImageData(0, 0, gw, gh).data.buffer)); bmp.close();
        report((i + 1) / frames, "frames");
      }
      return { blob: encodeGif(shots, gw, gh, Math.round(100 / fps)), name: name + ".gif", mime: "image/gif", width: gw, height: gh, seconds: secs };
    }
    const format = o.format === "webm" ? new WebMOutputFormat() : o.format === "mov" ? new MovOutputFormat() : new Mp4OutputFormat({ fastStart: "in-memory" });
    const vcodec = await getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), { width: w, height: h });
    if (!vcodec) throw Object.assign(new Error("This browser can't encode video here — use the server export."), { code: "NO_ENCODER" });
    const out = new Output({ format, target: new BufferTarget() });
    const q = o.quality === "low" ? QUALITY_LOW : o.quality === "medium" ? QUALITY_MEDIUM : QUALITY_HIGH;
    const vsrc = new CanvasSource(canvas as HTMLCanvasElement, { codec: vcodec, bitrate: q, keyFrameInterval: 2 });
    out.addVideoTrack(vsrc, { frameRate: fps });
    let asrc: AudioBufferSource | null = null; const hasSound = p.tracks.some((t) => !t.muted && t.clips.some((c) => c.type === "media" && !c.muted && p.assets[c.asset]?.hasAudio !== false && p.assets[c.asset]?.kind !== "image"));
    if (hasSound) { const acodec = await getFirstEncodableAudioCodec(format.getSupportedAudioCodecs()); if (acodec) { asrc = new AudioBufferSource({ codec: acodec, bitrate: q }); out.addAudioTrack(asrc); } }
    await out.start();
    for (let i = 0; i < frames; i++) {
      if (o.signal?.aborted) { await out.cancel(); throw new DOMException("Cancelled", "AbortError"); }
      await frameAt(t0 + i / fps); await vsrc.add(i / fps, 1 / fps); report(((i + 1) / frames) * (asrc ? 0.9 : 1), "frames");
    }
    if (asrc) { report(0.92, "sound"); const ab = await mixSound(p, t0, t1, o.signal); await asrc.add(ab); }
    await out.finalize(); report(1, "done");
    const mime = o.format === "webm" ? "video/webm" : o.format === "mov" ? "video/quicktime" : "video/mp4";
    return { blob: new Blob([(out.target as BufferTarget).buffer!], { type: mime }), name: name + "." + (o.format === "mov" ? "mov" : o.format === "webm" ? "webm" : "mp4"), mime, width: w, height: h, seconds: secs };
  } finally {
    for (const i of inputs.values()) try { i.dispose(); } catch { /* */ }
    for (const b of imgs.values()) b.close(); comp.dispose();
  }
}

// the whole sound of the edit, mixed offline (the same volume, fades, keyframes, mute/solo and ducking as the preview)
export async function mixSound(p: Project, t0: number, t1: number, signal?: AbortSignal): Promise<AudioBuffer> {
  const rate = 48000, len = Math.max(1, Math.ceil((t1 - t0) * rate));
  const ctx = new OfflineAudioContext(2, len, rate); const cache = new Map<string, AudioBuffer | null>();
  const solo = p.tracks.some((t) => t.solo);
  const voices: [number, number][] = [];
  if (p.ducking.enabled) for (const t of p.tracks) if (p.ducking.voiceTracks.includes(t.id)) for (const c of t.clips) if (c.type === "media") voices.push([c.start, clipEnd(c)]);
  for (const tr of p.tracks) {
    if (tr.muted || (solo && !tr.solo)) continue;
    for (const c of tr.clips) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      if (c.type !== "media" || c.muted || c.freeze != null) continue; const a = p.assets[c.asset]; if (!a || a.kind === "image" || a.hasAudio === false) continue;
      const s0 = Math.max(c.start, t0), s1 = Math.min(clipEnd(c), t1); if (s1 <= s0) continue;
      if (!cache.has(a.id)) { const b = await fileOf(a as Asset); cache.set(a.id, b ? await decodeSound(b) : null); }
      let buf = cache.get(a.id); if (!buf) continue;
      if (c.reverse) { const r = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate); for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch), o2 = r.getChannelData(ch); for (let i = 0; i < d.length; i++) o2[i] = d[d.length - 1 - i]; } buf = r; }
      const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = c.speed;
      const g = ctx.createGain(); src.connect(g).connect(ctx.destination);
      const local0 = s0 - c.start, srcAt = c.reverse ? buf.duration - sourceTime(c, local0) : sourceTime(c, local0);
      const step = 1 / 50; g.gain.setValueAtTime(0, 0);
      for (let t = s0; t <= s1 + step; t += step) {
        let v = gainAt(c, Math.min(c.dur, t - c.start)); if (voices.length && !p.ducking.voiceTracks.includes(tr.id)) v *= duckGain(voices, t, p.ducking.amount);
        g.gain.linearRampToValueAtTime(Math.max(0, v), Math.max(0, t - t0));
      }
      src.start(s0 - t0, Math.max(0, srcAt), (s1 - s0) * c.speed);
    }
  }
  return ctx.startRendering();
}
