// Timeline operations. Every function here changes the project it is given (the store hands them a copy), so undo is a step back.
import { mediaClip, track as mkTrack, uid } from "./defaults";
import { valueAt } from "./easing";
import type { Asset, Clip, Id, KfProp, Keyframe, Keyframes, MediaClip, Project, Track, TrackKind, Transition } from "./schema";

export const MIN_DUR = 0.1;
export const EPS = 1e-4;
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
export const clipEnd = (c: Clip) => c.start + c.dur;

export function findClip(p: Project, id: Id): { track: Track; clip: Clip; index: number } | null {
  for (const t of p.tracks) { const i = t.clips.findIndex((c) => c.id === id); if (i >= 0) return { track: t, clip: t.clips[i], index: i }; }
  return null;
}
export const trackOf = (p: Project, id: Id) => p.tracks.find((t) => t.id === id) || null;
export function sortTrack(t: Track) { t.clips.sort((a, b) => a.start - b.start); }
export function duration(p: Project): number { let d = 0; for (const t of p.tracks) for (const c of t.clips) d = Math.max(d, clipEnd(c)); return r6(d); }

// how much source a media clip may use (stills and frozen frames: no limit)
export function srcLimit(p: Project, c: Clip): number {
  if (c.type !== "media" || c.freeze != null) return Infinity;
  const a = p.assets[c.asset]; if (!a || a.kind === "image" || !a.duration) return Infinity;
  return a.duration;
}
// the source second a media clip shows at `local` seconds from its start (handles speed, reverse and frozen frames)
export function sourceTime(c: MediaClip, local: number, limit = Infinity): number {
  if (c.freeze != null) return c.freeze;
  const s = c.reverse ? c.in + (c.dur - local) * c.speed : c.in + local * c.speed;
  return Math.max(0, Math.min(limit === Infinity ? s : limit - 1 / 120, s));
}
export const propAt = (c: Clip, prop: KfProp, local: number): number => {
  const base = prop === "opacity" ? c.opacity : prop === "volume" ? (c.type === "media" ? c.volume : 0) : prop === "scale" ? c.transform.scale :
    prop === "rotation" ? c.transform.rotation : prop === "x" ? c.transform.x : c.transform.y;
  return valueAt(c.keyframes[prop], local, base);
};
// the sound level of a media clip at `local`: its volume (keyframes) with its fades
export function gainAt(c: MediaClip, local: number): number {
  if (c.muted) return 0;
  let g = propAt(c, "volume", local);
  if (c.fadeIn > 0 && local < c.fadeIn) g *= Math.max(0, local / c.fadeIn);
  if (c.fadeOut > 0 && local > c.dur - c.fadeOut) g *= Math.max(0, (c.dur - local) / c.fadeOut);
  return g;
}

// ---- free space on a track
export function overlaps(t: Track, start: number, end: number, skip: Set<Id> = new Set()): boolean {
  return t.clips.some((c) => !skip.has(c.id) && start < clipEnd(c) - EPS && end > c.start + EPS);
}
export function freeSpot(t: Track, start: number, dur: number, skip: Set<Id> = new Set()): number {
  start = Math.max(0, start);
  if (!overlaps(t, start, start + dur, skip)) return start;
  const others = t.clips.filter((c) => !skip.has(c.id));
  const cands = [0, ...others.map(clipEnd), ...others.map((c) => c.start - dur)].filter((x) => x >= 0 && !overlaps(t, x, x + dur, skip));
  cands.sort((a, b) => Math.abs(a - start) - Math.abs(b - start));
  return cands.length ? cands[0] : others.reduce((m, c) => Math.max(m, clipEnd(c)), 0);
}
const kindFits = (k: TrackKind, c: Clip, p: Project) => c.type === "text" ? k === "text" || k === "video" :
  (p.assets[c.asset]?.kind === "audio" ? k === "audio" : k === "video" || (k === "audio" && !!c.link));
