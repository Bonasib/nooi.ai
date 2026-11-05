// nooi Motion — the math of programmatic motion graphics, written for nooi (frame-based, deterministic: the same frame always draws
// the same picture, in the preview, the export and on any device).
//  · interpolate(frame, [in…], [out…], {easing, extrapolate})  · spring({frame, fps, config})  · Easing.*  · mix colours
//  · noise2/noise3 (smooth gradient noise) and seeded random  · shapes as paths, with their length (to draw a line along itself)

export type EaseFn = (t: number) => number;
const cl = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

// ---- easing
const bez = (x1: number, y1: number, x2: number, y2: number): EaseFn => (x) => {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  let t = x; for (let i = 0; i < 8; i++) { const e = ((ax * t + bx) * t + cx) * t - x; const d = (3 * ax * t + 2 * bx) * t + cx; if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break; t -= e / d; }
  t = cl(t); return ((ay * t + by) * t + cy) * t;
};
const out = (f: EaseFn): EaseFn => (t) => 1 - f(1 - t);
const inOut = (f: EaseFn): EaseFn => (t) => (t < 0.5 ? f(t * 2) / 2 : 1 - f((1 - t) * 2) / 2);
const bounceOut: EaseFn = (t) => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; };
export const Easing = {
  linear: ((t) => t) as EaseFn,
  quad: ((t) => t * t) as EaseFn, cubic: ((t) => t * t * t) as EaseFn, quart: ((t) => t ** 4) as EaseFn,
  sin: ((t) => 1 - Math.cos((t * Math.PI) / 2)) as EaseFn, circle: ((t) => 1 - Math.sqrt(1 - t * t)) as EaseFn, exp: ((t) => (t === 0 ? 0 : 2 ** (10 * t - 10))) as EaseFn,
  back: (s = 1.70158): EaseFn => (t) => t * t * ((s + 1) * t - s),
  elastic: (b = 1): EaseFn => (t) => 1 - Math.pow(Math.cos((t * Math.PI) / 2), 3) * Math.cos(t * b * Math.PI),
  bounce: ((t) => 1 - bounceOut(1 - t)) as EaseFn,
  bezier: bez, in: (f: EaseFn) => f, out, inOut,
  // the ones used most
  easeIn: bez(0.42, 0, 1, 1), easeOut: bez(0, 0, 0.58, 1), easeInOut: bez(0.42, 0, 0.58, 1), smooth: bez(0.25, 0.1, 0.25, 1), snappy: bez(0.2, 0.9, 0.3, 1),
};

// ---- interpolate: a value through several points, eased, with what happens outside them
export type Extrapolate = "clamp" | "extend" | "identity";
export function interpolate(x: number, inR: number[], outR: number[], o: { easing?: EaseFn; left?: Extrapolate; right?: Extrapolate; extrapolate?: Extrapolate } = {}): number {
  if (inR.length !== outR.length || inR.length < 2) throw new Error("interpolate: the ranges need the same length (2 or more)");
  for (let i = 1; i < inR.length; i++) if (!(inR[i] > inR[i - 1])) throw new Error("interpolate: the input range must go up");
  const L = o.left || o.extrapolate || "clamp", R = o.right || o.extrapolate || "clamp", ease = o.easing || Easing.linear;
  let i = 1; while (i < inR.length - 1 && x > inR[i]) i++;
  const a = inR[i - 1], b = inR[i], va = outR[i - 1], vb = outR[i];
  if (x < inR[0]) { if (L === "clamp") return outR[0]; if (L === "identity") return x; }
  if (x > inR[inR.length - 1]) { if (R === "clamp") return outR[outR.length - 1]; if (R === "identity") return x; }
  let k = (x - a) / (b - a); const inside = k >= 0 && k <= 1; if (inside) k = ease(k);
  return va + (vb - va) * k;
}

// ---- spring: a damped spring from 0 to 1 (overshoots when lightly damped); frame-based, the same answer for the same frame
export interface SpringConfig { mass?: number; stiffness?: number; damping?: number; overshootClamping?: boolean }
export function spring(o: { frame: number; fps: number; config?: SpringConfig; from?: number; to?: number; delay?: number; durationInFrames?: number }): number {
  const m = o.config?.mass ?? 1, k = o.config?.stiffness ?? 100, c = o.config?.damping ?? 10, from = o.from ?? 0, to = o.to ?? 1;
  let f = o.frame - (o.delay || 0); if (f <= 0) return from;
  if (o.durationInFrames) { const nat = springLength({ fps: o.fps, config: o.config }); f = (f / o.durationInFrames) * nat; }
  const t = f / o.fps, w0 = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m));
  let x: number;   // the distance still to go (1 → 0)
  if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); x = Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t)); }
  else if (z === 1) x = Math.exp(-w0 * t) * (1 + w0 * t);
  else { const r1 = -w0 * (z - Math.sqrt(z * z - 1)), r2 = -w0 * (z + Math.sqrt(z * z - 1)); x = (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1); }
  let v = 1 - x; if (o.config?.overshootClamping) v = Math.min(1, v);
  return from + (to - from) * v;
}
/** how many frames a spring takes to settle (within 0.5 %) */
export function springLength(o: { fps: number; config?: SpringConfig; threshold?: number }): number {
  const th = o.threshold ?? 0.005; let still = 0;
  for (let f = 1; f < o.fps * 20; f++) { const v = spring({ frame: f, fps: o.fps, config: o.config }); if (Math.abs(1 - v) < th) { if (++still > 3) return f - 3; } else still = 0; }
  return o.fps * 20;
}

