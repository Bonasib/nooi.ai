// The .nooi project file (spec §8.6): the timeline in frames, V1 marked as the primary spine, clips with their source range,
// transform properties (a default plus keyframes), speed, color grading, audio, and the anchor (parentAnchorClipId +
// anchorOffsetFrames) that ties a clip to the main track. Times that do not fall on a frame keep their exact second in `sec`, and
// what the canonical shape has no field for is kept under `ext` — so a project → .nooi → project round trip loses nothing.
import { EASINGS } from "./easing";
import { migrate } from "./migrate";
import { anchorTime, spineOf } from "./anchors";
import type { Asset, Bezier, Clip, Easing, Keyframe, Keyframes, KfProp, MediaClip, Project, TextClip, Track } from "./schema";

export const NOOI_FORMAT = "1.0.0";
type J = Record<string, unknown>;
const iso = (ms: number) => new Date(ms || 0).toISOString();
const ms = (s: unknown, d: number) => { const n = Date.parse(String(s)); return isFinite(n) ? n : d; };
const omit = (o: object, keys: string[]): J => { const r: J = {}; for (const [k, v] of Object.entries(o)) if (!keys.includes(k) && v !== undefined) r[k] = v; return r; };
const ASPECT: [number, string][] = [[16 / 9, "16:9"], [9 / 16, "9:16"], [1, "1:1"], [4 / 5, "4:5"], [4 / 3, "4:3"], [21 / 9, "21:9"]];

// ---- time: whole frames, plus the exact second when it is not on a frame
function clock(fps: number) {
  const f = (t: number) => Math.round(t * fps);
  const exact = (t: number) => Math.abs(t * fps - Math.round(t * fps)) < 1e-6;
  return { f, exact, sec: (frame: unknown, s: unknown) => (typeof s === "number" ? s : Math.round((Number(frame) / fps) * 1e6) / 1e6) };
}
// ---- easing ↔ interp
function interpOf(e: Easing | undefined): J {
  if (!e || e === "linear") return { interp: "linear" };
  if (e === "hold") return { interp: "hold" };
  const b: Bezier = typeof e === "string" ? EASINGS[e] || EASINGS.linear : e.bezier;
  return { interp: "bezier", outTangent: [b[0], b[1]], inTangent: [b[2], b[3]] };
}
function easeOf(k: J): Easing {
  if (k.interp === "hold") return "hold";
  if (k.interp !== "bezier") return "linear";
  const o = (k.outTangent as number[]) || [0, 0], i = (k.inTangent as number[]) || [1, 1]; const b: Bezier = [o[0], o[1], i[0], i[1]];
  for (const [n, v] of Object.entries(EASINGS)) if (v.every((x, j) => Math.abs(x - b[j]) < 1e-9)) return n as Easing;
  return { bezier: b };
}

