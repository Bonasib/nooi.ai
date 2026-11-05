// One moment of the timeline → the compositor. The preview and the export both use this; they only differ in where frames come from.
import { layersAt, propAt, sourceTime, srcLimit } from "@nooi/editor-core";
import type { Asset, MediaClip, Project } from "@nooi/editor-core";
import type { Compositor, LayerDraw, Src } from "./compositor";
import { textCanvas } from "./text";
import { motionCanvas } from "../motion/render";

export interface Frame { src: Src; w: number; h: number; key: string; dynamic: boolean; fid?: number }   // fid: the video frame shown (unchanged → not uploaded again)
export type FrameFor = (clip: MediaClip, asset: Asset, srcT: number) => Frame | null;
export type LutFor = (assetId: string) => { tex: WebGLTexture; size: number } | null;

export function drawMoment(comp: Compositor, p: Project, t: number, frameFor: FrameFor, lutFor: LutFor): number {
  comp.begin(p.background); comp.time = t; let n = 0;
  for (const L of layersAt(p, t)) {
    const c = L.clip, local = L.local;
    const opacity = Math.max(0, Math.min(1, propAt(c, "opacity", Math.max(0, Math.min(c.dur, local)))));
    const at = Math.max(0, Math.min(c.dur, local));
    const base = { transform: c.transform, x: propAt(c, "x", at), y: propAt(c, "y", at), scale: propAt(c, "scale", at), rotation: propAt(c, "rotation", at), trans: L.trans || null };
    if (c.type === "media") {
      const a = p.assets[c.asset]; if (!a || a.kind === "audio") continue;
      const f = frameFor(c, a, sourceTime(c, local, srcLimit(p, c))); if (!f) continue;
      const lut = c.lut ? lutFor(c.lut.asset) : null;
      const d: LayerDraw = { ...f, ...base, opacity, blend: c.blend, color: c.color, effects: c.effects, lut: lut ? { ...lut, amount: c.lut!.amount } : null, fit: "contain", stacked: a.alpha === "stacked" && a.kind === "video" };
      comp.draw(d); n++;
    } else {
      const r = c.motion ? motionCanvas(c, local, comp.W, comp.H, p) : textCanvas(c, local, comp.W, comp.H);
      const d: LayerDraw = { src: r.cv as unknown as Src, w: comp.W, h: comp.H, key: "txt:" + c.id, dynamic: r.changed, ...base,
        x: base.x + r.look.dx, y: base.y + r.look.dy, scale: base.scale * r.look.scale, opacity: opacity * r.look.opacity, blend: "normal", fit: "frame" };
      comp.draw(d); n++;
    }
  }
  comp.present(); return n;
}
