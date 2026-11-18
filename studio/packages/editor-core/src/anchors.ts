// The magnetic main track (spec §8.5). V1, the lowest video track, is the story's spine. A clip on any other track is attached
// (anchored) to the V1 clip under its start — to that clip's picture, not to a time — so when V1 is trimmed, rippled, split or
// moved, what is attached to it moves with it and stays in sync. Moving the attached clip yourself attaches it again where you
// drop it. Deleting its V1 clip keeps it (attached to whatever is under it then — a music bed is never deleted by surprise).
// `follow(before, after)` runs after every change (the store calls it), so undo, redo and live drags all stay consistent.
import { track as mkTrack } from "./defaults";
import type { Clip, Id, Project, Track } from "./schema";

const EPS = 1e-4;
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
const end = (c: Clip) => c.start + c.dur;

/** the main track: the lowest video track */
export function spineOf(p: Project): Track | null { for (let i = p.tracks.length - 1; i >= 0; i--) if (p.tracks[i].kind === "video") return p.tracks[i]; return null; }
// a point on a main-track clip: its source second (so trims keep it on the same picture), or its local second (titles, stills
// with no source to follow, frozen or reversed clips)
const linear = (c: Clip) => c.type === "media" && c.freeze == null && !c.reverse;
export const anchorAt = (par: Clip, t: number) => r6(linear(par) && par.type === "media" ? par.in + (t - par.start) * par.speed : t - par.start);
export const anchorTime = (par: Clip, at: number) => r6(par.start + (linear(par) && par.type === "media" ? (at - par.in) / par.speed : at));
const hostAt = (spine: Track, t: number) => spine.clips.find((c) => t >= c.start - EPS && t < end(c) - EPS) || null;
const clash = (t: Track, c: Clip) => t.clips.some((x) => x !== c && c.start < end(x) - EPS && end(c) > x.start + EPS);

/** attach every clip that is not on V1 to the V1 clip under it (used when the magnetic track is switched on) */
export function anchorAll(p: Project) {
  const sp = spineOf(p); if (!sp) return;
  for (const t of p.tracks) for (const c of t.clips) { if (t === sp) { delete c.anchor; continue; } const h = hostAt(sp, c.start); if (h) c.anchor = { clip: h.id, at: anchorAt(h, c.start) }; else delete c.anchor; }
}

/** after a change: attached clips follow their V1 clip; moved or new clips attach where they are */
export function follow(before: Project | null, p: Project) {
  if (p.magnetic === false) return;
  const sp = spineOf(p); if (!sp) return;
  const spine = new Map(sp.clips.map((c) => [c.id, c]));
  const was = new Map<Id, number>(); if (before) for (const t of before.tracks) for (const c of t.clips) was.set(c.id, c.start);
  const moved: [Clip, Track][] = [];
  for (const t of p.tracks) {
    if (t === sp) { for (const c of t.clips) if (c.anchor) delete c.anchor; continue; }
    for (const c of t.clips) {
      const w = was.get(c.id); const self = w == null || Math.abs(w - c.start) > EPS;   // new, or moved by the person (or its own track rippled)
      const par = c.anchor ? spine.get(c.anchor.clip) : undefined;
      if (!self && par && c.anchor && !t.locked) {
        const want = Math.max(0, anchorTime(par, c.anchor.at));
        if (Math.abs(want - c.start) > EPS) { c.start = r6(want); moved.push([c, t]); }
        // still on its clip: keep the anchor as it is (no drift); else it attaches to what is under it now
        if (c.start >= par.start - EPS && c.start < end(par) - EPS) continue;
      } else if (!self && par && c.anchor) continue;
      const h = hostAt(sp, c.start);
      if (h) c.anchor = { clip: h.id, at: anchorAt(h, c.start) }; else delete c.anchor;
    }
  }
  // a clip that followed onto another one on its track moves to a free track of the same kind (or a new one beside it)
  for (const [c, t] of moved) {
    if (!clash(t, c)) continue;
    const free = p.tracks.find((x) => x !== t && x !== sp && x.kind === t.kind && !x.locked && !clash(x, c));
    let to = free;
    if (!to) { to = mkTrack(t.kind, (t.kind === "audio" ? "A" : t.kind === "text" ? "T" : "V") + (p.tracks.filter((x) => x.kind === t.kind).length + 1)); p.tracks.splice(p.tracks.indexOf(t) + (t.kind === "audio" ? 1 : 0), 0, to); }
    t.clips.splice(t.clips.indexOf(c), 1); to.clips.push(c); to.clips.sort((a, b) => a.start - b.start);
    p.transitions = p.transitions.filter((x) => x.a !== c.id && x.b !== c.id);
  }
  for (const t of p.tracks) t.clips.sort((a, b) => a.start - b.start);
}
