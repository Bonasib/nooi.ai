// Export on the nooi server (FFmpeg on the VPS): files only on this device go up first (resumable), titles are drawn here as
// full-frame pictures (right shaping for every script) and the server lays everything out. Status comes back live.
import { duration, type Project, type TextClip, type ExportSettings } from "@nooi/editor-core";
import { frameSize, aspectOf } from "@nooi/editor-core";
import { api, type RenderJob } from "../api";
import { fileOf, serverPath } from "../media/library";
import { textCanvas } from "./text";
import { bakeMotion, motionClips } from "../motion/bake";

const sent = new Map<string, string>();   // asset id + size → the uploaded file's address (not sent twice in a session)

async function pngOf(c: TextClip, W: number, H: number): Promise<string> {
  const local = Math.min(c.dur / 2, Math.max(c.animIn.dur, 0) + 0.01);   // fully shown (the fades are added by FFmpeg)
  const { cv } = textCanvas({ ...c, animIn: { ...c.animIn, dur: 0 }, animOut: { ...c.animOut, dur: 0 } }, local, W, H);
  const blob = "convertToBlob" in cv ? await (cv as OffscreenCanvas).convertToBlob({ type: "image/png" }) : await new Promise<Blob>((ok) => (cv as HTMLCanvasElement).toBlob((b) => ok(b!), "image/png"));
  return await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(blob); });
}

export async function exportOnServer(p: Project, o: ExportSettings & { signal?: AbortSignal; onProgress?: (k: number, note: string) => void }): Promise<RenderJob> {
  const { w, h } = frameSize(aspectOf(p.width, p.height), o.res);
  if (!duration(p)) throw new Error("empty");
  const used = new Set<string>(); for (const t of p.tracks) for (const c of t.clips) if (c.type === "media") { used.add(c.asset); if (c.lut) used.add(c.lut.asset); }
  const media: Record<string, string> = {}, todo: string[] = [];
  for (const id of used) { const a = p.assets[id]; if (!a) continue; const sp = serverPath(a.src); if (sp) media[id] = sp; else todo.push(id); }
  let i = 0;
  for (const id of todo) {
    const a = p.assets[id], key = id + ":" + (a.size || 0);
    if (!sent.has(key)) {
      const b = await fileOf(a); if (!b) throw Object.assign(new Error(a.name), { code: "missing" });
      sent.set(key, await api.tus(b, a.name, (k) => o.onProgress?.(((i + k) / Math.max(1, todo.length)) * 0.3, "upload"), o.signal));
    }
    media[id] = sent.get(key)!; i++;
  }
  const texts: Record<string, string> = {};
  for (const t of p.tracks) if (t.kind === "text" && !t.hidden) for (const c of t.clips) if (c.type === "text" && !c.motion && c.text.trim()) texts[c.id] = await pngOf(c as TextClip, w, h);
  // (v228) nooi Motion graphics: drawn here frame by frame into a video each, then uploaded (resumable) — the server lays them in
  const motions: Record<string, string> = {}, mcs = motionClips(p);
  for (let j = 0; j < mcs.length; j++) {
    const c = mcs[j], part = (k: number) => o.onProgress?.(0.3 + ((j + k) / mcs.length) * 0.1, "motion");
    const { blob, ext } = await bakeMotion(p, c, w, h, o.fps, { signal: o.signal, onProgress: (k) => part(k * 0.8) });
    motions[c.id] = await api.tus(blob, "motion-" + c.id + ext, (k) => part(0.8 + k * 0.2), o.signal);
  }
  o.onProgress?.(mcs.length ? 0.4 : 0.3, "queued");
  const job = await api.startRender({ project: p, media, texts, motions, format: o.format, width: w, height: h, fps: o.fps, quality: o.quality });
  const stop = () => void api.cancelRender(job.id); o.signal?.addEventListener("abort", stop);
  try {
    const b0 = mcs.length ? 0.4 : 0.3;
    return await api.watchRender(job.id, (r) => o.onProgress?.(b0 + (1 - b0) * (r.progress || 0), r.status === "running" ? "running" : r.status === "queued" ? "queued" : "done"), o.signal);
  } finally { o.signal?.removeEventListener("abort", stop); }
}