// ---- colours: "#rgb", "#rrggbb", "rgb(…)" / "rgba(…)" → mixed in straight RGB
export function parseColor(c: string): [number, number, number, number] {
  const s = c.trim(); let m = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (m) { let h = m[1]; if (h.length <= 4) h = [...h].map((x) => x + x).join(""); const n = parseInt(h.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1]; }
  m = /^rgba?\(([^)]+)\)$/i.exec(s); if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0] || 0, p[1] || 0, p[2] || 0, p[3] ?? 1]; }
  return [0, 0, 0, 1];
}
export function interpolateColors(x: number, inR: number[], colors: string[], o: { easing?: EaseFn } = {}): string {
  const P = colors.map(parseColor); const ch = (i: number) => interpolate(x, inR, P.map((p) => p[i]), { easing: o.easing });
  return `rgba(${Math.round(ch(0))},${Math.round(ch(1))},${Math.round(ch(2))},${+ch(3).toFixed(3)})`;
}

// ---- seeded random (the same seed → the same number, on every device and in every export)
export function random(seed: number | string): number {
  let h = typeof seed === "number" ? Math.floor(seed * 1e6) ^ 0x9e3779b9 : [...seed].reduce((a, ch) => Math.imul(a ^ ch.charCodeAt(0), 2654435761), 0x811c9dc5);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296;
}
// ---- smooth noise: gradient noise in 2 and 3 dimensions, about −1 … 1 (made here; any seed)
const grad3 = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];
const perms = new Map<string, Uint8Array>();
const permOf = (seed: number | string) => { const k = String(seed); let p = perms.get(k); if (p) return p; const a = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(random(k + ":" + i) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } p = new Uint8Array(512); for (let i = 0; i < 512; i++) p[i] = a[i & 255]; perms.set(k, p); return p; };
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10), lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function noise3(seed: number | string, x: number, y: number, z: number): number {
  const P = permOf(seed), X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255; x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z), g = (h: number, a: number, b: number, c: number) => { const q = grad3[h % 12]; return q[0] * a + q[1] * b + q[2] * c; };
  const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
  return lerp(lerp(lerp(g(P[AA], x, y, z), g(P[BA], x - 1, y, z), u), lerp(g(P[AB], x, y - 1, z), g(P[BB], x - 1, y - 1, z), u), v),
    lerp(lerp(g(P[AA + 1], x, y, z - 1), g(P[BA + 1], x - 1, y, z - 1), u), lerp(g(P[AB + 1], x, y - 1, z - 1), g(P[BB + 1], x - 1, y - 1, z - 1), u), v), w);
}
export const noise2 = (seed: number | string, x: number, y: number) => noise3(seed, x, y, 0.5);

// ---- shapes: closed outlines as points (centre 0,0), turned into an SVG path; their length lets a line draw itself along them
export type Pt = [number, number];
export const shapes = {
  rect: (w: number, h: number): Pt[] => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]],
  circle: (r: number, n = 96): Pt[] => Array.from({ length: n }, (_, i) => [r * Math.cos((i / n) * Math.PI * 2 - Math.PI / 2), r * Math.sin((i / n) * Math.PI * 2 - Math.PI / 2)] as Pt),
  ellipse: (rx: number, ry: number, n = 96): Pt[] => Array.from({ length: n }, (_, i) => [rx * Math.cos((i / n) * Math.PI * 2 - Math.PI / 2), ry * Math.sin((i / n) * Math.PI * 2 - Math.PI / 2)] as Pt),
  polygon: (r: number, sides: number): Pt[] => Array.from({ length: sides }, (_, i) => [r * Math.cos((i / sides) * Math.PI * 2 - Math.PI / 2), r * Math.sin((i / sides) * Math.PI * 2 - Math.PI / 2)] as Pt),
  star: (outer: number, inner: number, points = 5): Pt[] => Array.from({ length: points * 2 }, (_, i) => { const r = i % 2 ? inner : outer, a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2; return [r * Math.cos(a), r * Math.sin(a)] as Pt; }),
  heart: (s: number, n = 96): Pt[] => Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2; return [(s / 17) * 16 * Math.sin(t) ** 3, -(s / 17) * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))] as Pt; }),
  triangle: (s: number): Pt[] => shapes.polygon(s, 3),
};
export const toPath = (pts: Pt[], close = true) => pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(2) + " " + p[1].toFixed(2)).join("") + (close ? "Z" : "");
export const pathLength = (pts: Pt[], close = true) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (close && pts.length > 1) L += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]); return L; };
/** the part of an outline drawn so far (0 … 1): as a dash pattern for a stroke */
export const evolve = (pts: Pt[], k: number, close = true) => { const L = pathLength(pts, close); return { dash: [L, L], offset: L * (1 - cl(k)) }; };
/** a point along an outline (0 … 1) */
export function pointAt(pts: Pt[], k: number, close = true): Pt {
  const seg = pts.map((p, i) => [p, pts[(i + 1) % pts.length]] as [Pt, Pt]).slice(0, close ? pts.length : pts.length - 1);
  const L = pathLength(pts, close); let d = cl(k) * L;
  for (const [a, b] of seg) { const s = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d <= s) { const q = s ? d / s : 0; return [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q]; } d -= s; }
  return pts[close ? 0 : pts.length - 1];
}
// ---- timing helpers for code: a part of the timeline (local frame or null), the same part over and over, one after another
export const seq = (frame: number, from: number, dur = Infinity): number | null => (frame >= from && frame < from + dur ? frame - from : null);
export const loop = (frame: number, dur: number) => ((frame % dur) + dur) % dur;
export const stagger = (frame: number, i: number, each: number, delay = 0) => frame - delay - i * each;