export function trackForClip(p: Project, c: Clip): Track {
  const a = c.type === "media" ? p.assets[c.asset] : null;
  const want: TrackKind = c.type === "text" ? "text" : a?.kind === "audio" ? "audio" : "video";
  // the main track first: the lowest video track (V1), the first audio track, the top text track
  const order = want === "video" ? [...p.tracks].reverse() : p.tracks;
  let t = order.find((x) => x.kind === want && !x.locked && !overlaps(x, c.start, c.start + c.dur));
  if (!t) { t = mkTrack(want, (want === "audio" ? "A" : want === "text" ? "T" : "V") + (p.tracks.filter((x) => x.kind === want).length + 1)); if (want === "audio") p.tracks.push(t); else p.tracks.unshift(t); }
  return t;
}

// ---- adding
export function addClip(p: Project, c: Clip, trackId?: Id | null, mode: "free" | "insert" = "free"): Clip {
  let t = trackId ? trackOf(p, trackId) : null;
  if (!t || t.locked || !kindFits(t.kind, c, p)) t = trackForClip(p, c);
  if (mode === "insert") {
    const cut = t.clips.find((x) => c.start > x.start + EPS && c.start < clipEnd(x) - EPS);
    if (cut) split(p, cut.id, c.start);
    for (const x of t.clips) if (x.start >= c.start - EPS) x.start = r6(x.start + c.dur);
  } else c.start = freeSpot(t, c.start, c.dur);
  c.start = r6(c.start); t.clips.push(c); sortTrack(t); return c;
}
export function addAssetClip(p: Project, a: Asset, at: number, trackId?: Id | null, mode: "free" | "insert" = "free"): Clip {
  return addClip(p, mediaClip(a, at), trackId, mode);
}
// where a tapped (not dropped) file goes: pictures and videos after the last clip on the main video track, sounds at the playhead
export function mainTrackEnd(p: Project, kind: "video" | "audio" | "text"): number {
  const t = (kind === "video" ? [...p.tracks].reverse() : p.tracks).find((x) => x.kind === kind && !x.locked);
  return t ? t.clips.reduce((m, c) => Math.max(m, clipEnd(c)), 0) : 0;
}

// ---- moving
export function moveClip(p: Project, id: Id, start: number, toTrack?: Id | null): boolean {
  const f = findClip(p, id); if (!f || f.track.locked) return false;
  let t = toTrack ? trackOf(p, toTrack) : f.track;
  if (!t || t.locked || !kindFits(t.kind, f.clip, p)) t = f.track;
  const skip = new Set([id]);
  const s = freeSpot(t, start, f.clip.dur, skip);
  if (t !== f.track) { f.track.clips.splice(f.index, 1); t.clips.push(f.clip); dropTransitions(p, id); }
  else if (Math.abs(s - f.clip.start) > EPS) dropTransitions(p, id);
  f.clip.start = r6(s); sortTrack(t); return true;
}

// ---- trimming (an edge dragged to t). Ripple: the clips after it follow.
export function trim(p: Project, id: Id, edge: "start" | "end", t: number, ripple = false): boolean {
  const f = findClip(p, id); if (!f || f.track.locked) return false;
  const c = f.clip, lim = srcLimit(p, c), end0 = clipEnd(c);
  const others = f.track.clips.filter((x) => x.id !== id);
  if (edge === "end") {
    let e = Math.max(c.start + MIN_DUR, t);
    if (c.type === "media" && c.freeze == null) {
      if (c.reverse) e = Math.min(e, end0 + c.in / c.speed);                       // a reversed clip runs toward the source's start
      else if (lim !== Infinity) e = Math.min(e, c.start + (lim - c.in) / c.speed);
    }
    if (!ripple) { const nx = others.filter((x) => x.start >= end0 - EPS).sort((a, b) => a.start - b.start)[0]; if (nx) e = Math.min(e, nx.start); }
    const d = e - end0;
    if (c.type === "media" && c.reverse && c.freeze == null) c.in = r6(Math.max(0, c.in - d * c.speed));
    c.dur = r6(e - c.start);
    if (ripple) for (const x of others) if (x.start >= end0 - EPS) x.start = r6(x.start + d);
  } else {
    let s = Math.min(t, end0 - MIN_DUR);
    if (c.type === "media" && c.freeze == null) {
      if (!c.reverse) s = Math.max(s, c.start - c.in / c.speed);
      else if (lim !== Infinity) s = Math.max(s, c.start - (lim - (c.in + c.dur * c.speed)) / c.speed);
    }
    if (!ripple) { const pv = others.filter((x) => clipEnd(x) <= c.start + EPS).sort((a, b) => clipEnd(b) - clipEnd(a))[0]; s = Math.max(s, pv ? clipEnd(pv) : 0); }
    s = Math.max(0, s);
    const d = s - c.start;   // > 0: the front gets shorter
    if (c.type === "media" && c.freeze == null) { if (!c.reverse) c.in = r6(Math.max(0, c.in + d * c.speed)); }
    shiftKfs(c, -d); c.dur = r6(end0 - s);
    if (ripple) { for (const x of others) if (x.start >= end0 - EPS) x.start = r6(x.start - d); }
    else c.start = r6(s);
  }
  sortTrack(f.track); return true;
}

