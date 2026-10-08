import { genericAdapter } from "./generic.js";
import { cfg } from "../lib/settings.js";
const env = (k) => process.env[k] || "";
const OVR = { WAN: "wan", TTS: "tts", SAM3D: "sam3d", WORLD: "world" };
// Lazy adapters: keys saved in the admin dashboard take effect without a restart
const make = (name, prefix, buildBody, extra) => { const get = () => { const c = OVR[prefix] ? cfg(OVR[prefix]) : {}; return genericAdapter({ name, url: c.baseUrl || env(prefix + "_API_URL"), key: c.apiKey || env(prefix + "_API_KEY"), buildBody, ...(extra || {}) }); };
  return { name, get configured() { return get().configured; }, submit: (p) => get().submit(p), poll: (id) => get().poll(id) }; };

// ── WAN 3.0 ─────────────────────────────────────────────────────────────
// ⚠ Adjust this mapping to the WAN 3.0 API documentation you have.
// Everything the studio knows about a shot arrives in `p`.
const wanBody = (p) => ({
  model: env("WAN_MODEL") || "wan-3.0",
  prompt: [p.prompt, p.character && `Main character: ${p.character.description}`, ...(p.meta?.refs || []).map((r) => `Keep consistent — ${r.type}: ${r.description}`), p.story && `Style: ${p.story.style}. Setting: ${p.story.setting}`, p.camera && `Camera: ${p.camera}`].filter(Boolean).join("\n"),
  negative_prompt: p.meta?.neg || undefined,
  image_url: p.inputs?.startImage || p.inputs?.vStart || (p.meta?.refs || []).find((r) => r.url)?.url || undefined,   // image-to-video / chapter chaining
  end_image_url: p.inputs?.vEnd || undefined,
  duration: p.dur, aspect_ratio: p.aspect, seed: p.seed,
  audio: p.meta?.audio ?? undefined
});

export const PROVIDERS = {
  video:   make("WAN 3.0", "WAN", wanBody),
  image:   make("Image", "IMAGE", (p) => ({ prompt: [p.prompt, ...(p.meta?.refs || []).map((r) => `${r.type}: ${r.description}`)].join("\n"), model: p.model, aspect_ratio: p.aspect, seed: p.seed, style: p.meta?.style, reference_image_url: p.inputs?.iRef || p.inputs?.skImg || p.inputs?.chRef || p.inputs?.dmIn, control_strength: (p.meta?.sketch || p.meta?.mode) ? p.meta.strength : undefined, edit_mode: p.meta?.mode, num_outputs: 1 })),
  tts:     make("TTS", "TTS", (p) => p.kind === "voiceconvert"
    // speech-to-speech: keep the words & timing, change the voice (library voice or a consented clone)
    ? { task: "convert", audio_url: p.inputs?.alSrc, voice_id: p.meta?.target?.remote || undefined, language: p.meta?.target?.dialect, gender: p.meta?.target?.gender }
    : p.kind === "voiceclone"
    // clone: returns a voice id in the job result (output_url or voice_id) — requires the speaker's consent (checked in the studio)
    ? { task: "clone", name: p.meta?.name, language: p.meta?.dialect, audio_url: p.inputs?.vcSample, consent: !!p.meta?.consent }
    : { text: p.prompt, language: p.meta?.dialect, gender: p.meta?.gender, age: p.meta?.age, style: p.meta?.tone, voice_id: p.meta?.cloneVoice?.remote || undefined }),
  // 3D worlds from a cloud world engine (World Labs Marble, HunyuanWorld hosting, or your own API) — returns a .glb / .spz / .ply URL
  world:   make("3D world", "WORLD", (p) => ({ prompt: p.prompt, engine: p.meta?.engine, biome: p.meta?.biome, time: p.meta?.time, size: p.meta?.size, image_url: p.inputs?.wRef, format: "glb" })),
  lipsync: make("Lip sync", "LIPSYNC", (p) => ({ video_url: p.inputs?.lsV, audio_url: p.inputs?.lsA, text: p.prompt })),
  music:   make("Music", "MUSIC", (p) => ({ prompt: p.prompt, duration: p.dur })),
  matting: make("Matting", "MATTING", (p) => ({ video_url: p.inputs?.bgFg })),
  mocap:   make("Motion capture", "MOCAP", (p) => ({ video_url: p.inputs?.mc, body: p.meta?.body, face: p.meta?.face, hands: p.meta?.hands, output: p.meta?.out })),
  enhance: make("Enhance", "ENHANCE", (p) => ({ task: p.meta?.tool, options: p.meta?.opt, video_url: p.source || p.inputs?.fin })),
  edit:    make("Video edit", "EDIT", (p) => ({ prompt: p.prompt, frame_url: p.inputs?.frame, reference_url: p.inputs?.eRef, mode: p.meta?.mode, strength: p.meta?.strength })),
  transcribe: make("Transcription", "STT", (p) => ({ task: "transcribe", audio_url: p.inputs?.subV || p.source, language: p.meta?.language === "auto" ? undefined : p.meta?.language, timestamps: "segment" })),
  dub:     make("Dubbing", "DUB", (p) => ({ video_url: p.inputs?.subV || p.source, target_language: p.meta?.lang, dialect: p.meta?.dialect, voice_mode: p.meta?.voice, lip_sync: p.meta?.lipsync, segments: p.meta?.segments })),
  sam3d:   make("SAM 3D", "SAM3D", (p) => ({
    task: p.kind === "3d" ? (p.meta?.mode || "objects") : p.kind,   // objects | body | scene | track3d | view3d | place3d
    image_url: p.inputs?.s3dImg || p.inputs?.s3dCap || p.source, mask_url: p.inputs?.s3dMask,
    points: p.meta?.points, output_format: p.meta?.fmt, texture: p.meta?.texture, steps: p.meta?.steps,
    use_pointmap: p.meta?.pointmap, hands: p.meta?.hands, face: p.meta?.face,
    angle: p.meta?.angle, asset_url: p.meta?.assetUrl, video_url: p.source
  })),
  stt:     make("Captions / dub", "STT", (p) => ({ task: p.meta?.tool, options: p.meta?.opt, video_url: p.source || p.inputs?.fin }))
};
// Which provider handles each kind of studio job
export const KIND_TO_CAP = { video: "video", chapter: "video", image: "image", look: "image", sheet: "image", voice: "tts", sfx: "music", music: "music", lipsync: "lipsync", bg: "matting", mocap: "mocap", edit: "edit", finish: "enhance", transcribe: "transcribe", dub: "dub", voiceclone: "tts", voiceconvert: "tts", world: "world", "3d": "sam3d", track3d: "sam3d", view3d: "sam3d", place3d: "sam3d" };
export function capFor(kind, meta) {
  if (kind === "finish" && ["captions", "dub"].includes(meta?.tool)) return "stt";
  if (kind === "finish" && meta?.tool === "extend") return "video";
  if (kind === "video" && meta?.ref3d) return "video";  // 3D reference is passed to the video model as meta.ref3dUrl
  return KIND_TO_CAP[kind];
}
