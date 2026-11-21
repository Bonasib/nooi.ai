// nooi Studio Editor — the project document. Times are seconds on the timeline unless named `src…` (seconds in the source file).
// Positions are fractions of the frame (0 = centre, ±0.5 = the edges), sizes are fractions of the frame height.
export const SCHEMA_VERSION = 1;

export type Id = string;
export type Bezier = [number, number, number, number];
export type Easing = "linear" | "easeIn" | "easeOut" | "easeInOut" | "hold" | { bezier: Bezier };
export interface Keyframe { t: number; v: number; ease?: Easing }   // t: seconds from the clip's start
export const KF_PROPS = ["x", "y", "scale", "rotation", "opacity", "volume"] as const;
export type KfProp = (typeof KF_PROPS)[number];
export type Keyframes = Partial<Record<KfProp, Keyframe[]>>;

export interface Transform {
  x: number; y: number; scale: number; rotation: number;   // rotation in degrees
  flipH: boolean; flipV: boolean;
  crop: [number, number, number, number];                  // left, top, right, bottom — fractions of the source
}
export const HUE_BANDS = ["red", "orange", "yellow", "green", "aqua", "blue", "purple", "magenta"] as const;
export type HueBand = (typeof HUE_BANDS)[number];
export interface ColorAdjust {
  exposure: number; contrast: number; saturation: number; temperature: number; tint: number;   // -1..1 (0 = untouched)
  highlights: number; shadows: number; vibrance: number;
  hsl: Record<HueBand, [number, number, number]>;            // hue shift, saturation, lightness per band (-1..1)
  // (v278) curves: the output level at 0, ¼, ½, ¾, 1 of the input (master then red, green, blue); colour wheels: lift, gamma, gain (r, g, b, -1..1)
  curves?: Curves | null;
  wheels?: Wheels | null;
}
export interface Curves { l: number[]; r: number[]; g: number[]; b: number[] }
export interface Wheels { lift: [number, number, number]; gamma: [number, number, number]; gain: [number, number, number] }
/** (v278) a clip's sound: three-band EQ (dB), a voice, a compressor that evens the level */
export interface AudioFx { eq: [number, number, number]; voice: string; comp: boolean }
export const BLEND_MODES = ["normal", "multiply", "screen", "overlay", "darken", "lighten", "add", "difference", "softLight", "hardLight", "colorDodge", "colorBurn"] as const;
export type BlendMode = (typeof BLEND_MODES)[number];
export interface Effect { id: Id; type: string; enabled: boolean; params: Record<string, number | string | boolean> }

export type AssetKind = "video" | "image" | "audio" | "lut" | "font";
export interface Asset {
  id: Id; kind: AssetKind; name: string;
  src: string;                 // a URL, or "local:<key>" for a file kept on this device
  proxy?: string;              // a small copy for smooth preview (4K sources)
  w?: number; h?: number; duration?: number; fps?: number; hasAudio?: boolean; size?: number; mime?: string;
  folder?: Id | null; waveform?: number[]; thumb?: string; createdAt: number;
  strip?: string;              // a filmstrip picture (several frames side by side) for the timeline
  job?: string;                // the nooi.ai job that made it
  alpha?: "stacked" | "own";   // (v234) a cut-out: a video with the picture on the top half and its mask (grey) below; "own": a picture with its own transparency
}
export interface Folder { id: Id; name: string; parent?: Id | null }

