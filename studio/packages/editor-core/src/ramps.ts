// (v244) Speed ramps: one clip played at changing speeds along a curve (fast → slow-motion → fast, a sudden jump, an ease in…).
// The clip is cut into equal parts of its source, each part at the curve's speed, so the preview, the device export and FFmpeg all
// play it with no new engine; the clips after it on the track move along. Our own curves.
import type { Id, MediaClip, Project } from "./schema";
import * as T from "./timeline";
import { uid } from "./defaults";

export interface Ramp { id: string; en: string; ar: string; curve: number[] }   // speeds (× the clip's own) for equal parts of the source
export const RAMPS: Ramp[] = [
  { id: "hero", en: "Hero moment", ar: "لحظة البطل", curve: [1, 1, 1, 0.6, 0.3, 0.25, 0.3, 0.6, 1, 1] },
  { id: "bullet", en: "Bullet time", ar: "وقت الرصاصة", curve: [3, 3, 2, 0.25, 0.2, 0.2, 0.25, 2, 3, 3] },
  { id: "montage", en: "Montage", ar: "مونتاج", curve: [1, 3, 3, 1, 0.5, 1, 3, 3, 1, 0.5] },
  { id: "jump", en: "Jump cut", ar: "قفزة", curve: [1, 1, 1, 1, 6, 6, 1, 1, 1, 1] },
  { id: "flashIn", en: "Flash in", ar: "دخول سريع", curve: [5, 4, 3, 2, 1.4, 1, 1, 1, 1, 1] },
  { id: "flashOut", en: "Flash out", ar: "خروج سريع", curve: [1, 1, 1, 1, 1, 1.4, 2, 3, 4, 5] },
  { id: "smooth", en: "Smooth rise", ar: "تسارع ناعم", curve: [0.5, 0.7, 1, 1.4, 2, 2, 1.4, 1, 0.7, 0.5] },
  { id: "slowEnd", en: "Slow finish", ar: "نهاية بطيئة", curve: [1, 1, 1, 1, 1, 0.8, 0.6, 0.45, 0.35, 0.3] },
];
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
/** a clip's new length when ramped (its source over the curve's speeds) */
export const rampedDur = (c: MediaClip, curve: number[]) => { const L = c.dur * c.speed, n = curve.length; return r6(curve.reduce((s, k) => s + L / n / Math.max(0.1, Math.min(10, c.speed * k)), 0)); };
/** where the picture is (0..1 of its source) at a share of the ramped clip's time — for the examples */
export function rampAt(curve: number[], q: number): number {
  const w = curve.map((k) => 1 / k), tot = w.reduce((a, b) => a + b, 0); let t = q * tot;
  for (let i = 0; i < curve.length; i++) { if (t <= w[i]) return (i + t / w[i]) / curve.length; t -= w[i]; } return 1;
}
/** ramp a video clip (not one running backwards or frozen): it becomes parts in a row at the curve's speeds; returns the parts' ids */
export function speedRamp(p: Project, id: Id, curve: number[]): Id[] | null {
  const f = T.findClip(p, id); if (!f || f.track.locked || f.clip.type !== "media") return null; const c = f.clip as MediaClip;
  if (c.reverse || c.freeze != null || p.assets[c.asset]?.kind === "image" || curve.length < 2) return null;
  const L = c.dur * c.speed, n = curve.length, end0 = T.clipEnd(c), parts: MediaClip[] = [], base = JSON.parse(JSON.stringify(c)) as MediaClip; let at = c.start;
  for (let i = 0; i < n; i++) {
    const sp = Math.max(0.1, Math.min(10, base.speed * curve[i])), part: MediaClip = i ? { ...JSON.parse(JSON.stringify(base)), id: uid("c") } : c;
    part.in = r6(base.in + (L * i) / n); part.speed = r6(sp); part.start = r6(at); part.dur = r6(L / n / sp); part.keyframes = i ? {} : part.keyframes;
    if (i) part.fadeIn = 0; if (i < n - 1) part.fadeOut = 0; at += part.dur; parts.push(part);
  }
  parts[0].fadeOut = 0; parts[n - 1].fadeOut = base.fadeOut;
  const delta = at - end0;
  for (const o of f.track.clips) if (o !== c && o.start >= end0 - T.EPS) o.start = r6(o.start + delta);
  f.track.clips.splice(f.index + 1, 0, ...parts.slice(1));
  for (const tr of p.transitions) if (tr.a === c.id) tr.a = parts[n - 1].id;
  T.validTransitions(p); return parts.map((x) => x.id);
}
