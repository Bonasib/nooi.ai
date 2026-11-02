// Read any saved project (older versions, missing fields) into the current shape — never throws on a damaged file.
import { color0, emptyProject, textStyle0, transform0 } from "./defaults";
import { SCHEMA_VERSION } from "./schema";
import type { Clip, Project, Track } from "./schema";

const num = (v: unknown, d: number, lo = -Infinity, hi = Infinity) => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);

export function migrate(raw: unknown): Project {
  const base = emptyProject();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<Project> & Record<string, unknown>;
  if (typeof r.schema === "number" && r.schema > SCHEMA_VERSION) throw new Error("This project was made by a newer version of the editor.");
  const p: Project = {
    ...base, ...r, schema: SCHEMA_VERSION,
    width: num(r.width, 1920, 16, 8192), height: num(r.height, 1080, 16, 8192), fps: num(r.fps, 30, 1, 120),
    assets: r.assets && typeof r.assets === "object" ? r.assets : {}, folders: Array.isArray(r.folders) ? r.folders : [],
    transitions: Array.isArray(r.transitions) ? r.transitions : [], markers: Array.isArray(r.markers) ? r.markers : [], beats: Array.isArray(r.beats) ? r.beats.filter((x) => typeof x === "number") : [],
    ducking: { ...base.ducking, ...(r.ducking || {}) }, export: { ...base.export, ...(r.export || {}) },
    tracks: Array.isArray(r.tracks) ? (r.tracks as Track[]).map(fixTrack) : base.tracks,
  };
  if (!p.tracks.length) p.tracks = base.tracks;
  const ids = new Set(p.tracks.flatMap((t) => t.clips.map((c) => c.id)));
  p.transitions = p.transitions.filter((x) => ids.has(x.a) && ids.has(x.b));
  return p;
}
function fixTrack(t: Track): Track {
  return { id: String(t.id), kind: ["video", "audio", "text"].includes(t.kind) ? t.kind : "video", name: String(t.name || "Track"), locked: !!t.locked, muted: !!t.muted, hidden: !!t.hidden, solo: !!t.solo,
    clips: Array.isArray(t.clips) ? t.clips.map(fixClip).filter(Boolean as unknown as (c: Clip | null) => c is Clip) : [] };
}
function fixClip(c: Clip): Clip | null {
  if (!c || typeof c !== "object" || !c.id) return null;
  const common = { start: num(c.start, 0, 0), dur: num(c.dur, 1, 0.05), opacity: num(c.opacity, 1, 0, 1), keyframes: c.keyframes || {}, transform: { ...transform0(), ...(c.transform || {}) } };
  if (c.type === "text") return { ...c, ...common, text: String(c.text ?? ""), style: { ...textStyle0(), ...(c.style || {}) }, animIn: c.animIn || { type: "fade", dur: 0.4 }, animOut: c.animOut || { type: "fade", dur: 0.3 } };
  if (c.type !== "media" || !c.asset) return null;
  return { ...c, ...common, in: num(c.in, 0, 0), speed: num(c.speed, 1, 0.1, 10), reverse: !!c.reverse, blend: c.blend || "normal", volume: num(c.volume, 1, 0, 2), muted: !!c.muted,
    fadeIn: num(c.fadeIn, 0, 0), fadeOut: num(c.fadeOut, 0, 0), color: { ...color0(), ...(c.color || {}), hsl: { ...color0().hsl, ...((c.color && c.color.hsl) || {}) } }, effects: Array.isArray(c.effects) ? c.effects : [] };
}