// anchor: a clip on another track attached to a frame of a main-track (V1) clip — `at` is that clip's source second (its local
// second for a title), so it stays on the same picture when V1 is trimmed, rippled or moved (spec §8.5 parentAnchorClipId)
export interface Anchor { clip: Id; at: number }
export interface ClipBase { id: Id; start: number; dur: number; name?: string; keyframes: Keyframes; transform: Transform; opacity: number; anchor?: Anchor | null;
  backdrop?: Id | null   // (v277) pro tools — motion blur (a share of one frame's time the shutter stays open, 0 = off) and following a tracked clip
  mblur?: number;
  follow?: { clip: Id } | null;
}        // (v234) a background placed under that clip (a picked new background replaces it)
export interface MediaClip extends ClipBase {
  type: "media"; asset: Id;
  in: number;                  // source seconds at the clip's first frame (before reverse)
  speed: number;               // 0.1 … 10
  reverse: boolean;
  freeze?: number | null;      // source second shown for the whole clip (a frozen frame)
  blend: BlendMode;
  volume: number;              // 0 … 2
  muted: boolean;
  fadeIn: number; fadeOut: number;
  color: ColorAdjust;
  effects: Effect[];
  lut?: { asset: Id; amount: number } | null;
  denoise?: boolean;           // RNNoise on this clip's sound
  link?: Id | null;            // a detached sound remembers its video clip
  light?: [number, number, number] | null;   // (v234) the colour change made to match a new background (temperature, exposure, tint)
  // (v277) Filmora-16-class tools, all drawn by the WebGL compositor on the device
  matte?: TrackMatte | null;   // the clip on the track above (at the same moment) is this clip's matte and isn't drawn itself
  cmask?: ColorMask | null;    // a colour picked and changed alone
  pano?: Pano | null;          // a 360° (equirectangular) video seen through a normal camera
  track?: TrackPath | null;    // a part of the picture followed through the clip (others can follow it; "lock" keeps it still)
  // (v278) an adjustment layer (no picture of its own: its colour, LUT and effects change everything under it), the clip's sound,
  // the clips a nested clip was made from (un-nest puts them back), the asset it was steadied from
  adjust?: boolean;
  afx?: AudioFx | null;
  nested?: { tracks: { kind: TrackKind; clips: Clip[] }[]; start: number } | null;
  steadyOf?: Id | null;
}
export interface TrackMatte { mode: "alpha" | "luma"; invert: boolean }
export interface ColorMask { on: boolean; hue: number; range: number; soft: number; minSat: number; hueShift: number; sat: number; exposure: number; invert: boolean; show: boolean }
export interface Pano { on: boolean; yaw: number; pitch: number; roll: number; fov: number; move: boolean; yaw2: number; pitch2: number; fov2: number }   // degrees
// box: the picked part (source fractions, from the top-left: x, y, w, h); pts: [local second, centre u, centre v] (source fractions)
export interface TrackPath { box: [number, number, number, number]; pts: [number, number, number][]; lock: number }

export interface TextStyle {
  font: string; size: number; weight: number; italic: boolean;
  color: string; align: "start" | "center" | "end"; lineHeight: number; letterSpacing: number;
  stroke: { color: string; width: number } | null;
  shadow: { color: string; blur: number; x: number; y: number } | null;
  box: { color: string; opacity: number; pad: number; radius: number } | null;
  dir: "auto" | "rtl" | "ltr";
  // (v226) text effects: a two-colour fill (top → bottom), a 3D extrusion, a glow, a second outline outside the first
  gradient?: [string, string] | null;
  extrude?: { color: string; depth: number } | null;     // depth: a share of the letter height
  glow?: { color: string; blur: number } | null;         // blur: a share of the picture height
  outline2?: { color: string; width: number } | null;
}
export interface TextAnim { type: string; dur: number }
// motion: a nooi Motion graphic drawn frame by frame from its template and props (the clip's text is then its name)
export interface MotionSpec { tpl: string; props: Record<string, unknown> }
export interface TextClip extends ClipBase { type: "text"; text: string; style: TextStyle; animIn: TextAnim; animOut: TextAnim; template?: string; motion?: MotionSpec | null }
export type Clip = MediaClip | TextClip;

export type TrackKind = "video" | "audio" | "text";
export interface Track { id: Id; kind: TrackKind; name: string; locked: boolean; muted: boolean; hidden: boolean; solo: boolean; clips: Clip[];
  duck?: number | null;   // (v278) how far this track is lowered under the voice tracks (0 = never, 1 = to silence); unset = the project's amount
}
export interface Transition { id: Id; track: Id; a: Id; b: Id; type: string; dur: number }
export interface Marker { id: Id; t: number; name: string; color: string }

export interface ExportSettings { preset: string; format: "mp4" | "webm" | "mov" | "gif" | "mp3" | "wav"; res: "720p" | "1080p" | "4k"; fps: number; quality: "high" | "medium" | "low" }
export interface Ducking { enabled: boolean; amount: number; voiceTracks: Id[] }

export interface Project {
  schema: number; id: Id; name: string; createdAt: number; updatedAt: number;
  width: number; height: number; fps: number; background: string;
  assets: Record<Id, Asset>; folders: Folder[];
  tracks: Track[];            // top to bottom as shown; the top video/text track is drawn over the ones under it
  transitions: Transition[]; markers: Marker[]; beats: number[];
  ducking: Ducking; export: ExportSettings;
  magnetic?: boolean;         // the magnetic main track: V1 closes its gaps and what is attached to it moves with it (default on)
}
