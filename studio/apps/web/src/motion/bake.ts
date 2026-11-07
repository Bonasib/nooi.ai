// A nooi Motion graphic made into a video for an FFmpeg export (the nooi server or the desktop app): every frame drawn here by the
// same program as the preview, the colour (over black) on top and the transparency (as grey) below — any codec carries that, and
// FFmpeg joins the two halves back into one see-through layer (editor-core ffmpeg.ts, `motions`).
import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, WebMOutputFormat, getFirstEncodableVideoCodec } from "mediabunny";
import type { Project, TextClip } from "@nooi/editor-core";
import { motionCanvas, barsAt, levelAt } from "./render";
import { codeReady } from "./code";
import { preparePics } from "./pics";

const even = (x: number) => Math.max(2, Math.round(x / 2) * 2);
export const motionClips = (p: Project) => p.tracks.filter((t) => t.kind !== "audio" && !t.hidden).flatMap((t) => t.clips.filter((c): c is TextClip => c.type === "text" && !!c.motion));

export async function bakeMotion(p: Project, c: TextClip, W: number, H: number, fps: number, o: { signal?: AbortSignal; onProgress?: (k: number) => void } = {}): Promise<{ blob: Blob; ext: string }> {
  await preparePics(p);   // (v247)
  const k = Math.min(1, 1920 / W, 1080 / H), w = even(W * k), h = even(H * k);   // (at most 1080p: the server scales it to the frame)
  const cv = new OffscreenCanvas(w, h * 2), x = cv.getContext("2d")!;
  let format: WebMOutputFormat | Mp4OutputFormat = new WebMOutputFormat();
  let codec = await getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), { width: w, height: h * 2 });
  if (!codec) { format = new Mp4OutputFormat({ fastStart: "in-memory" }); codec = await getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), { width: w, height: h * 2 }); }
  if (!codec) throw Object.assign(new Error("This browser can't encode video here."), { code: "NO_ENCODER" });
  const out = new Output({ format, target: new BufferTarget() });
  const src = new CanvasSource(cv, { codec, bitrate: QUALITY_HIGH, keyFrameInterval: 2 }); out.addVideoTrack(src, { frameRate: fps }); await out.start();
  const n = Math.max(1, Math.round(c.dur * fps)), sound = (t: number): [number, number[]] => [levelAt(p, t) ?? 0, barsAt(p, t, 64)];
  for (let i = 0; i < n; i++) {
    if (o.signal?.aborted) { await out.cancel(); throw new DOMException("Cancelled", "AbortError"); }
    const local = i / fps; if (c.motion!.tpl === "code") await codeReady(c, p, local, w, h, sound);
    const r = motionCanvas(c, local, w, h, p), L = r.look;
    // (v231) its Enter / Exit is drawn in here (the FFmpeg side places the layer as it is)
    const put = (y: number) => { x.save(); x.beginPath(); x.rect(0, y, w, h); x.clip(); x.globalAlpha = Math.max(0, Math.min(1, L.opacity)); x.translate(w / 2 + L.dx * w, y + h / 2 + L.dy * h); x.scale(L.scale, L.scale); x.drawImage(r.cv as CanvasImageSource, -w / 2, -h / 2); x.restore(); };
    x.globalCompositeOperation = "source-over"; x.clearRect(0, 0, w, h * 2); put(h);
    x.globalCompositeOperation = "source-in"; x.fillStyle = "#fff"; x.fillRect(0, h, w, h);            // below: the transparency as white
    x.globalCompositeOperation = "destination-over"; x.fillStyle = "#000"; x.fillRect(0, 0, w, h * 2); // …on black
    x.globalCompositeOperation = "source-over"; put(0);                                                    // on top: the colour over black
    await src.add(i / fps, 1 / fps); o.onProgress?.((i + 1) / n);
  }
  await out.finalize();
  const mp4 = format instanceof Mp4OutputFormat;
  return { blob: new Blob([(out.target as BufferTarget).buffer!], { type: mp4 ? "video/mp4" : "video/webm" }), ext: mp4 ? ".mp4" : ".webm" };
}
