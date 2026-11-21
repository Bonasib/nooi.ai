// (v277) Filmora-16-class tools that need maths but no drawing: 360° camera values over time, a followed (tracked) point,
// where a source point lands in the frame, and the tracker itself (template matching on small grey frames — CPU only).
import type { Asset, ColorMask, MediaClip, Pano, Project, TrackPath, Clip } from "./schema";
import { findClip, propAt } from "./timeline";

export const CMASK_DEFAULT: ColorMask = { on: true, hue: 0, range: 0.06, soft: 0.06, minSat: 0.15, hueShift: 0, sat: 0, exposure: 0, invert: false, show: false };
export const PANO_DEFAULT: Pano = { on: true, yaw: 0, pitch: 0, roll: 0, fov: 90, move: false, yaw2: 60, pitch2: 0, fov2: 90 };

/** hue (0..1) of a "#rrggbb" colour */
export function hueOf(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16) || 0; const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 1e-6) return 0;
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; return h;
}

const smooth = (k: number) => k * k * (3 - 2 * k);
/** the 360° camera at a moment of the clip (degrees); with `move` it travels from the first values to the second, eased */
export function panoAt(c: MediaClip, local: number): { yaw: number; pitch: number; roll: number; fov: number } | null {
  const v = c.pano; if (!v || !v.on) return null;
  if (!v.move) return { yaw: v.yaw, pitch: v.pitch, roll: v.roll, fov: v.fov };
  const k = smooth(Math.max(0, Math.min(1, c.dur > 0 ? local / c.dur : 0)));
  return { yaw: v.yaw + (v.yaw2 - v.yaw) * k, pitch: v.pitch + (v.pitch2 - v.pitch) * k, roll: v.roll, fov: v.fov + (v.fov2 - v.fov) * k };
}

