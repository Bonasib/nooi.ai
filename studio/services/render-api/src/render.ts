// One render: the project compiled to an FFmpeg command and run on the CPU, with progress, a time limit and cancel.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { compile, migrate } from "@nooi/editor-core";
import type { RenderInput } from "@nooi/editor-core";
import { CFG } from "./config";
import type { Store } from "./store";

export interface RenderJobData { id: string; owner: string; project: unknown; media: Record<string, string>; texts: Record<string, string>; luts: Record<string, string>; motions?: Record<string, string>; format: RenderInput["format"]; width: number; height: number; fps: number; quality: RenderInput["quality"] }
const running = new Map<string, () => void>();
export const cancelRender = (id: string) => { running.get(id)?.(); };
const EXT: Record<string, string> = { mp4: ".mp4", webm: ".webm", mov: ".mov", gif: ".gif", mp3: ".mp3", wav: ".wav" };

export async function runRender(store: Store, d: RenderJobData): Promise<void> {
  const r = await store.getRender(d.id); if (!r || r.status === "cancelled") return;
  fs.mkdirSync(CFG.renderDir, { recursive: true });
  const out = path.join(CFG.renderDir, d.id + EXT[d.format]);
  await store.updateRender(d.id, { status: "running", startedAt: new Date(), progress: 0.01 });
  try {
    const project = migrate(d.project);
    const c = compile({ project, media: d.media, texts: d.texts, luts: d.luts, motions: d.motions || {}, out, format: d.format, width: d.width, height: d.height, fps: d.fps, quality: d.quality });
    if (c.seconds > CFG.maxSeconds) throw new Error(`Longer than ${CFG.maxSeconds} s — split it into parts.`);
    await new Promise<void>((res, rej) => {
      const p = spawn(CFG.ffmpeg, ["-progress", "pipe:1", "-nostats", ...c.args], { stdio: ["ignore", "pipe", "pipe"] });
      let err = "", last = 0; const kill = () => { p.kill("SIGKILL"); rej(new Error("cancelled")); };
      running.set(d.id, kill);
      // a cancel from another process (the API) is seen within two seconds
      const poll = setInterval(() => { void store.getRender(d.id).then((x) => { if (x?.status === "cancelled") kill(); }); }, 2000);
      p.on("close", () => clearInterval(poll));
      const limit = setTimeout(() => { p.kill("SIGKILL"); rej(new Error("The render took too long.")); }, Math.max(120, c.seconds * 40) * 1000);
      p.stdout.on("data", (b: Buffer) => { const m = /out_time_us=(\d+)/g; let x; while ((x = m.exec(b.toString()))) { const k = Math.min(0.99, +x[1] / 1e6 / c.seconds); if (k - last > 0.02) { last = k; void store.updateRender(d.id, { progress: Math.round(k * 100) / 100 }); } } });
      p.stderr.on("data", (b: Buffer) => { err = (err + b.toString()).slice(-2000); });
      p.on("error", (e) => { clearTimeout(limit); rej(e); });
      p.on("close", (code) => { clearTimeout(limit); running.delete(d.id); code === 0 ? res() : rej(new Error(err.trim().split("\n").slice(-3).join(" ") || "ffmpeg " + code)); });
    });
    const url = CFG.publicRenders + path.basename(out);
    await store.updateRender(d.id, { status: "done", progress: 1, outputPath: out, url, finishedAt: new Date() });
    await store.log(d.owner, "render", { seconds: c.seconds, meta: { format: d.format, w: d.width, h: d.height } });
    fs.rmSync(path.join(CFG.renderDir, "texts", d.id), { recursive: true, force: true });
  } catch (e) {
    fs.rmSync(path.join(CFG.renderDir, "texts", d.id), { recursive: true, force: true });
    const msg = String((e as Error).message || e).slice(0, 500); try { fs.unlinkSync(out); } catch { /* */ } running.delete(d.id);
    await store.updateRender(d.id, { status: msg === "cancelled" ? "cancelled" : "failed", error: msg === "cancelled" ? null : msg, finishedAt: new Date() });
  }
}
// a small copy for smooth preview of a big file (540p H.264, fast)
export function makeProxy(src: string, out: string): Promise<void> {
  return new Promise((res, rej) => {
    const p = spawn(CFG.ffmpeg, ["-y", "-loglevel", "error", "-i", src, "-vf", "scale=-2:540", "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", out], { stdio: ["ignore", "ignore", "pipe"] });
    let err = ""; p.stderr.on("data", (b) => { err += b; }); p.on("close", (c) => (c === 0 ? res() : rej(new Error(err.slice(-400))))); p.on("error", rej);
  });
}