// ---- splitting
export function split(p: Project, id: Id, t: number): Clip | null {
  const f = findClip(p, id); if (!f || f.track.locked) return null;
  const c = f.clip; if (t <= c.start + 0.05 || t >= clipEnd(c) - 0.05) return null;
  const left = t - c.start, right = clipEnd(c) - t;
  const b: Clip = JSON.parse(JSON.stringify(c)); b.id = uid("c"); b.start = r6(t); b.dur = r6(right);
  if (c.type === "media" && b.type === "media" && c.freeze == null) {
    if (c.reverse) { c.in = r6(c.in + right * c.speed); } else b.in = r6(c.in + left * c.speed);
    b.fadeIn = 0; c.fadeOut = 0;
  }
  c.keyframes = cutKfs(c.keyframes, 0, left, 0); b.keyframes = cutKfs(b.keyframes, left, left + right, left);
  c.dur = r6(left);
  for (const tr of p.transitions) if (tr.a === c.id) tr.a = b.id;
  f.track.clips.splice(f.index + 1, 0, b); return b;
}
export function splitAt(p: Project, t: number, only?: Set<Id>): Clip[] {
  const out: Clip[] = [];
  for (const tr of p.tracks) { if (tr.locked) continue; for (const c of [...tr.clips]) if ((!only || !only.size || only.has(c.id)) && t > c.start && t < clipEnd(c)) { const b = split(p, c.id, t); if (b) out.push(b); } }
  return out;
}

// ---- deleting (ripple closes the gap on each track)
export function deleteClips(p: Project, ids: Id[], ripple = false): number {
  let n = 0; const set = new Set(ids);
  for (const tr of p.tracks) {
    if (tr.locked) continue;
    const gone = tr.clips.filter((c) => set.has(c.id)).sort((a, b) => b.start - a.start);
    for (const g of gone) { tr.clips.splice(tr.clips.indexOf(g), 1); n++; if (ripple) for (const c of tr.clips) if (c.start >= clipEnd(g) - EPS) c.start = r6(c.start - g.dur); }
  }
  p.transitions = p.transitions.filter((x) => !set.has(x.a) && !set.has(x.b));
  return n;
}
export function closeGap(p: Project, trackId: Id, t: number): boolean {
  const tr = trackOf(p, trackId); if (!tr || tr.locked) return false; sortTrack(tr);
  let a = 0, b = Infinity;
  for (const c of tr.clips) { if (clipEnd(c) <= t + EPS) a = Math.max(a, clipEnd(c)); if (c.start >= t - EPS) b = Math.min(b, c.start); if (t > c.start && t < clipEnd(c)) return false; }
  if (b === Infinity || b - a < EPS) return false;
  const d = b - a; for (const c of tr.clips) if (c.start >= b - EPS) c.start = r6(c.start - d); return true;
}

