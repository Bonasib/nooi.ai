// The apps' own powers. Desktop (Tauri): save with the system's Save dialog, and export with the FFmpeg that ships inside the app
// (every format, H.264 included, at the computer's full speed). Phone (Capacitor): save to the app's files and open the share sheet.
// None of this loads on the website.
import { compile, duration, frameSize, aspectOf, type Project, type TextClip, type ExportSettings } from "@nooi/editor-core";
import { TAURI, CAPACITOR, at } from "../site";
import { fileOf } from "../media/library";
import { textCanvas } from "./text";
import { bakeMotion, motionClips } from "../motion/bake";

const b64 = async (b: Blob) => { const s = await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(b); }); return s.slice(s.indexOf(",") + 1); };

// save a finished file: the Save dialog on a computer, the share sheet on a phone. false → the caller offers a normal download
export async function saveFile(blob: Blob, name: string): Promise<boolean> {
  if (TAURI) {
    const { save } = await import("@tauri-apps/plugin-dialog"); const { writeFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({ defaultPath: name }); if (!path) return true;
    await writeFile(path, new Uint8Array(await blob.arrayBuffer())); return true;
  }
  if (CAPACITOR) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem"); const { Share } = await import("@capacitor/share");
    const r = await Filesystem.writeFile({ path: name, data: await b64(blob), directory: Directory.Cache });
    await Share.share({ title: name, files: [r.uri] }).catch(() => undefined); return true;
  }
  return false;
}

// desktop export with the bundled FFmpeg: the project's files are written to a work folder, titles as full-frame pictures, then
// editor-core's compile() gives the same FFmpeg command the nooi server uses
export async function exportDesktop(p: Project, o: ExportSettings & { signal?: AbortSignal; onProgress?: (k: number, note: string) => void }): Promise<{ blob: Blob; name: string }> {
  const { appCacheDir, join } = await import("@tauri-apps/api/path");
  const { mkdir, writeFile, readFile, remove } = await import("@tauri-apps/plugin-fs");
  const { Command } = await import("@tauri-apps/plugin-shell");
  const dir = await join(await appCacheDir(), "export-" + Date.now().toString(36)); await mkdir(dir, { recursive: true });
  try {
    const { w, h } = frameSize(aspectOf(p.width, p.height), o.res);
    const used = new Set<string>(); for (const t of p.tracks) for (const c of t.clips) if (c.type === "media") { used.add(c.asset); if (c.lut) used.add(c.lut.asset); }
    const media: Record<string, string> = {}, luts: Record<string, string> = {}; let i = 0;
    for (const id of used) {
      const a = p.assets[id]; if (!a) continue;
      const blob = a.src.startsWith("local:") ? await fileOf(a) : await fetch(at(a.src)).then((r) => (r.ok ? r.blob() : null)).catch(() => null);
      if (!blob) throw Object.assign(new Error(a.name), { code: "missing" });
      const f = await join(dir, id + (a.kind === "lut" ? ".cube" : "")); await writeFile(f, new Uint8Array(await blob.arrayBuffer()));
      (a.kind === "lut" ? luts : media)[id] = f; o.onProgress?.((++i / Math.max(1, used.size)) * 0.15, "media");
    }
    const texts: Record<string, string> = {};
    for (const t of p.tracks) if (t.kind === "text" && !t.hidden) for (const c of t.clips) if (c.type === "text" && !(c as TextClip).motion && c.text.trim()) {
      const tc = c as TextClip; const { cv } = textCanvas({ ...tc, animIn: { ...tc.animIn, dur: 0 }, animOut: { ...tc.animOut, dur: 0 } }, tc.dur / 2, w, h);
      const png = "convertToBlob" in cv ? await (cv as OffscreenCanvas).convertToBlob({ type: "image/png" }) : await new Promise<Blob>((ok) => (cv as HTMLCanvasElement).toBlob((b) => ok(b!), "image/png"));
      const f = await join(dir, c.id + ".png"); await writeFile(f, new Uint8Array(await png.arrayBuffer())); texts[c.id] = f;
    }
    // (v228) nooi Motion graphics: drawn here frame by frame into a video each (colour on top, transparency below)
    const motions: Record<string, string> = {}, mcs = motionClips(p);
    for (let j = 0; j < mcs.length; j++) {
      const { blob, ext } = await bakeMotion(p, mcs[j], w, h, o.fps, { signal: o.signal, onProgress: (k) => o.onProgress?.(0.15 * ((j + k) / mcs.length), "motion") });
      const f = await join(dir, "motion-" + mcs[j].id + ext); await writeFile(f, new Uint8Array(await blob.arrayBuffer())); motions[mcs[j].id] = f;
    }
    const out = await join(dir, "out." + o.format), secs = duration(p);
    const c = compile({ project: p, media, texts, luts, motions, out, format: o.format, width: w, height: h, fps: o.fps, quality: o.quality });
    o.onProgress?.(0.15, "frames");
    const cmd = Command.sidecar("binaries/ffmpeg", ["-progress", "pipe:1", "-nostats", ...c.args]);
    let err = "";
    cmd.stdout.on("data", (line: string) => { const m = /out_time_us=(\d+)/.exec(line); if (m) o.onProgress?.(0.15 + 0.85 * Math.min(0.99, +m[1] / 1e6 / Math.max(0.1, secs)), "frames"); });
    cmd.stderr.on("data", (line: string) => { err = (err + line + "\n").slice(-1500); });
    const done = new Promise<number | null>((ok) => cmd.on("close", (e: { code: number | null }) => ok(e.code)));
    const child = await cmd.spawn(); o.signal?.addEventListener("abort", () => void child.kill());
    const code = await done;
    if (o.signal?.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
    if (code !== 0) throw new Error(err.trim().split("\n").slice(-2).join(" ") || "FFmpeg " + code);
    const bytes = await readFile(out); o.onProgress?.(1, "done");
    const mime = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", gif: "image/gif", mp3: "audio/mpeg", wav: "audio/wav" }[o.format];
    return { blob: new Blob([bytes], { type: mime }), name: (p.name || "nooi").replace(/[^\p{L}\p{N} _-]+/gu, "").trim().slice(0, 60) + "." + o.format };
  } finally { await remove(dir, { recursive: true }).catch(() => undefined); }
}