/** the followed point (source fractions, centre) at a moment of the clip — linear between the tracked samples */
export function trackAt(tr: TrackPath | null | undefined, local: number): [number, number] | null {
  if (!tr || !tr.pts.length) return null; const p = tr.pts;
  if (local <= p[0][0]) return [p[0][1], p[0][2]];
  if (local >= p[p.length - 1][0]) { const e = p[p.length - 1]; return [e[1], e[2]]; }
  let i = 1; while (i < p.length && p[i][0] < local) i++;
  const a = p[i - 1], b = p[i], k = (local - a[0]) / Math.max(1e-6, b[0] - a[0]);
  return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/** a source point (fractions of the picture, from the top-left) → where it is drawn (frame fractions, 0 = centre, y down),
 *  through the clip's fit ("contain"), crop, scale, turn, flip and move at that moment */
export function srcToFrame(c: Clip, a: Asset | undefined, W: number, H: number, u: number, v: number, local: number, noMove = false): [number, number] {
  const tr = c.transform; const sw0 = a?.w || W, sh0 = a?.h || H;
  const cw = sw0 * (1 - tr.crop[0] - tr.crop[2]), ch = sh0 * (1 - tr.crop[1] - tr.crop[3]);
  const cu = (u - tr.crop[0]) / Math.max(1e-6, 1 - tr.crop[0] - tr.crop[2]), cv = (v - tr.crop[1]) / Math.max(1e-6, 1 - tr.crop[1] - tr.crop[3]);
  const at = Math.max(0, Math.min(c.dur, local)); const sc = propAt(c, "scale", at), rot = (propAt(c, "rotation", at) * Math.PI) / 180;
  const base = Math.min(W / Math.max(1, cw), H / Math.max(1, ch)) * sc;
  let px = (cu - 0.5) * cw * base * (tr.flipH ? -1 : 1), py = (cv - 0.5) * ch * base * (tr.flipV ? -1 : 1);
  const co = Math.cos(rot), si = Math.sin(rot); const rx = px * co - py * si, ry = px * si + py * co; px = rx; py = ry;
  return [(noMove ? 0 : propAt(c, "x", at)) + px / W, (noMove ? 0 : propAt(c, "y", at)) + py / H];
}

/** how far a clip that follows a tracked clip moves at time t (frame fractions) — the point's travel since this clip began */
export function followOffset(p: Project, c: Clip, t: number, W: number, H: number): [number, number] {
  if (!c.follow) return [0, 0]; const f = findClip(p, c.follow.clip); if (!f || f.clip.type !== "media" || !f.clip.track) return [0, 0];
  const m = f.clip, a = p.assets[m.asset];
  const p0 = trackAt(m.track, c.start - m.start), p1 = trackAt(m.track, t - m.start); if (!p0 || !p1) return [0, 0];
  const A0 = srcToFrame(m, a, W, H, p0[0], p0[1], c.start - m.start), A1 = srcToFrame(m, a, W, H, p1[0], p1[1], t - m.start);
  return [A1[0] - A0[0], A1[1] - A0[1]];
}

/** "lock": the tracked clip itself moved against its subject's travel, so the subject stays where it was in the first frame
 *  (a stabiliser for one subject); returns the move (frame fractions) and a little zoom that hides the edges it uncovers */
export function lockOffset(c: MediaClip, a: Asset | undefined, local: number, W: number, H: number): { dx: number; dy: number; zoom: number } {
  const tr = c.track; if (!tr || !tr.lock || !tr.pts.length) return { dx: 0, dy: 0, zoom: 1 };
  const p0 = trackAt(tr, 0)!, p1 = trackAt(tr, local)!;
  const A0 = srcToFrame(c, a, W, H, p0[0], p0[1], local, true), A1 = srcToFrame(c, a, W, H, p1[0], p1[1], local, true);
  let maxd = 0; for (const q of tr.pts) { const B = srcToFrame(c, a, W, H, q[1], q[2], 0, true); maxd = Math.max(maxd, Math.abs(B[0] - A0[0]) * 2, Math.abs(B[1] - A0[1]) * 2); }
  const zoom = 1 + Math.min(0.5, maxd) * tr.lock;
  // the picture is scaled by zoom about its own centre C; dx/dy then put the subject back where it was in the first frame,
  // so the subject stays exactly still (lock 1) however near the edge it is — the zoom only hides the borders the shift opens
  const cr = c.transform.crop; const C = srcToFrame(c, a, W, H, cr[0] + (1 - cr[0] - cr[2]) / 2, cr[1] + (1 - cr[1] - cr[3]) / 2, local, true), k = tr.lock;
  const tx = A0[0] - C[0] - (A1[0] - C[0]) * zoom, ty = A0[1] - C[1] - (A1[1] - C[1]) * zoom;
  return { dx: tx * k, dy: ty * k, zoom };
}

// ---------- the tracker: follows a box through grey frames by template matching (sum of squared differences, mean removed)
export interface Gray { data: Float32Array; w: number; h: number }
function patch(g: Gray, cx: number, cy: number, pw: number, ph: number): Float32Array | null {
  const x0 = Math.round(cx - pw / 2), y0 = Math.round(cy - ph / 2); if (x0 < 0 || y0 < 0 || x0 + pw > g.w || y0 + ph > g.h) return null;
  const out = new Float32Array(pw * ph); let m = 0;
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) { const v = g.data[(y0 + y) * g.w + x0 + x]; out[y * pw + x] = v; m += v; }
  m /= out.length; for (let i = 0; i < out.length; i++) out[i] -= m; (out as Float32Array & { mean?: number }).mean = m; return out;
}
// normalised cross-correlation (1 = the same look), returned as a cost (lower is better): a plain difference prefers an empty
// background over being a pixel off a bright edge; correlation doesn't
function cost(g: Gray, tpl: Float32Array, tn: number, pw: number, ph: number, cx: number, cy: number): number {
  const x0 = Math.round(cx - pw / 2), y0 = Math.round(cy - ph / 2); if (x0 < 0 || y0 < 0 || x0 + pw > g.w || y0 + ph > g.h) return Infinity;
  let m = 0; for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) m += g.data[(y0 + y) * g.w + x0 + x];
  m /= pw * ph; let dot = 0, cn = 0;
  for (let y = 0; y < ph; y++) { const r = (y0 + y) * g.w + x0, t = y * pw; for (let x = 0; x < pw; x++) { const v = g.data[r + x] - m; dot += v * tpl[t + x]; cn += v * v; } }
  const tm = (tpl as Float32Array & { mean?: number }).mean ?? m, sd = Math.sqrt(tn / tpl.length) + 8;
  return 1 - dot / (Math.sqrt(cn * tn) + 1e-6) + 0.25 * ((m - tm) / sd) ** 2;   // and the same brightness
}
/** box: x, y, w, h as fractions of the frame (from the top-left); returns the box centre in each frame (fractions) */
export function trackFrames(frames: Gray[], box: [number, number, number, number], radius = 0.08): [number, number][] {
  if (!frames.length) return [];
  const g0 = frames[0]; const pw = Math.max(6, Math.min(64, Math.round(box[2] * g0.w))), ph = Math.max(6, Math.min(64, Math.round(box[3] * g0.h)));
  let cx = (box[0] + box[2] / 2) * g0.w, cy = (box[1] + box[3] / 2) * g0.h;
  let tpl = patch(g0, cx, cy, pw, ph); const first = tpl; const out: [number, number][] = [[cx / g0.w, cy / g0.h]];
  const R = Math.max(4, Math.round(radius * Math.max(g0.w, g0.h)));
  for (let i = 1; i < frames.length; i++) {
    const g = frames[i]; if (!tpl) { out.push([cx / g.w, cy / g.h]); continue; }
    let tn = 0; for (let k = 0; k < tpl.length; k++) tn += tpl[k] * tpl[k];
    let best = Infinity, bx = cx, by = cy;
    for (let dy = -R; dy <= R; dy += 2) for (let dx = -R; dx <= R; dx += 2) { const c = cost(g, tpl, tn, pw, ph, cx + dx, cy + dy); if (c < best) { best = c; bx = cx + dx; by = cy + dy; } }
    const cx2 = bx, cy2 = by;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const c = cost(g, tpl, tn, pw, ph, cx2 + dx, cy2 + dy); if (c < best) { best = c; bx = cx2 + dx; by = cy2 + dy; } }
    cx = bx; cy = by; out.push([cx / g.w, cy / g.h]);
    // the look of the subject changes slowly: the template follows it, held to the first look so it doesn't drift away
    const now = patch(g, cx, cy, pw, ph); if (now && first) { const n = new Float32Array(tpl.length) as Float32Array & { mean?: number }; for (let k = 0; k < n.length; k++) n[k] = tpl[k] * 0.75 + now[k] * 0.15 + first[k] * 0.1; const pm = (tpl as Float32Array & { mean?: number }).mean ?? 0, nm = (now as Float32Array & { mean?: number }).mean ?? pm; n.mean = pm * 0.85 + nm * 0.15; tpl = n; }
  }
  return out;
}

