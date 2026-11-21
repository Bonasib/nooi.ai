// (v278) tile pictures for effects, transitions and looks: each is drawn by the real compositor on a sample picture,
// so what a tile shows is exactly what the clip gets. One small hidden compositor, drawn a few at a time when the page is idle.
import { useEffect, useState } from "react";
import { Compositor, type LayerDraw } from "../engine/compositor";
import { color0, effectAmount, LOOKS, BOX_EFFECTS } from "@nooi/editor-core";
import type { Transform } from "@nooi/editor-core";

const W = 160, H = 90;
let comp: Compositor | null = null, failed = false;
let A: HTMLCanvasElement | null = null, B: HTMLCanvasElement | null = null;
const cache = new Map<string, string>();
const waiting = new Map<string, ((u: string) => void)[]>();
const queue: string[] = [];
let busy = false;

// two sample pictures: a sunny landscape with a person (A) and a teal night city (B, the incoming clip of a transition)
function sample(night: boolean): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = W * 2; c.height = H * 2; const g = c.getContext("2d")!; const w = c.width, h = c.height;
  const sky = g.createLinearGradient(0, 0, 0, h);
  if (night) { sky.addColorStop(0, "#0b1d3a"); sky.addColorStop(1, "#1f6f7a"); } else { sky.addColorStop(0, "#5aa7e8"); sky.addColorStop(0.6, "#f6d38a"); sky.addColorStop(1, "#e68a3c"); }
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  if (night) {
    for (let i = 0; i < 14; i++) { const bw = 14 + (i * 37) % 22, bh = 40 + (i * 53) % 90, x = i * 24; g.fillStyle = "#0e2236"; g.fillRect(x, h - bh, bw, bh);
      g.fillStyle = "#f7e27a"; for (let y = h - bh + 6; y < h - 6; y += 10) for (let xx = x + 3; xx < x + bw - 3; xx += 6) if ((xx + y) % 3) g.fillRect(xx, y, 2, 3); }
    g.fillStyle = "#f2f2e6"; g.beginPath(); g.arc(w * 0.78, h * 0.2, 14, 0, 7); g.fill();
  } else {
    g.fillStyle = "#fff4c8"; g.beginPath(); g.arc(w * 0.72, h * 0.32, 22, 0, 7); g.fill();
    g.fillStyle = "#3d7a3a"; g.beginPath(); g.moveTo(0, h * 0.72); g.quadraticCurveTo(w * 0.3, h * 0.5, w * 0.6, h * 0.7); g.quadraticCurveTo(w * 0.85, h * 0.82, w, h * 0.66); g.lineTo(w, h); g.lineTo(0, h); g.fill();
    g.fillStyle = "#2a5528"; g.fillRect(0, h * 0.86, w, h);
    // a person
    g.fillStyle = "#c2412f"; g.fillRect(w * 0.28, h * 0.52, 22, 34); g.fillStyle = "#f1c7a0"; g.beginPath(); g.arc(w * 0.28 + 11, h * 0.47, 9, 0, 7); g.fill();
    g.fillStyle = "#1d2a44"; g.fillRect(w * 0.28 + 2, h * 0.52 + 34, 7, 18); g.fillRect(w * 0.28 + 13, h * 0.52 + 34, 7, 18);
  }
  return c;
}
const ID: Transform = { x: 0, y: 0, scale: 1, rotation: 0, flipH: false, flipV: false, crop: [0, 0, 0, 0] };
function layer(src: HTMLCanvasElement, key: string, extra: Partial<LayerDraw>): LayerDraw {
  return { src, w: src.width, h: src.height, key, transform: ID, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, blend: "normal", fit: "cover", color: null, effects: [], lut: null, trans: null, ...extra };
}
function drawOne(k: string): string {
  if (!comp) { const cv = document.createElement("canvas"); cv.width = W; cv.height = H; comp = new Compositor(cv); comp.resize(W, H); A = sample(false); B = sample(true); }
  const c = comp; const [kind, id] = k.split(":");
  c.time = 1.3; c.begin("#000000");
  if (kind === "fx") c.draw(layer(A!, "A", { effects: [{ id: "t", type: id, enabled: true, params: BOX_EFFECTS.has(id) ? { amount: 1, x: 0.2, y: 0.2, w: 0.35, h: 0.45 } : { amount: Math.max(0.5, effectAmount(id)) } }] }));
  else if (kind === "tr") { c.draw(layer(A!, "A", { trans: { type: id, k: 0.5, role: "a" } })); c.draw(layer(B!, "B", { trans: { type: id, k: 0.5, role: "b" } })); }
  else { const l = LOOKS.find((x) => x.id === id); c.draw(layer(A!, "A", { color: { ...color0(), ...(l?.set || {}) } as LayerDraw["color"] })); }
  c.present();
  return (c.canvas as HTMLCanvasElement).toDataURL("image/jpeg", 0.82);
}
function pump() {
  if (busy || !queue.length) return; busy = true;
  const idle = (cb: () => void) => ("requestIdleCallback" in window ? (window as unknown as { requestIdleCallback: (f: () => void, o?: object) => void }).requestIdleCallback(cb, { timeout: 300 }) : setTimeout(cb, 16));
  idle(() => {
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < 12) {
      const k = queue.shift()!; let u = "";
      try { if (!failed) u = drawOne(k); } catch { failed = true; }
      cache.set(k, u); for (const f of waiting.get(k) || []) f(u); waiting.delete(k);
    }
    busy = false; pump();
  });
}
/** the tile picture for "fx:<id>", "tr:<id>" or "look:<id>" ("" while it is drawn or when WebGL is missing) */
export function useThumb(k: string): string {
  const [u, setU] = useState(() => cache.get(k) || "");
  useEffect(() => {
    if (cache.has(k)) { setU(cache.get(k)!); return; }
    let on = true; const f = (x: string) => { if (on) setU(x); };
    (waiting.get(k) || waiting.set(k, []).get(k)!).push(f); if (!queue.includes(k)) queue.push(k); pump();
    return () => { on = false; };
  }, [k]);
  return u;
}
export const thumbStats = () => ({ cached: cache.size, failed });