export function toNooi(p: Project, o: { authorDevice?: string } = {}): J {
  const C = clock(p.fps), sp = spineOf(p);
  const kf = (list: Keyframe[] | undefined, scale = 1) => (list || []).map((k) => ({ frame: C.f(k.t), value: k.v * scale, ...interpOf(k.ease), ...(C.exact(k.t) ? {} : { sec: k.t }) }));
  const prop = (v: number, list: Keyframe[] | undefined, scale = 1) => ({ default: v * scale, keyframes: kf(list, scale) });
  const times = (c: Clip) => { const s: J = {}; if (!C.exact(c.start)) s.start = c.start; if (!C.exact(c.start + c.dur)) s.end = c.start + c.dur; if (c.type === "media" && !C.exact(c.in)) s.in = c.in; return s; };
  const clip = (c: Clip, t: Track): J => {
    const par = c.anchor && sp ? sp.clips.find((x) => x.id === c.anchor!.clip) : null;
    const tr = c.transform, sec = times(c);
    const base: J = {
      clipId: c.id, kind: c.type, name: c.name ?? null,
      timelineStartFrame: C.f(c.start), timelineEndFrame: C.f(c.start + c.dur),
      ...(par && t !== sp ? { parentAnchorClipId: par.id, anchorOffsetFrames: C.f(anchorTime(par, c.anchor!.at) - par.start), anchorSource: c.anchor!.at } : {}),
      transform: {
        positionX: prop(tr.x, c.keyframes.x), positionY: prop(tr.y, c.keyframes.y), scaleX: prop(tr.scale, c.keyframes.scale, 100), scaleY: prop(tr.scale, c.keyframes.scale, 100),
        rotation: prop(tr.rotation, c.keyframes.rotation), opacity: prop(c.opacity, c.keyframes.opacity, 100),
        flip: { horizontal: tr.flipH, vertical: tr.flipV }, crop: { left: tr.crop[0], top: tr.crop[1], right: tr.crop[2], bottom: tr.crop[3] },
      },
      ...(Object.keys(sec).length ? { sec } : {}),
    };
    if (c.type === "text") return { ...base, text: { content: c.text, style: c.style, animIn: c.animIn, animOut: c.animOut, template: c.template ?? null }, ext: omit(c, ["id", "type", "name", "start", "dur", "keyframes", "transform", "opacity", "anchor", "text", "style", "animIn", "animOut", "template"]) };
    const m = c as MediaClip;
    return {
      ...base, assetId: m.asset,
      sourceInFrame: C.f(m.in), sourceOutFrame: C.f(m.in + m.dur * m.speed),
      speed: { mode: m.freeze != null ? "freeze" : "uniform", multiplier: m.speed, reverse: m.reverse, freezeSourceSec: m.freeze ?? null, maintainAudioPitch: true, rampNodes: [] },
      colorGrading: { lutAssetId: m.lut?.asset ?? null, lutIntensity: m.lut?.amount ?? 0, ...omit(m.color, ["hsl"]), hsl: m.color.hsl, colorMasks: [] },
      effects: m.effects, blend: m.blend,
      audio: { gain: m.volume, gainDb: m.volume > 0 ? Math.round(20 * Math.log10(m.volume) * 1000) / 1000 : -96, gainKeyframes: kf(m.keyframes.volume), muted: m.muted,
        fadeInFrames: C.f(m.fadeIn), fadeOutFrames: C.f(m.fadeOut), fadeSec: [m.fadeIn, m.fadeOut], aiDenoiseLevel: m.denoise ? "medium" : "off", linkedClipId: m.link ?? null },
      ext: omit(m, ["id", "type", "name", "start", "dur", "keyframes", "transform", "opacity", "anchor", "asset", "in", "speed", "reverse", "freeze", "blend", "volume", "muted", "fadeIn", "fadeOut", "color", "effects", "lut", "denoise", "link"]),
    };
  };
  const kinds: Record<string, number> = {};
  const tracks = [...p.tracks].reverse().map((t) => { kinds[t.kind] = (kinds[t.kind] || 0) + 1; return { t, index: kinds[t.kind] }; }).reverse();
  const asp = p.width / p.height; const aspectRatio = (ASPECT.find(([r]) => Math.abs(r - asp) < 0.01) || [0, p.width + ":" + p.height])[1];
  return {
    $schema: "https://schema.nooi.studio/v1/project.schema.json", nooiVersion: NOOI_FORMAT, projectId: p.id,
    metadata: { title: p.name, createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt), authorDevice: o.authorDevice || "nooi Studio (web)", schema: p.schema },
    settings: { canvasWidth: p.width, canvasHeight: p.height, aspectRatio, frameRate: { num: p.fps, den: 1 }, colorSpace: "Rec.709", audioSampleRate: 48000, audioChannels: 2,
      magneticRippleEnabled: p.magnetic !== false, background: p.background },
    mediaBin: Object.values(p.assets).map((a) => ({ assetId: a.id, name: a.name, type: a.kind, sourceUri: a.src, proxyUri: a.proxy ?? null, durationFrames: a.duration != null ? C.f(a.duration) : null,
      durationSec: a.duration ?? null, width: a.w ?? null, height: a.h ?? null, ext: omit(a, ["id", "name", "kind", "src", "proxy", "duration", "w", "h"]) })),
    timeline: {
      playheadFrame: 0, inPointFrame: 0, outPointFrame: C.f(p.tracks.reduce((m, t) => Math.max(m, ...t.clips.map((c) => c.start + c.dur)), 0)),
      markers: p.markers.map((m) => ({ id: m.id, frame: C.f(m.t), sec: m.t, label: m.name, color: m.color, chapterExport: false })),
      beatsSec: p.beats,
      tracks: tracks.map(({ t, index }) => ({ trackId: t.id, type: t.kind, name: t.name, index, isPrimarySpine: t === sp, muted: t.muted, locked: t.locked, solo: t.solo, hidden: t.hidden, clips: t.clips.map((c) => clip(c, t)) })),
      transitions: p.transitions.map((x) => ({ id: x.id, trackId: x.track, fromClipId: x.a, toClipId: x.b, type: x.type, durationFrames: C.f(x.dur), durationSec: x.dur })),
    },
    ext: { folders: p.folders, ducking: p.ducking, export: p.export },
  };
}

