// Titles drawn with the browser's own text engine (correct Arabic shaping, right-to-left, mixed scripts), one canvas per text clip.
import type { TextClip } from "@nooi/editor-core";

const AR = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const FALLBACK = '"IBM Plex Sans Arabic","Noto Sans Arabic","Geist",system-ui,sans-serif';
export interface TextLook { opacity: number; dx: number; dy: number; scale: number; blur: number; chars: number }

// how the in / out animations change the text at `local` seconds
export function textLook(c: TextClip, local: number): TextLook {
  const L: TextLook = { opacity: 1, dx: 0, dy: 0, scale: 1, blur: 0, chars: Infinity };
  const kin = c.animIn.dur > 0 ? Math.min(1, Math.max(0, local / c.animIn.dur)) : 1;
  const kout = c.animOut.dur > 0 ? Math.min(1, Math.max(0, (c.dur - local) / c.animOut.dur)) : 1;
  const ease = (k: number) => 1 - Math.pow(1 - k, 3);
  const apply = (type: string, k: number, out: boolean) => {
    const e = ease(k);
    switch (type) {
      case "fade": L.opacity *= e; break;
      case "pop": L.scale *= 0.6 + 0.4 * e + (out ? 0 : Math.sin(e * Math.PI) * 0.08); L.opacity *= Math.min(1, k * 3); break;
      case "slideUp": L.dy += (1 - e) * (out ? -0.08 : 0.08); L.opacity *= e; break;
      case "slideDown": L.dy += (1 - e) * (out ? 0.08 : -0.08); L.opacity *= e; break;
      case "slideL": L.dx += (1 - e) * (out ? -0.15 : 0.15); L.opacity *= e; break;
      case "zoom": L.scale *= out ? 1 + (1 - e) * 0.4 : 0.3 + 0.7 * e; L.opacity *= e; break;
      case "blur": L.blur = Math.max(L.blur, (1 - e) * 0.02); L.opacity *= e; break;
      case "bounce": { const b = out ? e : 1 - Math.abs(Math.cos(k * Math.PI * 2.5)) * (1 - k); L.dy += (1 - b) * 0.06; L.opacity *= Math.min(1, k * 4); break; }
      case "typewriter": if (!out) L.chars = Math.floor(k * [...c.text].length); else L.opacity *= e; break;
      default: break;
    }
  };
  if (kin < 1) apply(c.animIn.type, kin, false);
  if (kout < 1) apply(c.animOut.type, kout, true);
  return L;
}

const cache = new Map<string, { cv: HTMLCanvasElement | OffscreenCanvas; key: string }>();
const mk = (w: number, h: number) => (typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h }));

