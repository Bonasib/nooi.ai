// (v234) Separating a person from the background.
//  · The colour key (a green / blue screen, or any flat backdrop): a clip effect "key" — pixels near the picked colour turn
//    see-through. Distance as FFmpeg's chromakey measures it (the colour part of YUV), so the preview and a server export agree:
//    diff = √((Δu² + Δv²) / 2); see-through below `sim`, opaque above sim + soft. `spill` takes the screen's colour out of the edges.
//  · A cut-out video (no screen needed): the editor finds the person on the device and keeps the picture with its see-through
//    mask below it (an asset with alpha "stacked": the picture on the top half, the mask as grey on the bottom half).
import type { Clip, Effect, Id, MediaClip, Project, Track } from "./schema";
import { addTrack, findClip, sortTrack } from "./timeline";
import { anchorAt, spineOf } from "./anchors";

export interface Key { color: string; sim: number; soft: number; spill: number }
export const KEY0: Key = { color: "#00ff00", sim: 0.12, soft: 0.1, spill: 0.6 };
export const isHex = (s: unknown): s is string => typeof s === "string" && /^#[0-9a-f]{6}$/i.test(s);
export function keyOf(c: { effects?: Effect[] }): Key | null {
  const e = c.effects?.find((x) => x.type === "key" && x.enabled); if (!e) return null;
  const n = (v: unknown, d: number, a: number, b: number) => { const x = Number(v); return isFinite(x) ? Math.max(a, Math.min(b, x)) : d; };
  return { color: isHex(e.params.color) ? e.params.color.toLowerCase() : KEY0.color, sim: n(e.params.sim, KEY0.sim, 0.001, 1), soft: n(e.params.soft, KEY0.soft, 0, 1), spill: n(e.params.spill, KEY0.spill, 0, 1) };
}
export const rgbOf = (hex: string): [number, number, number] => { const v = parseInt(hex.slice(1), 16) || 0; return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]; };
export const hexOf = (r: number, g: number, b: number) => "#" + [r, g, b].map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, "0")).join("");
/** the colour part of a colour (BT.601, as FFmpeg's chromakey) */
export const uvOf = (r: number, g: number, b: number): [number, number] => [-0.168736 * r - 0.331264 * g + 0.5 * b, 0.5 * r - 0.418688 * g - 0.081312 * b];
/** how see-through a colour is under a key: 0 = gone, 1 = kept */
export function keyAlpha(k: Key, r: number, g: number, b: number): number {
  const [kr, kg, kb] = rgbOf(k.color), [u, v] = uvOf(r, g, b), [ku, kv] = uvOf(kr, kg, kb);
  const diff = Math.sqrt(((u - ku) ** 2 + (v - kv) ** 2) / 2);
  return k.soft > 1e-4 ? Math.max(0, Math.min(1, (diff - k.sim) / k.soft)) : diff > k.sim ? 1 : 0;
}
/** which screen the key's colour is, for taking its colour out of the edges: 1 green, 2 blue, 0 another colour */
export function screenOf(hex: string): 0 | 1 | 2 { const [r, g, b] = rgbOf(hex); return g > r && g > b ? 1 : b > r && b > g ? 2 : 0; }
export function keyEffect(k: Partial<Key> = {}): Effect {
  return { id: "fx" + Math.random().toString(36).slice(2, 9), type: "key", enabled: true, params: { ...KEY0, ...k, amount: 1 } };
}
/** put a key on a clip (or change its settings) */
export function setKey(c: MediaClip, k: Partial<Key> | null) {
  const i = c.effects.findIndex((x) => x.type === "key");
  if (!k) { if (i >= 0) c.effects.splice(i, 1); return; }
  if (i >= 0) c.effects[i] = { ...c.effects[i], enabled: true, params: { ...c.effects[i].params, ...k } }; else c.effects.unshift(keyEffect(k));
}
export const stacked = (p: Project, c: MediaClip) => p.assets[c.asset]?.alpha === "stacked";