// ---- slip (the content moves, the clip stays), roll (a cut moves), slide (a clip moves between its neighbours)
export function slip(p: Project, id: Id, dSrc: number): boolean {
  const f = findClip(p, id); if (!f || f.track.locked || f.clip.type !== "media" || f.clip.freeze != null) return false;
  const c = f.clip, lim = srcLimit(p, c); const max = lim === Infinity ? Infinity : lim - c.dur * c.speed;
  c.in = r6(Math.max(0, Math.min(max, c.in + dSrc))); return true;
}
export function neighbours(p: Project, id: Id): { prev: Clip | null; next: Clip | null; track: Track } | null {
  const f = findClip(p, id); if (!f) return null; sortTrack(f.track); const i = f.track.clips.indexOf(f.clip);
  const prev = i > 0 && Math.abs(clipEnd(f.track.clips[i - 1]) - f.clip.start) < 0.011 ? f.track.clips[i - 1] : null;
  const nx = f.track.clips[i + 1]; const next = nx && Math.abs(nx.start - clipEnd(f.clip)) < 0.011 ? nx : null;
  return { prev, next, track: f.track };
}
export function roll(p: Project, aId: Id, t: number): boolean {
  const n = neighbours(p, aId); if (!n || !n.next || n.track.locked) return false;
  const a = findClip(p, aId)!.clip, b = n.next, cut = clipEnd(a);
  let lo = a.start + MIN_DUR, hi = clipEnd(b) - MIN_DUR;
  const la = srcLimit(p, a); if (a.type === "media" && la !== Infinity && !a.reverse) hi = Math.min(hi, a.start + (la - a.in) / a.speed);
  if (b.type === "media" && b.freeze == null && srcLimit(p, b) !== Infinity && !b.reverse) lo = Math.max(lo, cut - b.in / b.speed);
  const x = Math.max(lo, Math.min(hi, t)), d = x - cut; if (Math.abs(d) < EPS) return true;
  a.dur = r6(a.dur + d);
  if (b.type === "media" && b.freeze == null && !b.reverse) b.in = r6(Math.max(0, b.in + d * b.speed));
  shiftKfs(b, -d); b.start = r6(x); b.dur = r6(b.dur - d); return true;
}
export function slide(p: Project, id: Id, dt: number): boolean {
  const n = neighbours(p, id); if (!n || n.track.locked) return false;
  const c = findClip(p, id)!.clip;
  let d = dt;
  if (n.prev) { d = Math.max(d, -(n.prev.dur - MIN_DUR)); const lp = srcLimit(p, n.prev); if (n.prev.type === "media" && lp !== Infinity && !n.prev.reverse) d = Math.min(d, (lp - n.prev.in) / n.prev.speed - n.prev.dur); }
  else d = Math.max(d, -c.start);
  if (n.next) { d = Math.min(d, n.next.dur - MIN_DUR); const nx = n.next; if (nx.type === "media" && nx.freeze == null && srcLimit(p, nx) !== Infinity && !nx.reverse) d = Math.max(d, -nx.in / nx.speed); }
  if (Math.abs(d) < EPS) return false;
  if (n.prev) n.prev.dur = r6(n.prev.dur + d);
  if (n.next) { const nx = n.next; if (nx.type === "media" && nx.freeze == null && !nx.reverse) nx.in = r6(nx.in + d * nx.speed); shiftKfs(nx, -d); nx.start = r6(nx.start + d); nx.dur = r6(nx.dur - d); }
  c.start = r6(c.start + d); return true;
}