// the text clip drawn at the frame's size (the compositor then moves/scales/turns it like any layer)
export function textCanvas(c: TextClip, local: number, W: number, H: number): { cv: HTMLCanvasElement | OffscreenCanvas; look: TextLook; changed: boolean } {
  const look = textLook(c, local);
  const chars = look.chars === Infinity ? -1 : look.chars;
  const key = [c.text, JSON.stringify(c.style), W, H, chars, Math.round(look.blur * 1000)].join("|");
  let e = cache.get(c.id);
  if (e && e.key === key) return { cv: e.cv, look, changed: false };
  if (!e || e.cv.width !== W || e.cv.height !== H) { e = { cv: mk(W, H), key: "" }; cache.set(c.id, e); }
  e.key = key;
  const ctx = e.cv.getContext("2d") as CanvasRenderingContext2D; ctx.clearRect(0, 0, W, H);
  const s = c.style, px = Math.max(4, s.size * H);
  const text = chars >= 0 ? [...c.text].slice(0, chars).join("") : c.text;
  const rtl = s.dir === "rtl" || (s.dir === "auto" && AR.test(c.text));
  ctx.font = `${s.italic ? "italic " : ""}${s.weight} ${px}px "${s.font}",${FALLBACK}`;
  (ctx as CanvasRenderingContext2D & { direction: CanvasDirection }).direction = rtl ? "rtl" : "ltr";
  try { (ctx as unknown as { letterSpacing: string }).letterSpacing = s.letterSpacing * px + "px"; } catch { /* older browsers */ }
  ctx.textBaseline = "middle";
  const lines = text.split("\n"), lh = px * s.lineHeight;
  const widths = lines.map((l) => ctx.measureText(l).width), maxW = Math.max(1, ...widths);
  const top = H / 2 - (lines.length * lh) / 2 + lh / 2, left = W / 2 - maxW / 2, right = W / 2 + maxW / 2;
  const startIsLeft = !rtl; const al = s.align;
  ctx.textAlign = al === "center" ? "center" : ((al === "start") === startIsLeft ? "left" : "right");
  const xFor = () => (al === "center" ? W / 2 : ctx.textAlign === "left" ? left : right);
  if (look.blur > 0) ctx.filter = `blur(${look.blur * H}px)`;
  lines.forEach((l, i) => {
    const y = top + i * lh, x = xFor(), w = widths[i];
    if (s.box) {
      const pad = s.box.pad * px, bx = ctx.textAlign === "center" ? x - w / 2 - pad : ctx.textAlign === "left" ? x - pad : x - w - pad;
      ctx.save(); ctx.globalAlpha = s.box.opacity; ctx.fillStyle = s.box.color; ctx.beginPath();
      const rr = Math.min(s.box.radius * px, lh / 2); (ctx as CanvasRenderingContext2D).roundRect ? ctx.roundRect(bx, y - lh / 2, w + pad * 2, lh, rr) : ctx.rect(bx, y - lh / 2, w + pad * 2, lh); ctx.fill(); ctx.restore();
    }
    ctx.lineJoin = "round";
    // (v226) a glow under everything, a 3D extrusion behind the letters, a second outline outside the first
    if (s.glow && s.glow.blur > 0) { ctx.save(); ctx.shadowColor = s.glow.color; ctx.shadowBlur = s.glow.blur * H; ctx.fillStyle = s.glow.color; ctx.fillText(l, x, y); ctx.fillText(l, x, y); ctx.restore(); }
    if (s.extrude && s.extrude.depth > 0) { const steps = Math.max(1, Math.min(24, Math.round(s.extrude.depth * 40))), d = (s.extrude.depth * px) / steps; ctx.save(); ctx.fillStyle = s.extrude.color; if (s.stroke) { ctx.strokeStyle = s.extrude.color; ctx.lineWidth = s.stroke.width * H * 2; }
      for (let k = steps; k >= 1; k--) { if (s.stroke) ctx.strokeText(l, x + k * d, y + k * d); ctx.fillText(l, x + k * d, y + k * d); } ctx.restore(); }
    if (s.shadow) { ctx.shadowColor = s.shadow.color; ctx.shadowBlur = s.shadow.blur * H; ctx.shadowOffsetX = s.shadow.x * H; ctx.shadowOffsetY = s.shadow.y * H; }
    if (s.outline2 && s.outline2.width > 0) { ctx.strokeStyle = s.outline2.color; ctx.lineWidth = ((s.stroke?.width || 0) + s.outline2.width) * H * 2; ctx.strokeText(l, x, y); ctx.shadowColor = "transparent"; }
    if (s.stroke && s.stroke.width > 0) { ctx.strokeStyle = s.stroke.color; ctx.lineWidth = s.stroke.width * H * 2; ctx.strokeText(l, x, y); ctx.shadowColor = "transparent"; }
    if (s.gradient) { const g = ctx.createLinearGradient(0, y - px * 0.55, 0, y + px * 0.55); g.addColorStop(0, s.gradient[0]); g.addColorStop(1, s.gradient[1]); ctx.fillStyle = g; } else ctx.fillStyle = s.color;
    ctx.fillText(l, x, y); ctx.shadowColor = "transparent";
  });
  ctx.filter = "none";
  return { cv: e.cv, look, changed: true };
}
export function forgetText(id: string) { cache.delete(id); }

// load a Google font by name (for the preview and the export); resolves when ready or after 4 s
const loaded = new Set<string>();
export function loadFont(name: string): Promise<void> {
  if (loaded.has(name) || typeof document === "undefined") return Promise.resolve(); loaded.add(name);
  const l = document.createElement("link"); l.rel = "stylesheet";
  const fam = encodeURIComponent(name).replace(/%20/g, "+");
  l.href = "https://fonts.googleapis.com/css2?family=" + fam + ":wght@400;700;900&display=swap";
  // (v226) Google refuses the whole request when a font lacks one of these weights (Pacifico, Lobster…): then it is asked for as it is
  l.onerror = () => { const k = document.createElement("link"); k.rel = "stylesheet"; k.href = "https://fonts.googleapis.com/css2?family=" + fam + "&display=swap"; document.head.appendChild(k); };
  document.head.appendChild(l);
  return Promise.race([document.fonts.load(`700 32px "${name}"`).then(() => undefined), new Promise<void>((r) => setTimeout(r, 4000))]).catch(() => undefined);
}
