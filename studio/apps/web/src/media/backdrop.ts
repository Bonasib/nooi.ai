// (v234) A new background behind a person, on this device: what colour the screen is (green / blue / any flat backdrop), the
// background as clips (a moving scene drawn by nooi Motion, a picture, or a video repeated to cover the person's time), and the
// light on the person matched to the new place (warmth, brightness, tint, from both pictures).
import * as C from "@nooi/editor-core";
import type { Asset, Clip, MediaClip, Project } from "@nooi/editor-core";
import { urlOf } from "./library";
import { drawTemplate } from "../motion/render";
import { defaultsOf, templateOf } from "../motion/templates";

const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** a small picture of an asset at a second (null when it can't be read) */
export async function sample(a: Asset, at: number, w = 96, h = 54): Promise<ImageData | null> {
  const src = await urlOf(a); if (!src) return null; const stack = a.alpha === "stacked";
  const cv = Object.assign(document.createElement("canvas"), { width: w, height: stack ? h * 2 : h }), x = cv.getContext("2d", { willReadFrequently: true })!;
  try {
    if (a.kind === "video") { const v = document.createElement("video"); v.muted = true; v.preload = "auto"; v.crossOrigin = "anonymous"; v.playsInline = true;
      await new Promise<void>((ok, no) => { v.onloadeddata = () => ok(); v.onerror = () => no(new Error("video")); v.src = src; setTimeout(() => no(new Error("slow")), 8000); });
      await new Promise<void>((ok) => { v.onseeked = () => ok(); v.currentTime = Math.min(Math.max(0, at), Math.max(0, (v.duration || 1) - 0.05)); setTimeout(ok, 3000); }); x.drawImage(v, 0, 0, cv.width, cv.height); v.removeAttribute("src"); v.load(); }
    else { const im = new Image(); im.crossOrigin = "anonymous"; await new Promise<void>((ok, no) => { im.onload = () => ok(); im.onerror = () => no(new Error("image")); im.src = src; }); x.drawImage(im, 0, 0, cv.width, cv.height); }
    return x.getImageData(0, 0, cv.width, cv.height);
  } catch { return null; }
}
const clipAt = (c: MediaClip) => c.freeze ?? c.in + (c.dur * c.speed) / 2;
/** the screen colour behind the person in a clip (null when its edges aren't one strong colour) */
export async function screenOfClip(p: Project, c: MediaClip) { const a = p.assets[c.asset]; if (!a || a.alpha === "stacked") return null; const d = await sample(a, clipAt(c), 64, 36); return d ? C.screenColor(d.data, d.width, d.height) : null; }

// ---- the light: warmth (red − blue), brightness, tint (green − magenta), averaged over the person or the whole background
type Stat = [number, number, number];
function stat(d: ImageData, weight: (x: number, y: number, i: number) => number, h = d.height): Stat | null {
  let R = 0, G = 0, B = 0, W = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < d.width; x++) { const i = (y * d.width + x) * 4, w = weight(x, y, i); if (w <= 0) continue; R += d.data[i] * w; G += d.data[i + 1] * w; B += d.data[i + 2] * w; W += w; }
  if (W < 1e-3) return null; R /= W * 255; G /= W * 255; B /= W * 255; return [R - B, 0.2126 * R + 0.7152 * G + 0.0722 * B, G - (R + B) / 2];
}
export async function personLight(p: Project, c: MediaClip): Promise<Stat | null> {
  const a = p.assets[c.asset]; if (!a) return null; const d = await sample(a, clipAt(c)); if (!d) return null;
  if (a.alpha === "stacked") { const h = d.height / 2; return stat(d, (x, y) => d.data[((y + h) * d.width + x) * 4] / 255, h); }
  const k = C.keyOf(c);   // keyed: only what the key keeps; else the middle of the picture (where people stand)
  return stat(d, (x, y, i) => (k ? C.keyAlpha(k, d.data[i] / 255, d.data[i + 1] / 255, d.data[i + 2] / 255) : Math.exp(-(((x / d.width - 0.5) / 0.25) ** 2 + ((y / d.height - 0.5) / 0.35) ** 2))));
}
export type Backdrop = { kind: "motion"; tpl: string } | { kind: "asset"; asset: Asset };
export async function backdropLight(b: Backdrop, lang: "en" | "ar"): Promise<Stat | null> {
  if (b.kind === "asset") { const d = await sample(b.asset, b.asset.kind === "video" ? (b.asset.duration || 2) / 2 : 0); return d ? stat(d, () => 1) : null; }
  const tpl = templateOf(b.tpl); if (!tpl) return null; const cv = Object.assign(document.createElement("canvas"), { width: 96, height: 54 }), x = cv.getContext("2d", { willReadFrequently: true })!;
  drawTemplate(x, b.tpl, defaultsOf(tpl, lang), 3, tpl.dur, 96, 54); return stat(x.getImageData(0, 0, 96, 54), () => 1);
}
/** the colour change that brings the person's light toward the background's (gentle: a part of the way) */
export const lightShift = (person: Stat, bg: Stat): [number, number, number] =>
  [cl((bg[0] - person[0]) * 0.8, -0.35, 0.35), cl((bg[1] - person[1]) * 0.6, -0.3, 0.3), cl((bg[2] - person[2]) * 0.7, -0.2, 0.2)].map((v) => Math.round(v * 100) / 100) as [number, number, number];