// ---- speed, reverse, freeze frame, detach the sound
export function setSpeed(p: Project, id: Id, speed: number): boolean {
  const f = findClip(p, id); if (!f || f.track.locked || f.clip.type !== "media") return false;
  const c = f.clip; const s = Math.max(0.1, Math.min(10, speed)); if (Math.abs(s - c.speed) < 1e-6) return true;
  const end0 = clipEnd(c), src = c.dur * c.speed, nd = Math.max(MIN_DUR, src / s), k = nd / c.dur;
  c.speed = s; scaleKfs(c, k, 0); c.dur = r6(nd);
  const d = clipEnd(c) - end0; for (const x of f.track.clips) if (x !== c && x.start >= end0 - EPS) x.start = r6(x.start + d);   // the clips after it follow
  return true;
}
export function freezeFrame(p: Project, id: Id, t: number, len = 2): Clip | null {
  const f = findClip(p, id); if (!f || f.track.locked || f.clip.type !== "media") return null;
  const c = f.clip; if (t < c.start || t > clipEnd(c)) return null;
  const src = sourceTime(c, t - c.start, srcLimit(p, c));
  const right = t > c.start + 0.05 && t < clipEnd(c) - 0.05 ? split(p, id, t) : null;
  const at = right ? t : (t >= clipEnd(c) - 0.05 ? clipEnd(c) : c.start);
  for (const x of f.track.clips) if (x.start >= at - EPS) x.start = r6(x.start + len);
  const fz: MediaClip = { ...JSON.parse(JSON.stringify(c)), id: uid("c"), start: r6(at), dur: len, freeze: r6(src), fadeIn: 0, fadeOut: 0, keyframes: {}, muted: true, name: (c.name || "") + " ❄" };
  f.track.clips.push(fz); sortTrack(f.track); return fz;
}
export function detachAudio(p: Project, id: Id): Clip | null {
  const f = findClip(p, id); if (!f || f.clip.type !== "media") return null;
  const c = f.clip, a = p.assets[c.asset]; if (!a || a.kind !== "video" || a.hasAudio === false || c.muted) return null;
  const s: MediaClip = { ...JSON.parse(JSON.stringify(c)), id: uid("c"), link: c.id, transform: { ...c.transform }, effects: [], keyframes: c.keyframes.volume ? { volume: c.keyframes.volume } : {}, name: (c.name || a.name) + " ♪" };
  let t = p.tracks.find((x) => x.kind === "audio" && !x.locked && !overlaps(x, s.start, clipEnd(s)));
  if (!t) { t = mkTrack("audio", "A" + (p.tracks.filter((x) => x.kind === "audio").length + 1)); p.tracks.push(t); }
  t.clips.push(s); sortTrack(t); c.muted = true; return s;
}
export function duplicate(p: Project, ids: Id[]): Clip[] {
  const out: Clip[] = [];
  for (const id of ids) { const f = findClip(p, id); if (!f) continue; const c: Clip = JSON.parse(JSON.stringify(f.clip)); c.id = uid("c"); c.start = clipEnd(f.clip); out.push(addClip(p, c, f.track.id)); }
  return out;
}

// ---- transitions (between two clips that touch on one track), markers, tracks
export function addTransition(p: Project, aId: Id, type: string, dur = 0.6): Transition | null {
  const n = neighbours(p, aId); if (!n || !n.next) return null;
  const a = findClip(p, aId)!.clip, b = n.next;
  const d = Math.max(0.1, Math.min(dur, a.dur * 0.9, b.dur * 0.9));
  p.transitions = p.transitions.filter((x) => !(x.a === aId && x.b === b.id));
  const tr: Transition = { id: uid("tr"), track: n.track.id, a: aId, b: b.id, type, dur: r6(d) }; p.transitions.push(tr); return tr;
}
export function dropTransitions(p: Project, id: Id) { p.transitions = p.transitions.filter((x) => x.a !== id && x.b !== id); }
export function validTransitions(p: Project) {
  p.transitions = p.transitions.filter((tr) => { const n = neighbours(p, tr.a); return !!n && !!n.next && n.next.id === tr.b; });
}
export function addMarker(p: Project, t: number, name = "", color = "#CFE13E") { const m = { id: uid("m"), t: r6(Math.max(0, t)), name, color }; p.markers.push(m); p.markers.sort((a, b) => a.t - b.t); return m; }
export function addTrack(p: Project, kind: TrackKind, at?: number): Track {
  const t = mkTrack(kind, (kind === "audio" ? "A" : kind === "text" ? "T" : "V") + (p.tracks.filter((x) => x.kind === kind).length + 1));
  if (at == null) { if (kind === "audio") p.tracks.push(t); else p.tracks.splice(p.tracks.findIndex((x) => x.kind !== "text") >= 0 ? p.tracks.findIndex((x) => x.kind !== "text") : 0, 0, t); }
  else p.tracks.splice(Math.max(0, Math.min(p.tracks.length, at)), 0, t);
  return t;
}
export function removeTrack(p: Project, id: Id): boolean {
  const i = p.tracks.findIndex((t) => t.id === id); if (i < 0) return false;
  const ids = p.tracks[i].clips.map((c) => c.id); p.tracks.splice(i, 1); p.transitions = p.transitions.filter((x) => !ids.includes(x.a) && !ids.includes(x.b)); return true;
}

