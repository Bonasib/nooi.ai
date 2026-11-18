// (v245) Music made in code: a mood picks the tempo, the key, the chords, the drum and bass patterns and how busy the tune is; the
// score is written from a seed (the same seed always writes the same music) and the browser plays it with its own synthesizers —
// free, no file to license, any length (whole bars). Our own composer: plain music theory, nothing sampled.
export type Inst = "pad" | "bass" | "lead" | "pluck" | "kick" | "snare" | "hat";
export interface Note { t: number; d: number; midi: number; v: number; inst: Inst }
export interface Mood { id: string; en: string; ar: string; bpm: number; root: number; scale: number[]; prog: number[]; kick: string; snare: string; hat: string; bass: string; lead: number; lead2?: Inst; pad: number; swing?: number }
const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10], DOR = [0, 2, 3, 5, 7, 9, 10];
// 16 steps a bar ("x" hit, "." rest); bass: "r" root, "f" fifth, "o" octave
export const MOODS: Mood[] = [
  { id: "calm", en: "Calm", ar: "هادئ", bpm: 76, root: 57, scale: MAJ, prog: [0, 4, 5, 3], kick: "x.......x.......", snare: "................", hat: "..x...x...x...x.", bass: "r.......f.......", lead: 0.25, lead2: "pluck", pad: 1 },
  { id: "upbeat", en: "Upbeat", ar: "حماسي", bpm: 120, root: 60, scale: MAJ, prog: [0, 5, 3, 4], kick: "x...x...x...x...", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.", bass: "r.r.o.r.r.r.o.f.", lead: 0.55, pad: 0.6 },
  { id: "epic", en: "Epic", ar: "ملحمي", bpm: 92, root: 50, scale: MIN, prog: [0, 5, 2, 6], kick: "x..x..x.x..x..x.", snare: "....x.......x..x", hat: "x...x...x...x...", bass: "r..r..r.r..r..o.", lead: 0.4, pad: 1 },
  { id: "lofi", en: "Lo-fi", ar: "لو-فاي", bpm: 82, root: 53, scale: DOR, prog: [1, 4, 0, 5], kick: "x......x..x.....", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.", bass: "r......f..r.....", lead: 0.3, lead2: "pluck", pad: 0.8, swing: 0.18 },
  { id: "corporate", en: "Corporate", ar: "شركات", bpm: 110, root: 62, scale: MAJ, prog: [0, 4, 5, 3], kick: "x.......x.......", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.", bass: "r.r.r.r.f.f.f.f.", lead: 0.35, lead2: "pluck", pad: 0.7 },
  { id: "tension", en: "Tension", ar: "تشويق", bpm: 100, root: 45, scale: MIN, prog: [0, 0, 5, 4], kick: "x.....x.x.......", snare: "............x...", hat: "x.xxx.xxx.xxx.xx", bass: "rrrrrrrrrrrrrrrr", lead: 0.15, pad: 0.9 },
  { id: "happy", en: "Happy", ar: "مبهج", bpm: 128, root: 65, scale: MAJ, prog: [0, 3, 4, 0], kick: "x...x...x...x...", snare: "....x.......x...", hat: "..x...x...x...x.", bass: "r...o...r...o...", lead: 0.6, lead2: "pluck", pad: 0.5 },
  { id: "cinematic", en: "Cinematic", ar: "سينمائي", bpm: 70, root: 48, scale: MIN, prog: [0, 5, 3, 4], kick: "x...............", snare: "................", hat: "................", bass: "r...............", lead: 0.2, pad: 1 },
];
// a seeded random (the same seed, the same music)
const rng = (seed: number) => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const degree = (m: Mood, d: number, oct = 0) => { const n = m.scale.length; const o = Math.floor(d / n), i = ((d % n) + n) % n; return m.root + m.scale[i] + 12 * (o + oct); };
/** the music for a mood, `secs` long at least (whole bars): its notes, its tempo, its beats (seconds) */
export function compose(moodId: string, secs: number, seed = 1): { mood: Mood; bpm: number; dur: number; notes: Note[]; beats: number[] } {
  const m = MOODS.find((x) => x.id === moodId) || MOODS[0]; const R = rng(seed * 7919 + moodId.length); const beat = 60 / m.bpm, bar = beat * 4, step = beat / 4;
  const bars = Math.max(2, Math.ceil(secs / bar)), notes: Note[] = []; const sw = (i: number) => (i % 2 ? (m.swing || 0) * step : 0);
  let lead = 2;   // the tune's place on the scale (a walk)
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar, ch = m.prog[b % m.prog.length], intro = b === 0, last = b === bars - 1, lvl = intro ? 0.6 : last ? 0.8 : 1;
    if (m.pad) for (const k of [0, 2, 4]) notes.push({ t: t0, d: bar, midi: degree(m, ch + k), v: 0.5 * m.pad * lvl, inst: "pad" });
    for (let i = 0; i < 16; i++) {
      const t = t0 + i * step + sw(i);
      if (!intro && m.kick[i] === "x") notes.push({ t, d: 0.2, midi: 36, v: 0.9 * lvl, inst: "kick" });
      if (!intro && m.snare[i] === "x") notes.push({ t, d: 0.15, midi: 38, v: 0.6 * lvl, inst: "snare" });
      if (m.hat[i] === "x" && (!intro || i % 4 === 2)) notes.push({ t, d: 0.05, midi: 42, v: (i % 4 === 0 ? 0.35 : 0.25) * lvl, inst: "hat" });
      const bs = m.bass[i]; if (bs && bs !== ".") { let len = 1; while (i + len < 16 && m.bass[i + len] === ".") len++; notes.push({ t, d: Math.min(len, 4) * step * 0.95, midi: degree(m, ch + (bs === "f" ? 4 : 0), bs === "o" ? -1 : -2), v: 0.7 * lvl, inst: "bass" }); }
      if (!intro && i % 2 === 0 && R() < m.lead) {   // the tune: steps on the scale, mostly near, landing on the chord at the bar's start
        lead += i === 0 ? Math.round((ch + [0, 2, 4][Math.floor(R() * 3)] - lead) * 0.6) : [-2, -1, -1, 1, 1, 2, 0][Math.floor(R() * 7)]; lead = Math.max(-2, Math.min(11, lead));
        notes.push({ t, d: step * (R() < 0.3 ? 4 : 2) * 0.9, midi: degree(m, lead, 1), v: 0.45 * lvl, inst: m.lead2 && R() < 0.5 ? m.lead2 : "lead" });
      }
    }
  }
  const dur = bars * bar; return { mood: m, bpm: m.bpm, dur: Math.round(dur * 1000) / 1000, notes: notes.sort((a, b) => a.t - b.t), beats: Array.from({ length: bars * 4 }, (_, i) => Math.round(i * beat * 1000) / 1000) };
}
export const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