/** put a light change on a clip (the one made before for an earlier background taken back first) */
export function applyLight(c: MediaClip, d: [number, number, number] | null) {
  const o = c.light || [0, 0, 0], n = d || [0, 0, 0], r = (v: number) => Math.round(v * 100) / 100;
  c.color = { ...c.color, temperature: r(cl(c.color.temperature - o[0] + n[0], -1, 1)), exposure: r(cl(c.color.exposure - o[1] + n[1], -1, 1)), tint: r(cl(c.color.tint - o[2] + n[2], -1, 1)) };
  c.light = d;
}

/** the background's clips for [start, start + dur]: a moving scene, a picture, or a video repeated (its sound off), filling the frame */
export interface BackdropLook { still?: boolean; moving?: boolean; fx?: [string, number][] }
/** (v235) still: a moving scene held on one picture; moving: a picture with a slow push-in and the light that suits it */
export function backdropClips(p: Project, b: Backdrop, start: number, dur: number, name: string, lang: "en" | "ar", o: BackdropLook = {}): Clip[] {
  if (b.kind === "motion") { const tpl = templateOf(b.tpl)!; const props = { ...defaultsOf(tpl, lang), ...(o.still ? { speed: 0 } : {}) };
    return [C.textClip(name, start, { dur, name, animIn: { type: "none", dur: 0 }, animOut: { type: "none", dur: 0 }, motion: { tpl: b.tpl, props } })]; }
  const a = b.asset, F = p.width / p.height, k = a.w && a.h ? a.w / a.h : F, cover = Math.round(Math.max(k / F, F / k) * 1000) / 1000;
  const one = (s: number, d: number): MediaClip => { const c = C.mediaClip(a, s); c.dur = d; c.in = 0; c.muted = true; c.name = name; c.transform = { ...c.transform, scale: cover };
    if (o.moving && a.kind === "image") { c.keyframes = { ...c.keyframes, scale: [{ t: 0, v: cover, ease: "linear" }, { t: Math.round(d * 1000) / 1000, v: Math.round(cover * 1.08 * 1000) / 1000, ease: "linear" }] };
      c.effects = (o.fx || []).map(([type, amount]) => ({ id: C.uid("fx"), type, enabled: true, params: { amount } })); }
    return c; };
  if (a.kind !== "video" || !a.duration) return [one(start, dur)];
  const out: Clip[] = []; for (let s = 0; s < dur - 0.02; s += a.duration) out.push(one(Math.round((start + s) * 1e6) / 1e6, Math.min(a.duration, dur - s)));
  return out;
}

/** a drawn picture (an SVG) as a 1920×1080 PNG file */
export async function svgPng(svg: string, name: string): Promise<File> {
  const im = new Image(); await new Promise<void>((ok, no) => { im.onload = () => ok(); im.onerror = () => no(new Error("svg")); im.src = svg; });
  const cv = Object.assign(document.createElement("canvas"), { width: 1920, height: 1080 }); cv.getContext("2d")!.drawImage(im, 0, 0, 1920, 1080);
  const b = await new Promise<Blob>((ok) => cv.toBlob((x) => ok(x!), "image/png")); return new File([b], name + ".png", { type: "image/png" });
}
