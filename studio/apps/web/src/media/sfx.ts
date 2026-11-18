// Sound effects made on the device (Web Audio, no recordings, no licences): each is a few oscillators and filtered noise rendered
// offline into a WAV file — then it is an ordinary sound in the library and on the timeline.
import { encodeWav } from "../engine/wav";

type Make = (c: OfflineAudioContext, out: AudioNode) => void;
const RATE = 44100;
const noise = (c: OfflineAudioContext, sec: number) => { const b = c.createBuffer(1, Math.ceil(sec * RATE), RATE), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; return s; };
const env = (c: OfflineAudioContext, pts: [number, number][], kind: "lin" | "exp" = "lin") => { const g = c.createGain(); g.gain.setValueAtTime(pts[0][1], pts[0][0]); for (const [t, v] of pts.slice(1)) kind === "exp" ? g.gain.exponentialRampToValueAtTime(Math.max(1e-4, v), t) : g.gain.linearRampToValueAtTime(v, t); return g; };
const tone = (c: OfflineAudioContext, type: OscillatorType, f: [number, number][], out: AudioNode, t0 = 0, t1 = 1) => { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f[0][1], f[0][0]); for (const [t, v] of f.slice(1)) o.frequency.exponentialRampToValueAtTime(v, t); o.connect(out); o.start(t0); o.stop(t1); };