export const isNooi = (j: unknown): boolean => !!j && typeof j === "object" && "timeline" in (j as J) && "settings" in (j as J);

export function fromNooi(doc: J): Project {
  const st = (doc.settings || {}) as J, md = (doc.metadata || {}) as J, tl = (doc.timeline || {}) as J, ext = (doc.ext || {}) as J;
  const fr = (st.frameRate as J) || {}; const fps = Number(fr.num || 30) / Number(fr.den || 1); const C = clock(fps);
  const kfs = (list: unknown, scale = 1): Keyframe[] => (Array.isArray(list) ? list : []).map((k: J) => ({ t: C.sec(k.frame, k.sec), v: Number(k.value) / scale, ease: easeOf(k) }));
  const val = (x: unknown, d: number, scale = 1) => (x && typeof x === "object" && typeof (x as J).default === "number" ? ((x as J).default as number) / scale : d);
  const clip = (c: J): Clip => {
    const sec = (c.sec || {}) as J, T = (c.transform || {}) as J; const start = C.sec(c.timelineStartFrame, sec.start), endT = C.sec(c.timelineEndFrame, sec.end);
    const keyframes: Keyframes = {}; const put = (k: KfProp, l: Keyframe[]) => { if (l.length) keyframes[k] = l; };
    put("x", kfs((T.positionX as J)?.keyframes)); put("y", kfs((T.positionY as J)?.keyframes)); put("scale", kfs((T.scaleX as J)?.keyframes, 100));
    put("rotation", kfs((T.rotation as J)?.keyframes)); put("opacity", kfs((T.opacity as J)?.keyframes, 100));
    const crop = (T.crop || {}) as J, flip = (T.flip || {}) as J;
    const base = {
      id: String(c.clipId), name: c.name == null ? undefined : String(c.name), start, dur: Math.round((endT - start) * 1e6) / 1e6, keyframes,
      transform: { x: val(T.positionX, 0), y: val(T.positionY, 0), scale: val(T.scaleX, 1, 100), rotation: val(T.rotation, 0), flipH: !!flip.horizontal, flipV: !!flip.vertical,
        crop: [Number(crop.left || 0), Number(crop.top || 0), Number(crop.right || 0), Number(crop.bottom || 0)] as [number, number, number, number] },
      opacity: val(T.opacity, 1, 100),
      ...(c.parentAnchorClipId ? { anchor: { clip: String(c.parentAnchorClipId), at: typeof c.anchorSource === "number" ? c.anchorSource : NaN, off: C.sec(c.anchorOffsetFrames, undefined) } } : {}),
    };
    if (c.kind === "text") { const x = (c.text || {}) as J; return { ...((c.ext as J) || {}), ...base, type: "text", text: String(x.content ?? ""), style: x.style, animIn: x.animIn, animOut: x.animOut, ...(x.template ? { template: x.template } : {}) } as unknown as TextClip; }
    const sp = (c.speed || {}) as J, cg = (c.colorGrading || {}) as J, au = (c.audio || {}) as J; const fade = (au.fadeSec as number[]) || [C.sec(au.fadeInFrames, undefined), C.sec(au.fadeOutFrames, undefined)];
    const m = { ...((c.ext as J) || {}), ...base, type: "media", asset: String(c.assetId), in: C.sec(c.sourceInFrame, sec.in), speed: Number(sp.multiplier || 1), reverse: !!sp.reverse,
      freeze: sp.mode === "freeze" ? Number(sp.freezeSourceSec) : null, blend: c.blend || "normal",
      volume: typeof au.gain === "number" ? au.gain : typeof au.gainDb === "number" ? (au.gainDb <= -96 ? 0 : Math.pow(10, au.gainDb / 20)) : 1,
      muted: !!au.muted, fadeIn: fade[0] || 0, fadeOut: fade[1] || 0, color: { ...omit(cg, ["lutAssetId", "lutIntensity", "colorMasks", "hsl"]), hsl: cg.hsl },
      effects: Array.isArray(c.effects) ? c.effects : [], lut: cg.lutAssetId ? { asset: String(cg.lutAssetId), amount: Number(cg.lutIntensity ?? 1) } : null,
      ...(au.aiDenoiseLevel && au.aiDenoiseLevel !== "off" ? { denoise: true } : {}), link: au.linkedClipId ?? null } as unknown as MediaClip;
    const vk = kfs(au.gainKeyframes); if (vk.length) m.keyframes.volume = vk;
    return m;
  };
  const tracks = (Array.isArray(tl.tracks) ? tl.tracks : []).map((t: J) => ({ id: String(t.trackId), kind: t.type, name: String(t.name || ""), locked: !!t.locked, muted: !!t.muted, hidden: !!t.hidden, solo: !!t.solo,
    clips: (Array.isArray(t.clips) ? t.clips : []).map(clip) })) as Track[];
  // an anchor written by another app gives only the offset in frames: turn it into the point on its clip
  const all = new Map(tracks.flatMap((t) => t.clips.map((c) => [c.id, c] as const)));
  for (const t of tracks) for (const c of t.clips) { const a = c.anchor as unknown as { clip: string; at: number; off?: number } | undefined; if (!a) continue; const par = all.get(a.clip);
    if (!par) { delete c.anchor; continue; } if (!isFinite(a.at)) { const t0 = par.start + (a.off ?? c.start - par.start); a.at = par.type === "media" && par.freeze == null && !par.reverse ? par.in + (t0 - par.start) * par.speed : t0 - par.start; } c.anchor = { clip: a.clip, at: a.at }; }
  const assets: Record<string, Asset> = {};
  for (const a of (Array.isArray(doc.mediaBin) ? doc.mediaBin : []) as J[]) {
    const x = { ...((a.ext as J) || {}), id: String(a.assetId), name: String(a.name || a.assetId), kind: a.type, src: String(a.sourceUri || ""),
      ...(a.proxyUri ? { proxy: a.proxyUri } : {}), ...(a.durationSec != null ? { duration: a.durationSec } : a.durationFrames != null ? { duration: C.sec(a.durationFrames, undefined) } : {}),
      ...(a.width != null ? { w: a.width } : {}), ...(a.height != null ? { h: a.height } : {}) } as unknown as Asset;
    if (typeof x.createdAt !== "number") x.createdAt = 0; assets[x.id] = x;
  }
  return migrate({
    schema: typeof md.schema === "number" ? md.schema : 1, id: String(doc.projectId || "p" + Date.now().toString(36)), name: String(md.title || "Untitled project"), createdAt: ms(md.createdAt, Date.now()), updatedAt: ms(md.updatedAt, Date.now()),
    width: Number(st.canvasWidth || 1920), height: Number(st.canvasHeight || 1080), fps, background: String(st.background || "#000000"), magnetic: st.magneticRippleEnabled !== false,
    assets, folders: ext.folders || [], tracks,
    transitions: (Array.isArray(tl.transitions) ? tl.transitions : []).map((x: J) => ({ id: String(x.id), track: String(x.trackId), a: String(x.fromClipId), b: String(x.toClipId), type: String(x.type || "fade"), dur: C.sec(x.durationFrames, x.durationSec) })),
    markers: (Array.isArray(tl.markers) ? tl.markers : []).map((m: J) => ({ id: String(m.id), t: C.sec(m.frame, m.sec), name: String(m.label || ""), color: String(m.color || "#00F0FF") })),
    beats: Array.isArray(tl.beatsSec) ? tl.beatsSec : [], ducking: ext.ducking, export: ext.export,
  });
}
