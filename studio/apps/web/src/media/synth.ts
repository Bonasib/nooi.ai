// (v245) The synthesizers that play a score written in code (editor-core compose): a soft pad, a bass, a lead and a pluck, a kick,
// a snare and a hi-hat — all made from the browser's own oscillators and noise, mixed offline, so the same score always sounds the
// same. Free; nothing downloaded.
import { hz } from "@nooi/editor-core";
import type { Note } from "@nooi/editor-core";

export async function renderScore(notes: Note[], dur: number, rate = 44100): Promise<AudioBuffer> {
  const len = Math.ceil((dur + 0.6) * rate), ctx = new OfflineAudioContext(2, len, rate);
  const master = ctx.createGain(); master.gain.value = 0.8; const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; master.connect(comp).connect(ctx.destination);
  master.gain.setValueAtTime(0.8, Math.max(0, dur - 1.6)); master.gain.linearRampToValueAtTime(0.0001, dur + 0.4);   // the end fades out
  const noise = ctx.createBuffer(1, rate, rate), nd = noise.getChannelData(0); let s = 12345; for (let i = 0; i < nd.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; nd[i] = (s / 0x7fffffff) * 2 - 1; }
  const pan = (v: number) => { const p = ctx.createStereoPanner(); p.pan.value = v; p.connect(master); return p; };
  const busPad = ctx.createBiquadFilter(); busPad.type = "lowpass"; busPad.frequency.value = 1400; busPad.connect(pan(0));
  const env = (g: GainNode, t: number, a: number, d: number, peak: number, rel: number) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + Math.max(a, d - rel)); g.gain.exponentialRampToValueAtTime(0.0001, t + d + rel); };
  for (const n of notes) {
    const t = n.t, f = hz(n.midi);
    if (n.inst === "pad") { for (const det of [-7, 7]) { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det; const g = ctx.createGain(); env(g, t, 0.35, n.d, 0.035 * n.v, 0.4); o.connect(g).connect(busPad); o.start(t); o.stop(t + n.d + 0.5); } }
    else if (n.inst === "bass") { const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f; const o2 = ctx.createOscillator(); o2.type = "square"; o2.frequency.value = f; const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 380;
      const g = ctx.createGain(), g2 = ctx.createGain(); g2.gain.value = 0.25; env(g, t, 0.01, n.d, 0.32 * n.v, 0.06); o.connect(g); o2.connect(g2).connect(g); g.connect(lp).connect(pan(0)); o.start(t); o2.start(t); o.stop(t + n.d + 0.1); o2.stop(t + n.d + 0.1); }
    else if (n.inst === "lead" || n.inst === "pluck") { const o = ctx.createOscillator(); o.type = n.inst === "lead" ? "square" : "triangle"; o.frequency.value = f; const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = n.inst === "lead" ? 2600 : 3800;
      const g = ctx.createGain(); if (n.inst === "pluck") { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2 * n.v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(0.6, n.d + 0.3)); } else env(g, t, 0.02, n.d, 0.09 * n.v, 0.08);
      o.connect(lp).connect(g).connect(pan(n.inst === "lead" ? -0.18 : 0.22)); o.start(t); o.stop(t + n.d + 0.6); }
    else if (n.inst === "kick") { const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); const g = ctx.createGain(); g.gain.setValueAtTime(0.9 * n.v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g).connect(pan(0)); o.start(t); o.stop(t + 0.32); }
    else if (n.inst === "snare" || n.inst === "hat") { const src = ctx.createBufferSource(); src.buffer = noise; const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = n.inst === "hat" ? 7000 : 1600; const g = ctx.createGain(), dd = n.inst === "hat" ? 0.05 : 0.16;
      g.gain.setValueAtTime(n.inst === "hat" ? 0.18 * n.v : 0.5 * n.v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dd); src.connect(hp).connect(g).connect(pan(n.inst === "hat" ? 0.3 : 0)); src.start(t, (n.t * 7.31) % 0.5); src.stop(t + dd + 0.02);
      if (n.inst === "snare") { const o = ctx.createOscillator(); o.frequency.value = 185; const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.25 * n.v, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); o.connect(g2).connect(pan(0)); o.start(t); o.stop(t + 0.12); } }
  }
  return ctx.startRendering();
}
