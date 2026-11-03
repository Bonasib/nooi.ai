// The classic editor's 20 motions (v131, after Animate.css — MIT, https://animate.style), for any clip in the studio: titles,
// stickers, pictures, videos. Each one becomes ordinary keyframes (position, size, turn, opacity) with the same timing curves, so
// it plays, exports and can be fine-tuned like any keyframe. Motions that repeat (pulse, heart beat…) repeat through the clip.
// Frame data: [at 0..1, transform, opacity, curve] — x / y in the clip's own width / height, Y in the picture's height, s · sx · sy
// scale, r turn, k skew, rx / ry tilt (degrees; drawn as a squeeze, as the classic editor did).
import type { Bezier, Clip, Keyframe, Keyframes } from "./schema";

type T = { x?: number; y?: number; X?: number; Y?: number; s?: number; sx?: number; sy?: number; r?: number; k?: number; rx?: number; ry?: number };
type Frame = [number, T | null, (number | null)?, string?];
export interface Animate { id: string; en: string; ar: string; dur: number; pivot: "c" | "b" | "t"; frames: Frame[]; curve?: string; loop?: boolean; out?: boolean }
export const animateGroup = (a: Animate) => (a.out ? "out" : a.loop ? "loop" : "in");
export const CURVES: Record<string, Bezier> = { ease: [0.25, 0.1, 0.25, 1], in: [0.42, 0, 1, 1], out: [0, 0, 0.58, 1], io: [0.42, 0, 0.58, 1], b: [0.215, 0.61, 0.355, 1], zi: [0.55, 0.055, 0.675, 0.19], zo: [0.175, 0.885, 0.32, 1] };
const A = (id: string, en: string, ar: string, dur: number, pivot: "c" | "b" | "t", frames: Frame[], curve?: string, loop?: boolean, out?: boolean): Animate => ({ id, en, ar, dur, pivot, frames, curve, loop, out });
const O = (id: string, en: string, ar: string, dur: number, frames: Frame[], curve?: string) => A(id, en, ar, dur, "c", frames, curve, false, true);
export const ANIMATE: Animate[] = [
  A("backInUp", "Back in up", "عودة صاعدة", 1, "c", [[0, { Y: 1.2, s: 0.7 }, 0.7], [0.8, { s: 0.7 }, 0.7], [1, {}, 1]]),
  A("backInDown", "Back in down", "عودة نازلة", 1, "c", [[0, { Y: -1.2, s: 0.7 }, 0.7], [0.8, { s: 0.7 }, 0.7], [1, {}, 1]]),
  A("bounceIn", "Bounce in", "ظهور بقفزة", 0.75, "c", [[0, { s: 0.3 }, 0, "b"], [0.2, { s: 1.1 }, null, "b"], [0.4, { s: 0.9 }, null, "b"], [0.6, { s: 1.03 }, 1, "b"], [0.8, { s: 0.97 }, null, "b"], [1, {}, 1]]),
  A("bounceInUp", "Bounce in up", "قفزة صاعدة", 1, "c", [[0, { Y: 1.2, sy: 5 }, 0, "b"], [0.6, { y: -0.2, sy: 0.9 }, 1, "b"], [0.75, { y: 0.1, sy: 0.95 }, null, "b"], [0.9, { y: -0.05, sy: 0.985 }, null, "b"], [1, {}, null]]),
  A("fadeInUp", "Fade in up", "ظهور صاعد", 1, "c", [[0, { y: 1 }, 0], [1, {}, 1]]),
  A("fadeInDown", "Fade in down", "ظهور نازل", 1, "c", [[0, { y: -1 }, 0], [1, {}, 1]]),
  A("flipInX", "Flip in", "انقلاب", 1, "c", [[0, { rx: 90 }, 0, "in"], [0.4, { rx: -20 }, null, "in"], [0.6, { rx: 10 }, 1], [0.8, { rx: -5 }, null], [1, {}, null]]),
  A("jackInTheBox", "Jack in the box", "علبة المفاجأة", 1, "b", [[0, { s: 0.1, r: 30 }, 0], [0.5, { r: -10 }, null], [0.7, { r: 3 }, null], [1, {}, 1]]),
  A("lightSpeedIn", "Light speed", "سرعة الضوء", 1, "c", [[0, { x: 1, k: -30 }, 0], [0.6, { k: 20 }, 1], [0.8, { k: -5 }, null], [1, {}, null]], "out"),
  A("rollIn", "Roll in", "تدحرج", 1, "c", [[0, { x: -1, r: -120 }, 0], [1, {}, 1]]),
  A("zoomIn", "Zoom in", "تكبير", 1, "c", [[0, { s: 0.3 }, 0], [0.5, null, 1], [1, {}, null]]),
  A("zoomInUp", "Zoom in up", "تكبير صاعد", 1, "c", [[0, { s: 0.1, Y: 0.15 }, 0, "zi"], [0.6, { s: 0.475, y: -0.6 }, 1, "zo"], [1, {}, null]]),
  A("slideInUp", "Slide in up", "انزلاق للأعلى", 1, "c", [[0, { y: 1 }, null], [1, {}, null]]),
  A("rotateIn", "Rotate in", "دوران", 1, "c", [[0, { r: -200 }, 0], [1, {}, 1]]),
  A("pulse", "Pulse", "نبض", 1, "c", [[0, {}, null], [0.5, { s: 1.05 }, null], [1, {}, null]], "io", true),
  A("heartBeat", "Heart beat", "دقات قلب", 1.3, "c", [[0, {}, null], [0.14, { s: 1.3 }, null], [0.28, {}, null], [0.42, { s: 1.3 }, null], [0.7, {}, null], [1, {}, null]], "io", true),
  A("rubberBand", "Rubber band", "مطاط", 1, "c", [[0, {}], [0.3, { sx: 1.25, sy: 0.75 }], [0.4, { sx: 0.75, sy: 1.25 }], [0.5, { sx: 1.15, sy: 0.85 }], [0.65, { sx: 0.95, sy: 1.05 }], [0.75, { sx: 1.05, sy: 0.95 }], [1, {}]], "ease", true),
  A("tada", "Tada", "تادا", 1, "c", [[0, {}], [0.1, { s: 0.9, r: -3 }], [0.2, { s: 0.9, r: -3 }], [0.3, { s: 1.1, r: 3 }], [0.4, { s: 1.1, r: -3 }], [0.5, { s: 1.1, r: 3 }], [0.6, { s: 1.1, r: -3 }], [0.7, { s: 1.1, r: 3 }], [0.8, { s: 1.1, r: -3 }], [0.9, { s: 1.1, r: 3 }], [1, {}]], "ease", true),
  A("headShake", "Head shake", "هزة رأس", 1, "c", [[0, {}], [0.065, { x: -0.04, ry: -9 }], [0.185, { x: 0.033, ry: 7 }], [0.315, { x: -0.02, ry: -5 }], [0.435, { x: 0.013, ry: 3 }], [0.5, {}], [1, {}]], "io", true),
  A("swing", "Swing", "تأرجح", 1, "t", [[0, {}], [0.2, { r: 15 }], [0.4, { r: -10 }], [0.6, { r: 5 }], [0.8, { r: -5 }], [1, {}]], "ease", true),
  // v226: more entrances (X in the picture's width)
  A("backInLeft", "Back in left", "عودة من اليسار", 1, "c", [[0, { X: -1.2, s: 0.7 }, 0.7], [0.8, { s: 0.7 }, 0.7], [1, {}, 1]]),
  A("backInRight", "Back in right", "عودة من اليمين", 1, "c", [[0, { X: 1.2, s: 0.7 }, 0.7], [0.8, { s: 0.7 }, 0.7], [1, {}, 1]]),
  A("bounceInDown", "Bounce in down", "قفزة نازلة", 1, "c", [[0, { Y: -1.2, sy: 3 }, 0, "b"], [0.6, { y: 0.25, sy: 0.9 }, 1, "b"], [0.75, { y: -0.1, sy: 0.95 }, null, "b"], [0.9, { y: 0.05, sy: 0.985 }, null, "b"], [1, {}, null]]),
  A("bounceInLeft", "Bounce in left", "قفزة من اليسار", 1, "c", [[0, { X: -1.2, sx: 3 }, 0, "b"], [0.6, { x: 0.25, sx: 1 }, 1, "b"], [0.75, { x: -0.1, sx: 0.98 }, null, "b"], [0.9, { x: 0.05, sx: 0.995 }, null, "b"], [1, {}, null]]),
  A("bounceInRight", "Bounce in right", "قفزة من اليمين", 1, "c", [[0, { X: 1.2, sx: 3 }, 0, "b"], [0.6, { x: -0.25, sx: 1 }, 1, "b"], [0.75, { x: 0.1, sx: 0.98 }, null, "b"], [0.9, { x: -0.05, sx: 0.995 }, null, "b"], [1, {}, null]]),
  A("fadeIn", "Fade in", "ظهور تدريجي", 0.8, "c", [[0, {}, 0], [1, {}, 1]]),
  A("fadeInLeft", "Fade in left", "ظهور من اليسار", 1, "c", [[0, { x: -1 }, 0], [1, {}, 1]]),
  A("fadeInRight", "Fade in right", "ظهور من اليمين", 1, "c", [[0, { x: 1 }, 0], [1, {}, 1]]),
  A("fadeInUpBig", "Rise from below", "صعود من الأسفل", 1, "c", [[0, { Y: 1.2 }, 0], [1, {}, 1]]),
  A("fadeInDownBig", "Drop from above", "نزول من الأعلى", 1, "c", [[0, { Y: -1.2 }, 0], [1, {}, 1]]),
  A("flipInY", "Flip in sideways", "انقلاب جانبي", 1, "c", [[0, { ry: 90 }, 0, "in"], [0.4, { ry: -20 }, null, "in"], [0.6, { ry: 10 }, 1], [0.8, { ry: -5 }, null], [1, {}, null]]),
  A("lightSpeedInLeft", "Light speed left", "سرعة الضوء من اليسار", 1, "c", [[0, { x: -1, k: 30 }, 0], [0.6, { k: -20 }, 1], [0.8, { k: 5 }, null], [1, {}, null]], "out"),
  A("rotateInDownLeft", "Turn in", "دوران خفيف", 1, "c", [[0, { r: -45 }, 0], [1, {}, 1]]),
  A("rotateInUpRight", "Turn in up", "دوران صاعد", 1, "c", [[0, { r: -90 }, 0], [1, {}, 1]]),
  A("zoomInDown", "Zoom in down", "تكبير نازل", 1, "c", [[0, { s: 0.1, Y: -0.6 }, 0, "zi"], [0.6, { s: 0.475, y: 0.6 }, 1, "zo"], [1, {}, null]]),
  A("zoomInLeft", "Zoom in left", "تكبير من اليسار", 1, "c", [[0, { s: 0.1, X: -0.6 }, 0, "zi"], [0.6, { s: 0.475, x: 0.1 }, 1, "zo"], [1, {}, null]]),
  A("zoomInRight", "Zoom in right", "تكبير من اليمين", 1, "c", [[0, { s: 0.1, X: 0.6 }, 0, "zi"], [0.6, { s: 0.475, x: -0.1 }, 1, "zo"], [1, {}, null]]),
  A("slideInLeft", "Slide in left", "انزلاق من اليسار", 0.8, "c", [[0, { X: -1.2 }, null], [1, {}, null]], "out"),
  A("slideInRight", "Slide in right", "انزلاق من اليمين", 0.8, "c", [[0, { X: 1.2 }, null], [1, {}, null]], "out"),
  A("slideInDown", "Slide in down", "انزلاق من الأعلى", 0.8, "c", [[0, { Y: -1.2 }, null], [1, {}, null]], "out"),
  // exits: at the clip's end
  O("backOutDown", "Back out down", "خروج نازل", 1, [[0, {}, 1], [0.2, { s: 0.7 }, 0.7], [1, { Y: 1.2, s: 0.7 }, 0.7]]),
  O("bounceOut", "Bounce out", "خروج بقفزة", 0.75, [[0, {}, null], [0.2, { s: 0.9 }, null], [0.5, { s: 1.1 }, 1], [0.55, { s: 1.1 }, 1], [1, { s: 0.3 }, 0]]),
  O("fadeOut", "Fade out", "اختفاء تدريجي", 0.8, [[0, {}, 1], [1, {}, 0]]),
  O("fadeOutDown", "Fade out down", "اختفاء نازل", 1, [[0, {}, 1], [1, { y: 1 }, 0]]),
  O("fadeOutUp", "Fade out up", "اختفاء صاعد", 1, [[0, {}, 1], [1, { y: -1 }, 0]]),
  O("zoomOut", "Zoom out", "تصغير", 1, [[0, {}, 1], [0.5, { s: 0.3 }, 0], [1, { s: 0.3 }, 0]]),
  O("rotateOut", "Turn out", "خروج بدوران", 1, [[0, {}, 1], [1, { r: 200 }, 0]]),
  O("rollOut", "Roll out", "تدحرج للخارج", 1, [[0, {}, 1], [1, { x: 1, r: 120 }, 0]]),
  O("slideOutLeft", "Slide out left", "انزلاق لليسار", 0.8, [[0, {}, null], [1, { X: -1.2 }, null]], "in"),
  O("slideOutRight", "Slide out right", "انزلاق لليمين", 0.8, [[0, {}, null], [1, { X: 1.2 }, null]], "in"),
  O("hinge", "Hinge", "مفصلة", 2, [[0, {}, 1, "io"], [0.2, { r: 80 }, null, "io"], [0.4, { r: 60 }, null, "io"], [0.6, { r: 80 }, null, "io"], [0.8, { r: 60 }, 1], [1, { Y: 0.9, r: 60 }, 0]]),
  O("lightSpeedOutRight", "Light speed out", "خروج بسرعة الضوء", 1, [[0, {}, 1], [1, { x: 1, k: 30 }, 0]], "in"),
  // loops & emphasis
  A("bounce", "Bounce", "قفز", 1, "b", [[0, {}, null, "b"], [0.2, {}, null, "b"], [0.4, { y: -0.3, sy: 1.1 }, null, "zi"], [0.43, { y: -0.3, sy: 1.1 }, null, "zi"], [0.53, {}, null, "b"], [0.7, { y: -0.15, sy: 1.05 }, null, "zi"], [0.8, { sy: 0.95 }, null, "b"], [0.9, { y: -0.04, sy: 1.02 }, null], [1, {}, null]], "ease", true),
  A("flash", "Flash", "وميض", 1, "c", [[0, null, 1], [0.25, null, 0], [0.5, null, 1], [0.75, null, 0], [1, null, 1]], "ease", true),
  A("shakeX", "Shake sideways", "اهتزاز جانبي", 1, "c", [[0, {}], [0.1, { x: -0.1 }], [0.2, { x: 0.1 }], [0.3, { x: -0.1 }], [0.4, { x: 0.1 }], [0.5, { x: -0.1 }], [0.6, { x: 0.1 }], [0.7, { x: -0.1 }], [0.8, { x: 0.1 }], [0.9, { x: -0.1 }], [1, {}]], "ease", true),
  A("shakeY", "Shake up & down", "اهتزاز عمودي", 1, "c", [[0, {}], [0.1, { y: -0.1 }], [0.2, { y: 0.1 }], [0.3, { y: -0.1 }], [0.4, { y: 0.1 }], [0.5, { y: -0.1 }], [0.6, { y: 0.1 }], [0.7, { y: -0.1 }], [0.8, { y: 0.1 }], [0.9, { y: -0.1 }], [1, {}]], "ease", true),
  A("wobble", "Wobble", "تمايل", 1, "c", [[0, {}], [0.15, { x: -0.25, r: -5 }], [0.3, { x: 0.2, r: 3 }], [0.45, { x: -0.15, r: -3 }], [0.6, { x: 0.1, r: 2 }], [0.75, { x: -0.05, r: -1 }], [1, {}]], "ease", true),
  A("float", "Float", "طفو", 2, "c", [[0, {}], [0.5, { y: -0.12 }], [1, {}]], "io", true),
  A("spin", "Spin", "دوران مستمر", 2, "c", [[0, {}], [1, { r: 360 }]], "ease", true),
  A("breathe", "Breathe", "تنفس", 2.4, "c", [[0, {}], [0.5, { s: 1.08 }], [1, {}]], "io", true),
];
export const isAnimate = (id: string) => ANIMATE.some((a) => a.id === id);
const ID: Required<T> = { x: 0, y: 0, X: 0, Y: 0, s: 1, sx: 1, sy: 1, r: 0, k: 0, rx: 0, ry: 0 };
const rad = Math.PI / 180, r5 = (n: number) => Math.round(n * 1e5) / 1e5;
/** the transform at each of the motion's frames (missing parts are at rest), with the curve that leads to the next one */
export function animateFrames(a: Animate) {
  const ts = a.frames.filter((f) => f[1]).map((f) => ({ at: f[0], t: { ...ID, ...f[1]! }, ez: f[3] || a.curve || "ease" }));
  if (!ts.length || ts[0].at > 0) ts.unshift({ at: 0, t: { ...ID }, ez: a.curve || "ease" }); if (ts[ts.length - 1].at < 1) ts.push({ at: 1, t: { ...ID }, ez: a.curve || "ease" });
  const os = a.frames.filter((f) => f[2] != null).map((f) => ({ at: f[0], o: f[2] as number, ez: f[3] || a.curve || "ease" }));
  if (!os.length || os[0].at > 0) os.unshift({ at: 0, o: os.length ? os[0].o : 1, ez: a.curve || "ease" }); if (os[os.length - 1].at < 1) os.push({ at: 1, o: os[os.length - 1].o, ez: a.curve || "ease" });
  return { ts, os };
}
/**
 * keyframes for a motion on a clip: `box` is the clip's size on the picture (fractions of the frame), for the moves that are measured
 * in the clip's own size. The clip's own position, size, turn and opacity are where it comes to rest.
 */
