import { HUE_BANDS, SCHEMA_VERSION } from "./schema";
import type { Asset, ColorAdjust, MediaClip, Project, TextClip, TextStyle, Track, TrackKind, Transform } from "./schema";

let seq = 0;
export const uid = (p = "") => p + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7) + (seq++).toString(36);

export const transform0 = (): Transform => ({ x: 0, y: 0, scale: 1, rotation: 0, flipH: false, flipV: false, crop: [0, 0, 0, 0] });
export const color0 = (): ColorAdjust => ({
  exposure: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0, vibrance: 0,
  hsl: Object.fromEntries(HUE_BANDS.map((b) => [b, [0, 0, 0]])) as ColorAdjust["hsl"],
});
export const textStyle0 = (o: Partial<TextStyle> = {}): TextStyle => ({
  font: "Cairo", size: 0.08, weight: 700, italic: false, color: "#ffffff", align: "center", lineHeight: 1.2, letterSpacing: 0,
  stroke: null, shadow: { color: "rgba(0,0,0,0.55)", blur: 0.012, x: 0, y: 0.004 }, box: null, dir: "auto", ...o,
});

export function track(kind: TrackKind, name: string): Track {
  return { id: uid("t"), kind, name, locked: false, muted: false, hidden: false, solo: false, clips: [] };
}

export function mediaClip(asset: Asset, start: number, o: Partial<MediaClip> = {}): MediaClip {
  const still = asset.kind === "image";
  const dur = still ? 4 : Math.max(0.1, asset.duration || 4);
  return {
    id: uid("c"), type: "media", asset: asset.id, name: asset.name, start, dur, in: 0, speed: 1, reverse: false, freeze: null,
    transform: transform0(), opacity: 1, blend: "normal", volume: 1, muted: false, fadeIn: 0, fadeOut: 0,
    color: color0(), effects: [], lut: null, keyframes: {}, link: null, ...o,
  };
}

export function textClip(text: string, start: number, o: Partial<TextClip> = {}): TextClip {
  return {
    id: uid("x"), type: "text", text, start, dur: 3, name: text.slice(0, 24), transform: transform0(), opacity: 1, keyframes: {},
    style: textStyle0(), animIn: { type: "fade", dur: 0.4 }, animOut: { type: "fade", dur: 0.3 }, ...o,
  };
}

export function emptyProject(o: Partial<Project> = {}): Project {
  const now = Date.now();
  return {
    schema: SCHEMA_VERSION, id: uid("p"), name: "Untitled project", createdAt: now, updatedAt: now,
    width: 1920, height: 1080, fps: 30, background: "#000000",
    assets: {}, folders: [],
    tracks: [track("text", "T1"), track("video", "V2"), track("video", "V1"), track("audio", "A1"), track("audio", "A2")],
    transitions: [], markers: [], beats: [],
    ducking: { enabled: false, amount: 0.7, voiceTracks: [] },
    export: { preset: "youtube", format: "mp4", res: "1080p", fps: 30, quality: "high" },
    ...o,
  };
}
