// (v278) a clip's sound: equaliser (low · mid · high), a voice changer (12 voices), a compressor and the light clean-up —
// the same Web Audio nodes in the preview (live) and the export (OfflineAudioContext), so what you hear is what you get.
import type { AudioFx } from "@nooi/editor-core";

export interface FxChain { input: AudioNode; output: AudioNode; stop: () => void }
const SEMI: Record<string, number> = { deep: -5, chipmunk: 7, monster: -9, alien: 4 };

export const fxKey = (afx?: AudioFx | null, denoise?: boolean) => (afx && (afx.voice !== "none" || afx.comp || afx.eq.some((x) => x)) ? JSON.stringify(afx) : "") + (denoise ? "|dn" : "");
export const hasFx = (afx?: AudioFx | null, denoise?: boolean) => !!fxKey(afx, denoise);

function curve(k: number): Float32Array { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; }
function impulse(ctx: BaseAudioContext, secs: number, decay: number): AudioBuffer {
  const n = Math.round(ctx.sampleRate * secs), b = ctx.createBuffer(2, n, ctx.sampleRate); let s = 1234567;
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = ((s / 0x7fffffff) * 2 - 1) * Math.pow(1 - i / n, decay); } }
  return b;
}
/** a pitch shifter: two delay lines whose delay slides (a sawtooth), each faded in and out (a raised cosine) so the jumps are not heard */
function pitchShift(ctx: BaseAudioContext, semis: number, starts: OscillatorNode[]): { input: AudioNode; output: AudioNode } {
  const r = Math.pow(2, semis / 12), B = 0.1, f = Math.abs(1 - r) / B, N = 32;
  const real = new Float32Array(N + 1), imA = new Float32Array(N + 1), imB = new Float32Array(N + 1), cosR = new Float32Array(N + 1), cosI = new Float32Array(N + 1);
  for (let n = 1; n <= N; n++) { imA[n] = ((n % 2 ? 1 : -1) * 2) / (n * Math.PI); imB[n] = -2 / (n * Math.PI); }
  cosR[1] = 1;
  const wave = (re: Float32Array, im: Float32Array) => ctx.createPeriodicWave(re, im, { disableNormalization: true });
  const input = ctx.createGain(), output = ctx.createGain(); const dir = r > 1 ? -1 : 1;
  const mk = (im: Float32Array, fadeSign: number) => {
    const d = ctx.createDelay(1); d.delayTime.value = B / 2;
    const saw = ctx.createOscillator(); saw.setPeriodicWave(wave(real, im)); saw.frequency.value = f;
    const sg = ctx.createGain(); sg.gain.value = (dir * B) / 2; saw.connect(sg).connect(d.delayTime);
    const fade = ctx.createGain(); fade.gain.value = 0.5; const co = ctx.createOscillator(); co.setPeriodicWave(wave(cosR, cosI)); co.frequency.value = f;
    const cg = ctx.createGain(); cg.gain.value = 0.5 * fadeSign; co.connect(cg).connect(fade.gain);
    input.connect(d).connect(fade).connect(output); starts.push(saw, co);
  };
  mk(imA, 1); mk(imB, -1);
  return { input, output };
}
/** build the chain for a clip: input → (clean-up) → EQ → voice → compressor → output */
export function buildFx(ctx: BaseAudioContext, afx: AudioFx | null | undefined, denoiseFilters: boolean): FxChain {
  const starts: OscillatorNode[] = []; const input = ctx.createGain(); let tail: AudioNode = input;
  const add = (n: AudioNode, out?: AudioNode) => { tail.connect(n); tail = out || n; };
  const biq = (type: BiquadFilterType, freq: number, q = 0.7, gain = 0) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = freq; b.Q.value = q; b.gain.value = gain; return b; };
  if (denoiseFilters) { add(biq("highpass", 80)); add(biq("lowpass", 10000)); }
  if (afx) {
    const [lo, mid, hi] = afx.eq || [0, 0, 0];
    if (lo) add(biq("lowshelf", 220, 0.7, lo)); if (mid) add(biq("peaking", 1000, 0.7, mid)); if (hi) add(biq("highshelf", 6000, 0.7, hi));
    const v = afx.voice || "none";
    if (SEMI[v] != null) { const ps = pitchShift(ctx, SEMI[v], starts); add(ps.input, ps.output); }
    if (v === "monster") { add(biq("lowpass", 3000)); const ws = ctx.createWaveShaper(); ws.curve = curve(2.5) as Float32Array<ArrayBuffer>; add(ws); }
    if (v === "robot" || v === "alien") {   // ring modulation: the voice times a tone
      const ring = ctx.createGain(); ring.gain.value = 0; const o = ctx.createOscillator(); o.frequency.value = v === "robot" ? 55 : 30; o.connect(ring.gain); starts.push(o);
      if (v === "robot") add(ring); else { const dry = ctx.createGain(); dry.gain.value = 0.55; const mix = ctx.createGain(); tail.connect(dry).connect(mix); tail.connect(ring).connect(mix); tail = mix; }
    }
    if (v === "telephone") { add(biq("highpass", 450)); add(biq("lowpass", 3200)); const ws = ctx.createWaveShaper(); ws.curve = curve(1.6) as Float32Array<ArrayBuffer>; add(ws); }
    if (v === "radio") { add(biq("highpass", 300)); add(biq("lowpass", 4500)); add(biq("peaking", 1800, 1, 5)); const ws = ctx.createWaveShaper(); ws.curve = curve(1.3) as Float32Array<ArrayBuffer>; add(ws); }
    if (v === "megaphone") { add(biq("bandpass", 1100, 0.9)); const ws = ctx.createWaveShaper(); ws.curve = curve(4) as Float32Array<ArrayBuffer>; add(ws); const g = ctx.createGain(); g.gain.value = 1.6; add(g); }
    if (v === "underwater") { const lp = biq("lowpass", 650, 2); const o = ctx.createOscillator(); o.frequency.value = 0.7; const og = ctx.createGain(); og.gain.value = 200; o.connect(og).connect(lp.frequency); starts.push(o); add(lp); }
    if (v === "echo" || v === "hall") {
      const dry = ctx.createGain(), wet = ctx.createGain(), mix = ctx.createGain(); dry.gain.value = 1; wet.gain.value = v === "echo" ? 0.5 : 0.45;
      tail.connect(dry).connect(mix);
      if (v === "echo") { const d = ctx.createDelay(1); d.delayTime.value = 0.28; const fb = ctx.createGain(); fb.gain.value = 0.42; tail.connect(d); d.connect(fb).connect(d); d.connect(wet).connect(mix); }
      else { const cv = ctx.createConvolver(); cv.buffer = impulse(ctx, 2.2, 2.6); tail.connect(cv).connect(wet).connect(mix); }
      tail = mix;
    }
    if (afx.comp || denoiseFilters) { const c = ctx.createDynamicsCompressor(); c.threshold.value = afx.comp ? -24 : -18; c.ratio.value = afx.comp ? 4 : 2.5; c.attack.value = 0.005; c.release.value = 0.2; add(c); }
  } else if (denoiseFilters) { const c = ctx.createDynamicsCompressor(); c.threshold.value = -18; c.ratio.value = 2.5; add(c); }
  const output = ctx.createGain(); tail.connect(output);
  const t = ctx.currentTime; for (const o of starts) o.start(t);
  return { input, output, stop: () => { for (const o of starts) try { o.stop(); o.disconnect(); } catch { /* */ } } };
}
