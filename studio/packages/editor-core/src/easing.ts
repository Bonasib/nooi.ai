import type { Bezier, Easing, Keyframe, Keyframes, KfProp } from "./schema";

export const EASINGS: Record<string, Bezier> = {
  linear: [0, 0, 1, 1], easeIn: [0.42, 0, 1, 1], easeOut: [0, 0, 0.58, 1], easeInOut: [0.42, 0, 0.58, 1],
};

// y(x) of a CSS-style cubic bezier (Newton steps, then bisection)
export function bezier([x1, y1, x2, y2]: Bezier, x: number): number {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t: number) => ((ax * t + bx) * t + cx) * t, dX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  let t = x;
  for (let i = 0; i < 8; i++) { const e = X(t) - x; if (Math.abs(e) < 1e-6) break; const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
  if (t < 0 || t > 1 || Math.abs(X(t) - x) > 1e-4) { let a = 0, b = 1; t = x; for (let i = 0; i < 40; i++) { const v = X(t); if (Math.abs(v - x) < 1e-6) break; if (v < x) a = t; else b = t; t = (a + b) / 2; } }
  return ((ay * t + by) * t + cy) * t;
}

export function ease(e: Easing | undefined, k: number): number {
  if (!e || e === "linear") return k;
  if (e === "hold") return 0;
  if (typeof e === "string") return bezier(EASINGS[e] || EASINGS.linear, k);
  return bezier(e.bezier, k);
}

// the value of a property at time t (seconds from the clip's start): keyframes win; otherwise the base value
export function valueAt(list: Keyframe[] | undefined, t: number, base: number): number {
  if (!list || !list.length) return base;
  if (t <= list[0].t) return list[0].v;
  const last = list[list.length - 1];
  if (t >= last.t) return last.v;
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i], b = list[i + 1];
    if (t >= a.t && t <= b.t) { const k = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t); return a.v + (b.v - a.v) * ease(a.ease, k); }
  }
  return base;
}

export function setKeyframe(kfs: Keyframes, prop: KfProp, t: number, v: number, e?: Easing): Keyframes {
  const list = [...(kfs[prop] || [])].filter((k) => Math.abs(k.t - t) > 1e-4);
  list.push({ t: Math.max(0, t), v, ease: e || "easeInOut" });
  list.sort((a, b) => a.t - b.t);
  return { ...kfs, [prop]: list };
}
export function removeKeyframe(kfs: Keyframes, prop: KfProp, t: number): Keyframes {
  const list = (kfs[prop] || []).filter((k) => Math.abs(k.t - t) > 1e-4);
  const o = { ...kfs }; if (list.length) o[prop] = list; else delete o[prop]; return o;
}
