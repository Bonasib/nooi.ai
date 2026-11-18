// nooi Motion's drawing kit: the types of a template and its props, and the helpers every template uses (RTL-aware text,
// rounded boxes, springs, in/out timing, field makers). Our own code.
import { Motion as M } from "@nooi/editor-core";

export type FieldType = "text" | "color" | "number" | "select" | "bool" | "list" | "code" | "pics";   // (v247: pics — picture asset ids from the library)
export interface Field { k: string; type: FieldType; en: string; ar: string; def: unknown; min?: number; max?: number; step?: number; options?: [string, string, string][] }
export type Props = Record<string, any>;   // eslint-disable-line @typescript-eslint/no-explicit-any
export interface MCtx {
  ctx: CanvasRenderingContext2D; W: number; H: number; u: number;   // u: the shorter side (sizes are shares of it)
  frame: number; fps: number; t: number; dur: number; durF: number; p: Props;
  audio: (t?: number) => number; bars: (n: number) => number[];
}
export interface Template { id: string; en: string; ar: string; group: Group; dur: number; fields: Field[]; draw: (m: MCtx) => void }
export type Group = "lower" | "titles" | "social" | "data" | "infographics" | "shapes" | "callouts" | "timers" | "audio" | "intros" | "wipes" | "badges" | "frames" | "backgrounds" | "code" | "3d" | "drawn" | "scenes";

// ---- drawing helpers
export const AR = /[֐-ࣿ]/;
export const FAM = '"Inter","Cairo","IBM Plex Sans Arabic",system-ui,sans-serif';
export const ease = M.Easing;
export const cl = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export function font(x: CanvasRenderingContext2D, px: number, weight = 700, fam = FAM) { x.font = `${weight} ${Math.max(1, px)}px ${fam}`; }
export function text(m: MCtx, s: string, X: number, Y: number, o: { px: number; weight?: number; color?: string; align?: CanvasTextAlign; base?: CanvasTextBaseline; fam?: string; maxW?: number }) {
  const x = m.ctx; let px = o.px; font(x, px, o.weight, o.fam); if (o.maxW) { const w = x.measureText(s).width; if (w > o.maxW) { px *= o.maxW / w; font(x, px, o.weight, o.fam); } }
  x.direction = AR.test(s) ? "rtl" : "ltr"; x.textAlign = o.align || "left"; x.textBaseline = o.base || "middle"; x.fillStyle = o.color || "#fff"; x.fillText(s, X, Y); return { px, w: x.measureText(s).width };
}
export const measure = (m: MCtx, s: string, px: number, weight = 700, fam = FAM) => { font(m.ctx, px, weight, fam); return m.ctx.measureText(s).width; };
export function rrect(x: CanvasRenderingContext2D, X: number, Y: number, w: number, h: number, r: number) { x.beginPath(); if (x.roundRect) x.roundRect(X, Y, Math.max(0, w), Math.max(0, h), Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2))); else x.rect(X, Y, w, h); }
export const sp = (m: MCtx, delay = 0, cfg: M.SpringConfig = { damping: 14, stiffness: 120 }) => M.spring({ frame: m.frame - delay, fps: m.fps, config: cfg });
/** in from the start (0 → 1) and out at the end (1 → 0) */
export const life = (m: MCtx, inS = 0.5, outS = 0.4) => Math.min(cl(m.t / inS), cl((m.dur - m.t) / outS));
export const outK = (m: MCtx, outS = 0.4) => ease.easeIn(cl(1 - (m.dur - m.t) / outS));
export const T = (k: string, type: FieldType, en: string, ar: string, def: unknown, o: Partial<Field> = {}): Field => ({ k, type, en, ar, def, ...o });
export const words = (s: string) => String(s || "").split(/\s+/).filter(Boolean);
export const nums = (s: string) => String(s || "").split(/[,،\s]+/).map((v) => parseFloat(v)).filter((v) => isFinite(v));
export const labels = (s: string) => String(s || "").split(/[,،]+/).map((v) => v.trim());
export const BG = (o: Partial<Field> = {}) => T("accent", "color", "Accent", "اللون المميز", "#00F0FF", o);

export const L3 = (name: string, role: string) => [T("name", "text", "Name", "الاسم", [name, "أحمد علي"]), T("role", "text", "Title", "المسمى", [role, "مدير التسويق"]), BG(), T("pos", "select", "Place", "المكان", "left", { options: [["left", "Left", "يسار"], ["center", "Centre", "وسط"], ["right", "Right", "يمين"]] })];
export const px0 = (m: MCtx, w: number) => (m.p.pos === "right" ? m.W * 0.94 - w : m.p.pos === "center" ? (m.W - w) / 2 : m.W * 0.06);

