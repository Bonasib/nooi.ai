// Named commands — the toolbar, the keyboard and (Phase 2) the AI prompt edit all call the timeline through these,
// so "remove the first 3 seconds and zoom on the face" becomes a list of { cmd, args } the user can undo in one step.
import { setKeyframe, removeKeyframe } from "./easing";
import * as T from "./timeline";
import type { Easing, Id, KfProp, Project } from "./schema";
import { textClip, uid } from "./defaults";

type A = Record<string, unknown>;
const n = (v: unknown, d = 0) => (typeof v === "number" && isFinite(v) ? v : d);
const s = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const ids = (v: unknown): Id[] => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : typeof v === "string" ? [v] : []);

export const COMMANDS: Record<string, { en: string; ar: string; run: (p: Project, a: A) => unknown }> = {
  split: { en: "Split", ar: "قص", run: (p, a) => T.splitAt(p, n(a.t), new Set(ids(a.ids))) },
  delete: { en: "Delete", ar: "حذف", run: (p, a) => T.deleteClips(p, ids(a.ids), false) },
  rippleDelete: { en: "Ripple delete", ar: "حذف مع سد الفراغ", run: (p, a) => T.deleteClips(p, ids(a.ids), true) },
  closeGap: { en: "Close gap", ar: "سد الفراغ", run: (p, a) => T.closeGap(p, s(a.track), n(a.t)) },
  move: { en: "Move", ar: "نقل", run: (p, a) => T.moveClip(p, s(a.id), n(a.start), (a.track as string) || null) },
  trim: { en: "Trim", ar: "تشذيب", run: (p, a) => T.trim(p, s(a.id), a.edge === "start" ? "start" : "end", n(a.t), !!a.ripple) },
  slip: { en: "Slip", ar: "إزاحة المحتوى", run: (p, a) => T.slip(p, s(a.id), n(a.d)) },
  roll: { en: "Roll", ar: "تحريك القطع", run: (p, a) => T.roll(p, s(a.id), n(a.t)) },
  slide: { en: "Slide", ar: "انزلاق المقطع", run: (p, a) => T.slide(p, s(a.id), n(a.d)) },
  speed: { en: "Speed", ar: "السرعة", run: (p, a) => T.setSpeed(p, s(a.id), n(a.speed, 1)) },
  reverse: { en: "Reverse", ar: "عكس", run: (p, a) => { const f = T.findClip(p, s(a.id)); if (f?.clip.type === "media") f.clip.reverse = !f.clip.reverse; return !!f; } },
  freeze: { en: "Freeze frame", ar: "تجميد الإطار", run: (p, a) => T.freezeFrame(p, s(a.id), n(a.t), n(a.len, 2)) },
  detachAudio: { en: "Detach audio", ar: "فصل الصوت", run: (p, a) => T.detachAudio(p, s(a.id)) },
  duplicate: { en: "Duplicate", ar: "تكرار", run: (p, a) => T.duplicate(p, ids(a.ids)) },
  set: { en: "Change", ar: "تعديل", run: (p, a) => setPath(p, s(a.id), s(a.path), a.value) },
  keyframe: { en: "Keyframe", ar: "إطار مفتاحي", run: (p, a) => { const f = T.findClip(p, s(a.id)); if (!f) return false; f.clip.keyframes = setKeyframe(f.clip.keyframes, a.prop as KfProp, n(a.t), n(a.v), a.ease as Easing); return true; } },
  unkeyframe: { en: "Remove keyframe", ar: "حذف إطار مفتاحي", run: (p, a) => { const f = T.findClip(p, s(a.id)); if (!f) return false; f.clip.keyframes = removeKeyframe(f.clip.keyframes, a.prop as KfProp, n(a.t)); return true; } },
  transition: { en: "Transition", ar: "انتقال", run: (p, a) => T.addTransition(p, s(a.id), s(a.type, "fade"), n(a.dur, 0.6)) },
  marker: { en: "Marker", ar: "علامة", run: (p, a) => T.addMarker(p, n(a.t), s(a.name)) },
  addText: { en: "Add text", ar: "أضف نصاً", run: (p, a) => T.addClip(p, textClip(s(a.text, "Text"), n(a.t), { dur: n(a.dur, 3) }), (a.track as string) || null) },
  addTrack: { en: "Add track", ar: "أضف مساراً", run: (p, a) => T.addTrack(p, (a.kind as "video" | "audio" | "text") || "video") },
  track: { en: "Track", ar: "مسار", run: (p, a) => { const t = T.trackOf(p, s(a.id)); if (!t) return false; for (const k of ["locked", "muted", "hidden", "solo", "name"] as const) if (k in a) (t as unknown as A)[k] = a[k]; return true; } },
  zoomOn: { en: "Zoom in on", ar: "تقريب على", run: (p, a) => { const f = T.findClip(p, s(a.id)); if (!f) return false; const c = f.clip; c.keyframes = setKeyframe(setKeyframe(c.keyframes, "scale", 0, 1), "scale", Math.min(c.dur, n(a.over, 1.5)), n(a.scale, 1.4)); if ("x" in a) c.transform.x = -n(a.x); if ("y" in a) c.transform.y = -n(a.y); return true; } },
  cutRange: { en: "Remove a part", ar: "احذف جزءاً", run: (p, a) => cutRange(p, n(a.from), n(a.to)) },
};
// remove [from, to) from every unlocked track and close the gap (e.g. "remove the first 3 seconds")
export function cutRange(p: Project, from: number, to: number): boolean {
  if (to <= from) return false;
  T.splitAt(p, from); T.splitAt(p, to);
  for (const t of p.tracks) {
    if (t.locked) continue;
    t.clips = t.clips.filter((c) => !(c.start >= from - T.EPS && T.clipEnd(c) <= to + T.EPS));
    for (const c of t.clips) if (c.start >= to - T.EPS) c.start = Math.round((c.start - (to - from)) * 1e6) / 1e6;
  }
  for (const m of p.markers) if (m.t >= to) m.t -= to - from;
  T.validTransitions(p); return true;
}
// set a value by a dotted path on a clip ("opacity", "transform.scale", "color.exposure", "style.font"…) — plain data only
export function setPath(p: Project, id: Id, path: string, value: unknown): boolean {
  const f = T.findClip(p, id); if (!f || f.track.locked || !path || /__proto__|constructor|prototype/.test(path)) return false;
  const keys = path.split("."); let o: Record<string, unknown> = f.clip as unknown as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) { const v = o[keys[i]]; if (v == null || typeof v !== "object") o[keys[i]] = {}; o = o[keys[i]] as Record<string, unknown>; }
  o[keys[keys.length - 1]] = value; return true;
}
export interface Step { cmd: string; args: A }
// run several commands as one undo step (the store calls this inside run())
export function runSteps(p: Project, steps: Step[]): { ok: number; failed: string[] } {
  let ok = 0; const failed: string[] = [];
  for (const st of steps) { const c = COMMANDS[st.cmd]; if (!c) { failed.push(st.cmd); continue; } try { const r = c.run(p, st.args || {}); if (r === false || r == null) failed.push(st.cmd); else ok++; } catch { failed.push(st.cmd); } }
  return { ok, failed };
}
export const newId = uid;