// ================= (v278) nesting: clips (on any video tracks) become one clip whose picture is a file made from them; un-nesting puts them back
import type { Clip as Clip278, MediaClip as MC278, Project as P278, TrackKind as TK278 } from "./schema";
export function nestRange278(p: P278, ids: string[]): { start: number; end: number } | null {
  let a = Infinity, b = -Infinity; for (const t of p.tracks) for (const c of t.clips) if (ids.includes(c.id)) { a = Math.min(a, c.start); b = Math.max(b, c.start + c.dur); }
  return isFinite(a) ? { start: a, end: b } : null;
}
/** the project with only the picked clips (for making the nested file); times stay as they are */
export function nestOnly278(p: P278, ids: string[]): P278 {
  const q = structuredClone(p); for (const t of q.tracks) t.clips = t.clips.filter((c) => ids.includes(c.id)); q.transitions = q.transitions.filter((x) => ids.includes(x.a) && ids.includes(x.b)); return q;
}
/** replace the picked clips by one clip of `asset` (made from them) on the lowest track they used; returns the new clip's id */
export function nest278(p: P278, ids: string[], asset: string, mk: (o: Partial<MC278>) => MC278): string | null {
  const r = nestRange278(p, ids); if (!r) return null; const kept: { kind: TK278; clips: Clip278[] }[] = []; let low = -1;
  p.tracks.forEach((t, i) => { const mine = t.clips.filter((c) => ids.includes(c.id)); if (mine.length) { kept.push({ kind: t.kind, clips: structuredClone(mine) }); if (t.kind === "video") low = i; t.clips = t.clips.filter((c) => !ids.includes(c.id)); } });
  if (low < 0) low = p.tracks.findIndex((t) => t.kind === "video");
  p.transitions = p.transitions.filter((x) => !ids.includes(x.a) && !ids.includes(x.b));
  const c = mk({ asset, start: r.start, dur: r.end - r.start, in: 0, nested: { tracks: kept, start: r.start } });
  p.tracks[low].clips.push(c); p.tracks[low].clips.sort((x, y) => x.start - y.start); return c.id;
}
/** put a nested clip's clips back where they were (moved with the nested clip if it was moved) */
export function unnest278(p: P278, id: string): string[] {
  for (const t of p.tracks) { const i = t.clips.findIndex((c) => c.id === id); if (i < 0) continue; const c = t.clips[i] as MC278; if (!c.nested) return [];
    const d = c.start - c.nested.start, back: string[] = []; t.clips.splice(i, 1);
    for (const g of c.nested.tracks) { let tr = p.tracks.find((x) => x.kind === g.kind && !x.clips.some((y) => g.clips.some((z) => z.start + d < y.start + y.dur && y.start < z.start + d + z.dur)));
      if (!tr) { tr = { id: "t" + Math.random().toString(36).slice(2, 9), kind: g.kind, name: (g.kind === "audio" ? "A" : g.kind === "text" ? "T" : "V") + (p.tracks.length + 1), locked: false, muted: false, hidden: false, solo: false, clips: [] }; p.tracks.unshift(tr); }
      for (const z of g.clips) { z.start += d; tr.clips.push(z); back.push(z.id); } tr.clips.sort((x, y) => x.start - y.start); }
    return back; }
  return [];
}
