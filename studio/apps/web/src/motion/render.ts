// A nooi Motion clip drawn at one moment: its template's program runs on a frame-size canvas with the clip's props, the project's
// frame rate and the sound playing at that moment. The same frame always gives the same picture (preview, tile and export match).
import { clipEnd, sourceTime, srcLimit } from "@nooi/editor-core";
import type { MediaClip, Project, TextClip } from "@nooi/editor-core";
import { Motion as M } from "@nooi/editor-core";
import { defaultsOf, templateOf, type MCtx, type Props } from "./templates";
import { codeFrame } from "./code";

export const STILL = { opacity: 1, dx: 0, dy: 0, scale: 1, blur: 0, chars: Infinity };
const cache = new Map<string, { cv: HTMLCanvasElement | OffscreenCanvas; key: string }>();
const mk = (w: number, h: number) => (typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h }));

/** how loud the edit is at `t` (0..1), from the waveforms of the sound playing then; null when the edit has no sound at all */
export function levelAt(p: Project | undefined, t: number): number | null {
  if (!p) return null; let any = false, v = 0; const solo = p.tracks.some((x) => x.solo);
  for (const tr of p.tracks) {
    if (tr.muted || (solo && !tr.solo)) continue;
    for (const c of tr.clips) {
      if (c.type !== "media" || c.muted) continue; const a = p.assets[c.asset]; if (!a?.waveform?.length || !a.duration) continue; any = true;
      if (t < c.start || t >= clipEnd(c)) continue;
      const s = sourceTime(c as MediaClip, t - c.start, srcLimit(p, c)), i = Math.floor((s / a.duration) * a.waveform.length);
      v = Math.max(v, (a.waveform[Math.max(0, Math.min(a.waveform.length - 1, i))] || 0) * Math.min(2, (c as MediaClip).volume ?? 1));
    }
  }
  return any ? Math.min(1, v) : null;
}
/** the sound at `t` as `n` bars (low → high): the level now and just before, shaped like a spectrum (an even pulse when there is no sound) */
export function barsAt(p: Project | undefined, t: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const k = i / Math.max(1, n - 1), lag = k * 0.12, L = levelAt(p, t - lag) ?? 0.35 + 0.3 * M.noise2("demo", t * 2.2, 0);
    const shape = 1 - 0.55 * k, wob = 0.55 + 0.45 * M.noise2("bars", i * 0.35, t * 3.1);
    out.push(Math.max(0, Math.min(1, L * shape * wob * 1.6)));
  }
  return out;
}

export function propsOf(c: TextClip): Props { const tpl = c.motion && templateOf(c.motion.tpl); return tpl ? { ...defaultsOf(tpl, "en"), ...(c.motion!.props as Props) } : {}; }

/** a motion template drawn at `local` seconds of the clip into a fresh canvas (for tiles); returns false when it failed */
export function drawTemplate(ctx: CanvasRenderingContext2D, id: string, props: Props, local: number, dur: number, W: number, H: number, p?: Project, at = local): boolean {
  const tpl = templateOf(id); if (!tpl) return false; const fps = p?.fps || 30, frame = Math.floor(local * fps + 1e-6);
  const m: MCtx = { ctx, W, H, u: Math.min(W, H), frame, fps, t: frame / fps, dur, durF: Math.round(dur * fps), p: props,
    audio: (t?: number) => levelAt(p, t ?? at) ?? 0.35 + 0.3 * M.noise2("demo", (t ?? at) * 2.2, 0), bars: (n: number) => barsAt(p, at, n) };
  ctx.save(); try { tpl.draw(m); return true; } catch { return false; } finally { ctx.restore(); ctx.globalAlpha = 1; ctx.setLineDash([]); }
}

/** the motion clip at `local` seconds, frame-size (the compositor moves/scales/turns it like any layer) */
export function motionCanvas(c: TextClip, local: number, W: number, H: number, p?: Project) {
  const id = c.motion!.tpl, tpl = templateOf(id), fps = p?.fps || 30, frame = Math.floor(Math.max(0, Math.min(c.dur, local)) * fps + 1e-6), at = c.start + frame / fps;
  const props = propsOf(c), sound = tpl && (tpl.group === "audio" || id === "code") ? Math.round((levelAt(p, at) ?? -1) * 200) + ":" + (tpl.group === "audio" ? barsAt(p, at, 8).map((v) => Math.round(v * 50)).join(",") : "") : "";
  let e = cache.get(c.id); if (!e || e.cv.width !== W || e.cv.height !== H) { e = { cv: mk(W, H), key: "" }; cache.set(c.id, e); }
  const ctx = e.cv.getContext("2d") as CanvasRenderingContext2D;
  if (id === "code") {
    const f = codeFrame(c, props, frame, fps, c.dur, W, H, levelAt(p, at) ?? 0, barsAt(p, at, 64));
    const key = "code|" + (f ? f.key : "none") + "|" + W + "x" + H; if (e.key === key) return { cv: e.cv, look: STILL, changed: false };
    e.key = key; ctx.clearRect(0, 0, W, H); if (f) ctx.drawImage(f.bmp, 0, 0, W, H); return { cv: e.cv, look: STILL, changed: true };
  }
  const key = [id, JSON.stringify(props), W, H, frame, fps, c.dur, sound].join("|");
  if (e.key === key) return { cv: e.cv, look: STILL, changed: false };
  e.key = key; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
  drawTemplate(ctx, id, props, frame / fps, c.dur, W, H, p, at);
  return { cv: e.cv, look: STILL, changed: true };
}
export const forgetMotion = (id: string) => cache.delete(id);
