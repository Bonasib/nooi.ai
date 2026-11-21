// One moment of the timeline → the compositor. The preview and the export both use this; they only differ in where frames come from.
import { followOffset, layersAt, lockOffset, panoAt, propAt, sourceTime, srcLimit } from "@nooi/editor-core";
import type { Asset, MediaClip, Project } from "@nooi/editor-core";
import type { Compositor, LayerDraw, Src } from "./compositor";
import { textCanvas } from "./text";
import { motionCanvas } from "../motion/render";

export interface Frame { src: Src; w: number; h: number; key: string; dynamic: boolean; fid?: number }   // fid: the video frame shown (unchanged → not uploaded again)
export type FrameFor = (clip: MediaClip, asset: Asset, srcT: number) => Frame | null;
export type LutFor = (assetId: string) => { tex: WebGLTexture; size: number } | null;

export function drawMoment(comp: Compositor, p: Project, t: number, frameFor: FrameFor, lutFor: LutFor): number {
  comp.begin(p.background); comp.time = t; let n = 0;
  const layers = layersAt(p, t);
  // (v277) track mattes: a clip with a matte uses the top clip of the track just above it at this moment, which isn't drawn itself
  const matteOf = new Map<number, number>(), used = new Set<number>();
  layers.forEach((L, i) => {
    const c = L.clip; if (c.type !== "media" || !c.matte) return; const ti = p.tracks.indexOf(L.track); if (ti <= 0) return;
    const above = p.tracks[ti - 1]; let j = -1; layers.forEach((M, k) => { if (M.track === above) j = k; });
    if (j >= 0) { matteOf.set(i, j); used.add(j); }
  });
  const build = (L: (typeof layers)[number], local0: number, dt = 0): LayerDraw | null => {
    const c = L.clip, local = local0 + dt, at = Math.max(0, Math.min(c.dur, local));
    const opacity = Math.max(0, Math.min(1, propAt(c, "opacity", at)));
    const fo = c.follow ? followOffset(p, c, t + dt, comp.W, comp.H) : [0, 0];
    const base = { transform: c.transform, x: propAt(c, "x", at) + fo[0], y: propAt(c, "y", at) + fo[1], scale: propAt(c, "scale", at), rotation: propAt(c, "rotation", at), trans: L.trans || null };
    if (c.type === "media") {
      const a = p.assets[c.asset]; if (!a || a.kind === "audio") return null;
      const f = frameFor(c, a, sourceTime(c, local0, srcLimit(p, c))); if (!f) return null;
      if (c.track?.lock) { const lk = lockOffset(c, a, at, comp.W, comp.H); base.x += lk.dx; base.y += lk.dy; base.scale *= lk.zoom; }
      const lut = c.lut ? lutFor(c.lut.asset) : null; const pa = panoAt(c, at); const r = Math.PI / 180;
      return { ...f, ...base, opacity, blend: c.blend, color: c.color, effects: c.effects, lut: lut ? { ...lut, amount: c.lut!.amount } : null, fit: pa ? "frame" : "contain", stacked: a.alpha === "stacked" && a.kind === "video",
        cmask: c.cmask || null, pano: pa ? { yaw: pa.yaw * r, pitch: pa.pitch * r, roll: pa.roll * r, fov: Math.max(10, Math.min(170, pa.fov)) * r } : null };
    }
    const rr = c.motion ? motionCanvas(c, local0, comp.W, comp.H, p) : textCanvas(c, local0, comp.W, comp.H);
    return { src: rr.cv as unknown as Src, w: comp.W, h: comp.H, key: "txt:" + c.id, dynamic: rr.changed && dt === 0, ...base,
      x: base.x + rr.look.dx, y: base.y + rr.look.dy, scale: base.scale * rr.look.scale, opacity: opacity * rr.look.opacity, blend: "normal", fit: "frame" };
  };
  layers.forEach((L, i) => {
    if (used.has(i)) return;
    const c = L.clip, local = L.local; const d = build(L, local); if (!d) return;
    const mj = matteOf.get(i); if (mj != null && c.type === "media" && c.matte) { const md = build(layers[mj], layers[mj].local); if (md) d.matte = { tex: comp.alone(md), mode: c.matte.mode, invert: !!c.matte.invert }; }
    // (v277) motion blur: only where the layer really moves within the shutter
    const sh = Math.max(0, Math.min(1, c.mblur || 0)) / Math.max(1, comp.fps);
    if (sh > 0) {
      const N = Math.max(2, comp.blurN), ss: LayerDraw[] = [];
      for (let k = 0; k < N; k++) { const s = build(L, local, (k / (N - 1) - 0.5) * sh); if (s) ss.push(s); }
      const a0 = ss[0], a1 = ss[ss.length - 1];
      const moves = a0 && a1 && (Math.abs(a0.x - a1.x) * comp.W + Math.abs(a0.y - a1.y) * comp.H + Math.abs(a0.scale - a1.scale) * comp.H + Math.abs(a0.rotation - a1.rotation) * 8 > 0.75);
      if (moves) { comp.blurred(ss, { opacity: d.opacity, blend: d.blend, matte: d.matte || null }); n++; return; }
    }
    comp.draw(d); n++;
  });
  comp.present(); return n;
}