export function animateKeyframes(id: string, c: Pick<Clip, "dur" | "transform" | "opacity">, box = { w: 0.3, h: 0.3 }): Keyframes {
  const a = ANIMATE.find((x) => x.id === id); if (!a) return {};
  const { ts, os } = animateFrames(a); const d = Math.max(0.2, c.dur), x0 = c.transform.x || 0, y0 = c.transform.y || 0, s0 = c.transform.scale || 1, r0 = c.transform.rotation || 0, o0 = c.opacity ?? 1;
  const len = Math.min(a.dur, a.loop ? a.dur : d), gap = a.loop ? 0.5 : 0, cycles = a.loop ? Math.max(1, Math.min(40, Math.floor((d + gap) / (a.dur + gap)))) : 1;
  const start = a.out ? Math.max(0, d - len) : 0;   // an exit ends with the clip
  const out: Required<Pick<Keyframes, "x" | "y" | "scale" | "rotation" | "opacity">> = { x: [], y: [], scale: [], rotation: [], opacity: [] };
  const push = (list: Keyframe[], t: number, v: number, ez: string) => { const tt = r5(Math.min(d, t)); if (list.length && Math.abs(list[list.length - 1].t - tt) < 1e-4) list.pop(); list.push({ t: tt, v: r5(v), ease: { bezier: CURVES[ez] || CURVES.ease } }); };
  for (let k = 0; k < cycles; k++) {
    const t0 = start + k * (a.dur + gap), sc = len / a.dur;
    for (const f of ts) {
      const T = f.t, at = t0 + f.at * a.dur * sc; const squeeze = Math.sqrt(Math.abs(T.sx * Math.cos(T.ry * rad)) * Math.abs(T.sy * Math.cos(T.rx * rad)));
      push(out.x, at, x0 + T.x * box.w + T.X, f.ez); push(out.y, at, y0 + T.y * box.h + T.Y, f.ez); push(out.scale, at, Math.max(0.001, s0 * T.s * squeeze), f.ez); push(out.rotation, at, r0 + T.r, f.ez);
    }
    for (const f of os) push(out.opacity, t0 + f.at * a.dur * sc, o0 * f.o, f.ez);
  }
  const res: Keyframes = {};
  for (const [k, list] of Object.entries(out) as [keyof typeof out, Keyframe[]][]) if (list.some((x) => Math.abs(x.v - list[0].v) > 1e-6) || Math.abs(list[0].v - (k === "x" ? x0 : k === "y" ? y0 : k === "scale" ? s0 : k === "rotation" ? r0 : o0)) > 1e-6) res[k] = list;
  return res;
}
/** CSS keyframes that show the same motion on a tile (the example you see before choosing it) */
export function animateCss(a: Animate, name: string, pause = 0.7): string {
  const { ts, os } = animateFrames(a); const tot = a.dur + pause, pc = (at: number) => r5((at * a.dur / tot) * 100);
  const stops = new Map<number, string[]>();
  for (const f of ts) { const T = f.t; (stops.get(f.at) || stops.set(f.at, []).get(f.at)!).push(`transform:translate(${r5((T.x + T.X * 3) * 100)}%,${r5((T.y + T.Y * 2.4) * 100)}%) scale(${r5(T.s * T.sx)},${r5(T.s * T.sy)}) rotate(${T.r}deg) skewX(${T.k}deg) rotateX(${T.rx}deg) rotateY(${T.ry}deg)`, `animation-timing-function:cubic-bezier(${(CURVES[f.ez] || CURVES.ease).join(",")})`); }
  for (const f of os) (stops.get(f.at) || stops.set(f.at, []).get(f.at)!).push(`opacity:${f.o}`);
  const rows = [...stops.entries()].sort((x, y) => x[0] - y[0]).map(([at, p]) => `${pc(at)}%{${p.join(";")}}`);
  const last = ts[ts.length - 1].t, lo = os[os.length - 1].o;
  rows.push(`100%{transform:translate(${r5((last.x + last.X * 3) * 100)}%,${r5((last.y + last.Y * 2.4) * 100)}%) scale(${last.s * last.sx},${last.s * last.sy}) rotate(${last.r}deg);opacity:${lo}}`);
  return `@keyframes ${name}{${rows.join("")}}`;
}