export const SFX: { id: string; en: string; ar: string; sec: number; make: Make }[] = [
  { id: "whoosh", en: "Whoosh", ar: "حفيف", sec: 0.9, make: (c, out) => { const n = noise(c, 0.9), f = c.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.2; f.frequency.setValueAtTime(250, 0); f.frequency.exponentialRampToValueAtTime(3200, 0.55); f.frequency.exponentialRampToValueAtTime(900, 0.9); const g = env(c, [[0, 0], [0.45, 0.9], [0.9, 0]]); n.connect(f).connect(g).connect(out); n.start(); } },
  { id: "swoosh", en: "Swoosh", ar: "سووش", sec: 0.45, make: (c, out) => { const n = noise(c, 0.45), f = c.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 2; f.frequency.setValueAtTime(5000, 0); f.frequency.exponentialRampToValueAtTime(600, 0.45); const g = env(c, [[0, 0], [0.08, 0.8], [0.45, 0]]); n.connect(f).connect(g).connect(out); n.start(); } },
  { id: "pop", en: "Pop", ar: "فرقعة", sec: 0.2, make: (c, out) => { const g = env(c, [[0, 0.9], [0.18, 0.001]], "exp"); g.connect(out); tone(c, "sine", [[0, 700], [0.12, 140]], g, 0, 0.2); } },
  { id: "click", en: "Click", ar: "نقرة", sec: 0.06, make: (c, out) => { const n = noise(c, 0.06), f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 2500; const g = env(c, [[0, 0.9], [0.03, 0.001]], "exp"); n.connect(f).connect(g).connect(out); n.start(); } },
  { id: "ding", en: "Ding", ar: "رنين", sec: 1.4, make: (c, out) => { const g = env(c, [[0, 0.6], [1.4, 0.001]], "exp"); g.connect(out); tone(c, "sine", [[0, 1320]], g, 0, 1.4); const g2 = env(c, [[0, 0.25], [0.8, 0.001]], "exp"); g2.connect(out); tone(c, "sine", [[0, 2640]], g2, 0, 1.4); } },
  { id: "riser", en: "Riser", ar: "تصاعد", sec: 2.2, make: (c, out) => { const g = env(c, [[0, 0.02], [2.1, 0.5], [2.2, 0]]); g.connect(out); tone(c, "sawtooth", [[0, 180], [2.2, 1400]], g, 0, 2.2); const n = noise(c, 2.2), f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.setValueAtTime(400, 0); f.frequency.exponentialRampToValueAtTime(6000, 2.2); const gn = env(c, [[0, 0], [2.1, 0.35], [2.2, 0]]); n.connect(f).connect(gn).connect(out); n.start(); } },
  { id: "impact", en: "Impact", ar: "ارتطام", sec: 1.5, make: (c, out) => { const g = env(c, [[0, 1], [1.4, 0.001]], "exp"); g.connect(out); tone(c, "sine", [[0, 140], [0.6, 38]], g, 0, 1.5); const n = noise(c, 0.5), f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900; const gn = env(c, [[0, 0.8], [0.4, 0.001]], "exp"); n.connect(f).connect(gn).connect(out); n.start(); } },
  { id: "glitch", en: "Glitch", ar: "تشويش", sec: 0.5, make: (c, out) => { const g = c.createGain(); g.gain.value = 0.35; g.connect(out); for (let i = 0; i < 10; i++) { const t = i * 0.05, o = c.createOscillator(); o.type = "square"; o.frequency.value = 120 + Math.random() * 1600; o.connect(g); o.start(t); o.stop(t + 0.035); } } },
  { id: "beep", en: "Censor beep", ar: "صفارة حذف", sec: 0.6, make: (c, out) => { const g = env(c, [[0, 0], [0.01, 0.5], [0.58, 0.5], [0.6, 0]]); g.connect(out); tone(c, "sine", [[0, 1000]], g, 0, 0.6); } },
  { id: "shutter", en: "Camera shutter", ar: "غالق الكاميرا", sec: 0.3, make: (c, out) => { for (const t of [0, 0.11]) { const n = noise(c, 0.08), f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 3200; const g = env(c, [[t, 0.9], [t + 0.07, 0.001]], "exp"); n.connect(f).connect(g).connect(out); n.start(t); } } },
  { id: "typing", en: "Typing", ar: "كتابة", sec: 1.4, make: (c, out) => { let t = 0.02; while (t < 1.3) { const n = noise(c, 0.04), f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2000 + Math.random() * 1500; const g = env(c, [[t, 0.7], [t + 0.03, 0.001]], "exp"); n.connect(f).connect(g).connect(out); n.start(t); t += 0.07 + Math.random() * 0.12; } } },
  { id: "coin", en: "Coin", ar: "عملة", sec: 0.5, make: (c, out) => { const g = env(c, [[0, 0.35], [0.5, 0.001]], "exp"); g.connect(out); const o = c.createOscillator(); o.type = "square"; o.frequency.setValueAtTime(988, 0); o.frequency.setValueAtTime(1319, 0.08); o.connect(g); o.start(0); o.stop(0.5); } },
  { id: "success", en: "Success", ar: "نجاح", sec: 0.9, make: (c, out) => { [523, 659, 784, 1047].forEach((f, i) => { const t = i * 0.11, g = env(c, [[t, 0.0001], [t + 0.02, 0.35], [t + 0.5, 0.001]], "exp"); g.connect(out); tone(c, "triangle", [[t, f]], g, t, t + 0.55); }); } },
  { id: "error", en: "Error", ar: "خطأ", sec: 0.6, make: (c, out) => { [330, 247].forEach((f, i) => { const t = i * 0.18, g = env(c, [[t, 0.4], [t + 0.3, 0.001]], "exp"); g.connect(out); tone(c, "square", [[t, f]], g, t, t + 0.32); }); } },
  { id: "heartbeat", en: "Heartbeat", ar: "نبض القلب", sec: 1.6, make: (c, out) => { for (const t of [0, 0.22, 0.8, 1.02]) { const g = env(c, [[t, 0.9], [t + 0.18, 0.001]], "exp"); g.connect(out); tone(c, "sine", [[t, 70], [t + 0.15, 45]], g, t, t + 0.2); } } },
  { id: "applause", en: "Applause", ar: "تصفيق", sec: 2.5, make: (c, out) => { for (let i = 0; i < 160; i++) { const t = Math.random() * 2.3, n = noise(c, 0.03), f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1200 + Math.random() * 2500; f.Q.value = 1.5; const v = 0.25 * Math.sin(Math.PI * Math.min(1, t / 2.4)); const g = env(c, [[t, v + 0.02], [t + 0.025, 0.001]], "exp"); n.connect(f).connect(g).connect(out); n.start(t); } } },
];
export async function sfxBuffer(id: string): Promise<AudioBuffer | null> {
  const s = SFX.find((x) => x.id === id); if (!s) return null;
  const c = new OfflineAudioContext(2, Math.ceil(s.sec * RATE), RATE); const master = c.createDynamicsCompressor(); master.connect(c.destination);
  s.make(c, master); return await c.startRendering();
}
export async function sfxFile(id: string): Promise<File | null> {
  const ab = await sfxBuffer(id); if (!ab) return null;
  return new File([encodeWav(ab)], "sfx-" + id + ".wav", { type: "audio/wav" });
}
// a short listen before adding (no file made)
let ctx: AudioContext | null = null;
export async function playSfx(id: string) { const ab = await sfxBuffer(id); if (!ab) return; ctx = ctx || new AudioContext(); const s = ctx.createBufferSource(); s.buffer = ab; s.connect(ctx.destination); s.start(); }