// ---- snapping: clip edges, the playhead, markers, beats, zero
export function snapPoints(p: Project, opts: { skip?: Set<Id>; playhead?: number; beats?: boolean } = {}): number[] {
  const pts = [0];
  for (const t of p.tracks) for (const c of t.clips) if (!opts.skip?.has(c.id)) pts.push(c.start, clipEnd(c));
  if (opts.playhead != null) pts.push(opts.playhead);
  for (const m of p.markers) pts.push(m.t);
  if (opts.beats !== false) pts.push(...p.beats);
  return pts;
}
export function snap(t: number, pts: number[], within: number): { t: number; snapped: boolean; to?: number } {
  let best = t, bd = within, hit: number | undefined;
  for (const x of pts) { const d = Math.abs(x - t); if (d <= bd) { bd = d; best = x; hit = x; } }
  return { t: best, snapped: hit != null, to: hit };
}

// ---- what is drawn at a moment: the visible tracks, bottom to top, with transitions
export interface Layer { clip: Clip; track: Track; local: number; trans?: { type: string; k: number; role: "a" | "b" } }
export function layersAt(p: Project, t: number, kinds: TrackKind[] = ["video", "text"]): Layer[] {
  const out: Layer[] = [];
  for (let i = p.tracks.length - 1; i >= 0; i--) {
    const tr = p.tracks[i]; if (tr.hidden || !kinds.includes(tr.kind)) continue;
    for (const c of tr.clips) {
      const trs = p.transitions.filter((x) => x.track === tr.id && (x.a === c.id || x.b === c.id));
      let shown = t >= c.start && t < clipEnd(c), trans: Layer["trans"];
      for (const x of trs) {
        const b = tr.clips.find((y) => y.id === x.b); if (!b) continue;
        const cut = b.start, w0 = cut - x.dur / 2, w1 = cut + x.dur / 2;
        if (t >= w0 && t < w1) { shown = true; trans = { type: x.type, k: (t - w0) / x.dur, role: x.a === c.id ? "a" : "b" }; }
      }
      if (shown) out.push({ clip: c, track: tr, local: t - c.start, trans });
    }
  }
  // inside one track, the clip leaving is drawn under the one arriving
  return out;
}
export function soundsAt(p: Project, t: number): Layer[] {
  const solo = p.tracks.some((x) => x.solo);
  return layersAt(p, t, ["video", "audio"]).filter((l) => l.clip.type === "media" && !l.track.muted && (!solo || l.track.solo));
}

// ---- keyframe helpers used by trimming and splitting
function shiftKfs(c: Clip, d: number) {
  if (!d) return; const o: Keyframes = {};
  for (const [k, list] of Object.entries(c.keyframes) as [KfProp, Keyframe[]][]) { const l = list.map((x) => ({ ...x, t: r6(x.t + d) })).filter((x) => x.t >= -EPS); if (l.length) o[k] = l; }
  c.keyframes = o;
}
function scaleKfs(c: Clip, k: number, _o: number) {
  if (k === 1) return; for (const list of Object.values(c.keyframes)) for (const x of list || []) x.t = r6(x.t * k);
}
function cutKfs(kfs: Keyframes, a: number, b: number, shift: number): Keyframes {
  const o: Keyframes = {};
  for (const [k, list] of Object.entries(kfs) as [KfProp, Keyframe[]][]) {
    if (!list?.length) continue;
    const inside = list.filter((x) => x.t > a + EPS && x.t < b - EPS);
    const l: Keyframe[] = [{ t: a, v: valueAt(list, a, list[0].v), ease: list.find((x) => x.t <= a)?.ease || "linear" }, ...inside, { t: b, v: valueAt(list, b, list[0].v) }];
    o[k] = l.map((x) => ({ ...x, t: r6(x.t - shift) }));
  }
  return o;
}