/** the screen colour of a picture: the most common strong colour around its edges (null when the edges aren't one colour) */
export function screenColor(px: Uint8ClampedArray | Uint8Array, w: number, h: number): { color: string; share: number; hue: number; sat: number } | null {
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>(); let all = 0;
  const band = Math.max(1, Math.round(Math.min(w, h) * 0.08));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x >= band && x < w - band && y >= band && y < h - band) continue;
    const i = (y * w + x) * 4, r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255; all++;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx ? (mx - mn) / mx : 0; if (s < 0.3 || mx < 0.18) continue;
    let hue = 0; const d = mx - mn; if (mx === r) hue = ((g - b) / d) % 6; else if (mx === g) hue = (b - r) / d + 2; else hue = (r - g) / d + 4;
    const bin = Math.floor((((hue * 60) + 360) % 360) / 15); const o = bins.get(bin) || { n: 0, r: 0, g: 0, b: 0 }; o.n++; o.r += r; o.g += g; o.b += b; bins.set(bin, o);
  }
  let best: { n: number; r: number; g: number; b: number } | null = null; for (const o of bins.values()) if (!best || o.n > best.n) best = o;
  if (!best || !all || best.n / all < 0.35) return null;
  const r = best.r / best.n, g = best.g / best.n, b = best.b / best.n, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn || 1;
  const hue = ((mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360;
  return { color: hexOf(r, g, b), share: best.n / all, hue: Math.round(hue), sat: Math.round((mx ? (mx - mn) / mx : 0) * 100) / 100 };
}
/** a real studio screen, safe to key without asking: green, or a strong chroma blue, around most of the picture's edges (a blue sky
 *  or a coloured wall is not one — those get the cut-out) */
export const isStudioScreen = (s: { share: number; hue: number; sat: number } | null) =>
  !!s && s.share >= 0.5 && ((s.hue >= 80 && s.hue <= 165 && s.sat >= 0.4) || (s.hue >= 200 && s.hue <= 250 && s.sat >= 0.7));

// ---- a new background under a clip
/** the background clips placed under a clip (by an earlier pick) */
export const backdropsOf = (p: Project, id: Id) => p.tracks.flatMap((t) => t.clips.filter((c) => c.backdrop === id).map((c) => ({ t, c })));
/**
 * put new background clips under a clip, filling its time. On the main track (V1) the person moves up onto a track of its own and
 * the background takes its place, as in pro editors (the background is the footage, the person a layer attached to it); on another
 * track the background goes on a new track just below it. A background picked before for that clip is replaced in the same place.
 */
export function putUnder(p: Project, personId: Id, make: (start: number, dur: number) => Clip[]): Clip[] {
  const f = findClip(p, personId); if (!f) return [];
  const person = f.clip, old = backdropsOf(p, personId).sort((a, b) => a.c.start - b.c.start); let target: Track | null = old[0]?.t || null;
  const oldIds = new Set(old.map((o) => o.c.id)), oldFirst = old[0]?.c.id, oldLast = old[old.length - 1]?.c.id;
  for (const o of old) o.t.clips.splice(o.t.clips.indexOf(o.c), 1);
  let swapped = false; const spine = spineOf(p);
  if (!target) {
    if (f.track === spine) { const ov = addTrack(p, "video", p.tracks.indexOf(spine)); spine.clips.splice(spine.clips.indexOf(person), 1); ov.clips.push(person); target = spine; swapped = true; }
    else target = addTrack(p, "video", p.tracks.indexOf(f.track) + 1);
  }
  const list = make(person.start, person.dur); if (!list.length) return list;
  for (const c of list) { c.backdrop = personId; target.clips.push(c); } sortTrack(target);
  const first = list[0], last = list[list.length - 1];
  // the cuts' transitions and what was attached: from the person (it left V1) or from the old background, to the new one
  p.transitions = p.transitions.filter((x) => !(oldIds.has(x.a) && x.a !== oldLast) && !(oldIds.has(x.b) && x.b !== oldFirst));
  for (const x of p.transitions) { if ((swapped && x.a === personId) || x.a === oldLast) x.a = last.id; if ((swapped && x.b === personId) || x.b === oldFirst) x.b = first.id; }
  for (const t of p.tracks) for (const c of t.clips) if (c.anchor && (oldIds.has(c.anchor.clip) || (swapped && c.anchor.clip === personId))) { const h = list.find((b) => c.start >= b.start - 1e-6 && c.start < b.start + b.dur) || first; c.anchor = { clip: h.id, at: anchorAt(h, c.start) }; }
  if (swapped && p.magnetic !== false) person.anchor = { clip: first.id, at: anchorAt(first, person.start) };
  return list;
}
/** take a clip's background away; when it had taken the clip's place on V1, the clip goes back there */
export function removeBackdrop(p: Project, personId: Id): boolean {
  const old = backdropsOf(p, personId).sort((a, b) => a.c.start - b.c.start); if (!old.length) return false;
  const f = findClip(p, personId), ids = new Set(old.map((o) => o.c.id)), t0 = old[0].t, spine = spineOf(p);
  for (const o of old) o.t.clips.splice(o.t.clips.indexOf(o.c), 1);
  if (f && t0 === spine && f.track !== spine && !spine.clips.some((c) => c.start < f.clip.start + f.clip.dur - 1e-6 && c.start + c.dur > f.clip.start + 1e-6)) {
    f.track.clips.splice(f.track.clips.indexOf(f.clip), 1); spine.clips.push(f.clip); sortTrack(spine); delete f.clip.anchor;
    for (const x of p.transitions) { if (x.a === old[old.length - 1].c.id) x.a = personId; if (x.b === old[0].c.id) x.b = personId; }
    for (const t of p.tracks) for (const c of t.clips) if (c.anchor && ids.has(c.anchor.clip)) c.anchor = { clip: personId, at: anchorAt(f.clip, c.start) };
    if (!f.track.clips.length) p.tracks.splice(p.tracks.indexOf(f.track), 1);
  } else if (!t0.clips.length && t0 !== spine) p.tracks.splice(p.tracks.indexOf(t0), 1);
  p.transitions = p.transitions.filter((x) => !ids.has(x.a) && !ids.has(x.b));
  return true;
}
