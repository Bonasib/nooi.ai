// (v243) Editing by the words said, checking before posting, loudness, and cuts on the music's grid — plain functions on plain data
// (the browser, a worker and the tests all use them). Words are timeline seconds: {s: start, e: end, w: the word}.
// Our own code; the ideas (phrases at pauses, a retake is the same opening said again, platform safe areas, −14 LUFS) are common
// editing practice — the numbers for the platforms are the ones each platform publishes for its uploads.
import type { Id, MediaClip, Project, TextClip } from "./schema";
import * as T from "./timeline";

export interface Word { s: number; e: number; w: string }
export type CutKind = "pause" | "filler" | "retake";
export interface Cut { a: number; b: number; kind: CutKind; text: string }

const r3 = (v: number) => Math.round(v * 1000) / 1000;
// letters only, lower case, Arabic forms folded (أ إ آ → ا, ة → ه, ى → ي, no tashkeel or tatweel)
export const norm = (s: string) => s.toLowerCase().replace(/[ً-ٰٟـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\p{L}\p{N}']+/gu, "").replace(/(.)\1{2,}/gu, "$1$1");

// the sounds that are never words (always cut) and the words people lean on (cut only when asked — they can carry meaning)
export const FILLERS = {
  hard: ["um", "umm", "uh", "uhh", "er", "erm", "ah", "ahh", "hmm", "mm", "mhm", "eh",
    "امم", "ام", "اه", "اا", "ااه", "هم", "همم", "ايه", "اي", "يعنيي", "ممم", "مم", "اوه"],
  soft: ["like", "basically", "actually", "literally", "so", "right", "okay", "ok", "well", "anyway",
    "يعني", "طيب", "بصراحه", "اصلا", "اوكي", "خلاص", "المهم", "فاهم", "شوف", "تعرف", "والله"],
  pairs: [["you", "know"], ["i", "mean"], ["kind", "of"], ["sort", "of"], ["فاهم", "علي"], ["زي", "ما"], ["كيف", "اقول"]] as [string, string][],
};
const HARD = new Set(FILLERS.hard.map(norm)), SOFT = new Set(FILLERS.soft.map(norm));

/** the words grouped into phrases: a new phrase after a pause of `gap` seconds or after a sentence's end (. ! ? ؟ …) */
export function phrases(words: Word[], gap = 0.45): { s: number; e: number; i0: number; i1: number; text: string }[] {
  const out: { s: number; e: number; i0: number; i1: number; text: string }[] = []; let i0 = 0;
  for (let i = 0; i < words.length; i++) {
    const last = i === words.length - 1, end = /[.!?؟…]$/.test(words[i].w.trim()), pause = !last && words[i + 1].s - words[i].e >= gap;
    if (last || end || pause) { const ws = words.slice(i0, i + 1); out.push({ s: ws[0].s, e: ws[ws.length - 1].e, i0, i1: i, text: ws.map((x) => x.w).join(" ") }); i0 = i + 1; }
  }
  return out;
}
// how alike two word lists are (0..1): twice the longest common run of words over both lengths
export function alike(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0; const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] + 1 : Math.max(d[i - 1][j], d[i][j - 1]);
  return (2 * d[m][n]) / (m + n);
}
/** the phrases said again a little later (a retake): the same first three words, or the first eight words over 72% alike, within the next four phrases — the earlier one goes */
export function retakes(ph: { text: string }[]): number[] {
  const W = ph.map((p) => p.text.split(/\s+/).map(norm).filter(Boolean)); const out: number[] = [];
  for (let i = 0; i < ph.length; i++) {
    const a = W[i]; if (a.length < 3) continue;
    for (let j = i + 1; j <= Math.min(ph.length - 1, i + 4); j++) {
      const b = W[j]; if (b.length < 3) continue;
      if ((a[0] === b[0] && a[1] === b[1] && a[2] === b[2]) || alike(a.slice(0, 8), b.slice(0, 8)) > 0.72) { out.push(i); break; }
    }
  }
  return out;
}
export interface CutOpts { pause?: number; keep?: number; fillers?: boolean; soft?: boolean; retakes?: boolean; pauses?: boolean; dur?: number }
/** what to take out: long pauses (a little air kept each side), filler sounds, the leaned-on words when asked, and retakes — never inside a word that stays */
export function findCuts(words: Word[], o: CutOpts = {}): Cut[] {
  const pause = o.pause ?? 0.6, keep = o.keep ?? 0.15; const ws = words.filter((w) => w.e > w.s && w.w.trim()).sort((a, b) => a.s - b.s); const cuts: Cut[] = [];
  if (!ws.length) return [];
  if (o.pauses !== false) {
    if (ws[0].s > pause) cuts.push({ a: 0, b: r3(ws[0].s - keep), kind: "pause", text: "" });
    for (let i = 0; i + 1 < ws.length; i++) { const g = ws[i + 1].s - ws[i].e; if (g > pause) cuts.push({ a: r3(ws[i].e + keep), b: r3(ws[i + 1].s - keep), kind: "pause", text: "" }); }
    if (o.dur != null && o.dur - ws[ws.length - 1].e > pause) cuts.push({ a: r3(ws[ws.length - 1].e + keep), b: r3(o.dur), kind: "pause", text: "" });
  }
  const span = (i0: number, i1: number, kind: CutKind) => {   // the words i0..i1 out, to the next word's start (the gap after them too)
    const a = i0 > 0 ? Math.max(ws[i0 - 1].e, ws[i0].s - 0.03) : Math.max(0, ws[i0].s - 0.03);
    const b = i1 + 1 < ws.length ? Math.min(ws[i1 + 1].s, ws[i1].e + 0.03) : ws[i1].e + 0.03;
    cuts.push({ a: r3(a), b: r3(b), kind, text: ws.slice(i0, i1 + 1).map((w) => w.w).join(" ") });
  };
  if (o.fillers !== false || o.soft) for (let i = 0; i < ws.length; i++) {
    const n = norm(ws[i].w), nx = i + 1 < ws.length ? norm(ws[i + 1].w) : "";
    if (o.fillers !== false && HARD.has(n)) span(i, i, "filler");
    else if (o.soft && FILLERS.pairs.some(([x, y]) => norm(x) === n && norm(y) === nx)) { span(i, i + 1, "filler"); i++; }
    else if (o.soft && SOFT.has(n)) span(i, i, "filler");
  }
  if (o.retakes !== false) { const ph = phrases(ws); for (const i of retakes(ph)) { const p0 = ph[i], nx = ph[i + 1]; cuts.push({ a: r3(p0.s > 0 ? Math.max(0, p0.s - 0.03) : 0), b: r3(nx ? nx.s - 0.03 : p0.e), kind: "retake", text: p0.text }); } }
  return mergeCuts(cuts.filter((c) => c.b - c.a > 0.05));
}
/** overlapping or touching cuts joined into one (the stronger kind named: retake > filler > pause) */
export function mergeCuts(cuts: Cut[]): Cut[] {
  const rank: Record<CutKind, number> = { pause: 0, filler: 1, retake: 2 }; const s = [...cuts].sort((x, y) => x.a - y.a); const out: Cut[] = [];
  for (const c of s) { const l = out[out.length - 1]; if (l && c.a <= l.b + 0.04) { l.b = Math.max(l.b, c.b); if (rank[c.kind] > rank[l.kind]) { l.kind = c.kind; } if (c.text) l.text = (l.text ? l.text + " · " : "") + c.text; } else out.push({ ...c }); }
  return out;
}
/** the words left after the cuts, moved to their new times (cuts in any order) */
export function wordsAfter(words: Word[], cuts: { a: number; b: number }[]): Word[] {
  const cs = [...cuts].sort((x, y) => x.a - y.a);
  return words.filter((w) => !cs.some((c) => w.s >= c.a - 1e-3 && w.e <= c.b + 1e-3)).map((w) => { let d = 0; for (const c of cs) if (c.b <= w.s + 1e-3) d += c.b - c.a; return { ...w, s: r3(w.s - d), e: r3(w.e - d) }; });
}

/** music beds: sounds on sound tracks that aren't a video's own sound (a detached sound remembers its clip) */
export const isBed = (p: Project, c: { type: string; link?: Id | null; asset?: Id }, kind: string) => kind === "audio" && c.type === "media" && !(c as MediaClip).link && p.assets[(c as MediaClip).asset]?.kind === "audio";
/** where the pictures and voices end (the music beds left out) */
export function contentEnd(p: Project): number { let e = 0; for (const tr of p.tracks) for (const c of tr.clips) if (!isBed(p, c, tr.kind)) e = Math.max(e, T.clipEnd(c)); return e || T.duration(p); }
/** like cutRange, but the music keeps playing under the cut: beds that cross it are left whole, those after it move up */
export function cutTime(p: Project, from: number, to: number, o: { keepMusic?: boolean } = {}): boolean {
  if (to - from < 0.02) return false; const keep = o.keepMusic !== false;
  const only = new Set<Id>(); for (const tr of p.tracks) for (const c of tr.clips) if (!(keep && isBed(p, c, tr.kind))) only.add(c.id);
  if (!only.size) return false;
  T.splitAt(p, from, only); const only2 = new Set<Id>(); for (const tr of p.tracks) for (const c of tr.clips) if (!(keep && isBed(p, c, tr.kind))) only2.add(c.id); T.splitAt(p, to, only2);
  for (const tr of p.tracks) {
    if (tr.locked) continue;
    tr.clips = tr.clips.filter((c) => (keep && isBed(p, c, tr.kind)) || !(c.start >= from - T.EPS && T.clipEnd(c) <= to + T.EPS));
    for (const c of tr.clips) if (c.start >= to - T.EPS) c.start = Math.round((c.start - (to - from)) * 1e6) / 1e6;
  }
  for (const m of p.markers) if (m.t >= to) m.t -= to - from; else if (m.t > from) m.t = from;
  p.beats = (p.beats || []).filter((b) => b <= from || b >= to).map((b) => (b >= to ? r3(b - (to - from)) : b));
  T.validTransitions(p); return true;
}
/** many cuts at once, from the end so the earlier ones keep their place; returns the seconds taken out */
export function applyCuts(p: Project, cuts: { a: number; b: number }[], o: { keepMusic?: boolean } = {}): number {
  let s = 0; for (const c of [...cuts].sort((x, y) => y.a - x.a)) if (cutTime(p, c.a, c.b, o)) s += c.b - c.a;
  // a bed now running past the end of the pictures and words is trimmed to it
  if (o.keepMusic !== false) { const end = contentEnd(p);
    for (const tr of p.tracks) for (const c of tr.clips) if (isBed(p, c, tr.kind) && T.clipEnd(c) > end + 0.05 && c.start < end) c.dur = r3(end - c.start); }
  return r3(s);
}

// ---- cuts on the music's grid
export type Grid = "beats" | "bars" | "8ths";
/** the beats as a grid: every beat, the first of every four (bars, starting on the strongest of the first four), or halves (8ths) */
export function beatGrid(beats: number[], g: Grid, strength?: number[]): number[] {
  const b = [...beats].sort((x, y) => x - y); if (g === "beats" || b.length < 2) return b;
  if (g === "8ths") { const out: number[] = []; for (let i = 0; i < b.length; i++) { out.push(b[i]); if (i + 1 < b.length) out.push(r3((b[i] + b[i + 1]) / 2)); } return out; }
  let ph = 0; if (strength && strength.length === b.length) { let best = -1; for (let k = 0; k < Math.min(4, b.length); k++) { let s = 0; for (let i = k; i < b.length; i += 4) s += strength[i]; if (s > best) { best = s; ph = k; } } }
  return b.filter((_, i) => i >= ph && (i - ph) % 4 === 0);
}
/** is a moment inside a word? (a cut there would clip it) */
export const inWord = (t: number, words: Word[], pad = 0.02) => words.some((w) => t > w.s + pad && t < w.e - pad);
/** the last grid line in [lo, hi] that isn't inside a word (null when none) */
export function safeBeat(grid: number[], lo: number, hi: number, words: Word[] = []): number | null {
  for (let i = grid.length - 1; i >= 0; i--) { const b = grid[i]; if (b < lo - 1e-6 || b > hi + 1e-6) continue; if (!inWord(b, words)) return b; }
  return null;
}

// ---- loudness (ITU-R BS.1770: K-weighting, 400 ms blocks, gated) and the sample peak
function kFilters(rate: number) {
  // the shelf and the high-pass of BS.1770, worked out for any sample rate (the 48 kHz values come out as the standard's)
  const shelf = (() => { const f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196, K = Math.tan((Math.PI * f0) / rate), Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
    const a0 = 1 + K / Q + K * K; return { b: [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0], a: [(2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0] }; })();
  const hp = (() => { const f0 = 38.13547087602444, Q = 0.5003270373238773, K = Math.tan((Math.PI * f0) / rate), a0 = 1 + K / Q + K * K; return { b: [1, -2, 1], a: [(2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0] }; })();
  return [shelf, hp];
}
function biquad(x: Float32Array, f: { b: number[]; a: number[] }): Float32Array {
  const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = f.b[0] * x[i] + f.b[1] * x1 + f.b[2] * x2 - f.a[0] * y1 - f.a[1] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
/** the integrated loudness in LUFS of one or more channels (−70 when silent) */
export function lufs(channels: Float32Array[], rate: number): number {
  const [sh, hp] = kFilters(rate); const K = channels.map((c) => biquad(biquad(c, sh), hp)); const n = K[0]?.length || 0;
  const blk = Math.round(rate * 0.4), hop = Math.round(rate * 0.1); const z: number[] = [];
  for (let i = 0; i + blk <= n; i += hop) { let s = 0; for (const c of K) { let q = 0; for (let j = i; j < i + blk; j++) q += c[j] * c[j]; s += q / blk; } z.push(s); }
  if (!z.length) { let s = 0; for (const c of K) { let q = 0; for (let j = 0; j < n; j++) q += c[j] * c[j]; s += q / Math.max(1, n); } z.push(s); }
  const L = (v: number) => -0.691 + 10 * Math.log10(Math.max(v, 1e-12));
  const abs = z.filter((v) => L(v) > -70); if (!abs.length) return -70;
  const rel = L(abs.reduce((s, v) => s + v, 0) / abs.length) - 10; const g = abs.filter((v) => L(v) > rel);
  return Math.round(L(g.reduce((s, v) => s + v, 0) / Math.max(1, g.length)) * 10) / 10;
}
export const peakDb = (channels: Float32Array[]) => { let m = 0; for (const c of channels) for (let i = 0; i < c.length; i++) { const v = Math.abs(c[i]); if (v > m) m = v; } return m > 0 ? Math.round(20 * Math.log10(m) * 10) / 10 : -120; };
/** the gain (as a factor) that brings a mix to `target` LUFS without the peak going over `ceiling` dB */
export function loudGain(measured: number, peak: number, target = -14, ceiling = -1): number {
  if (measured <= -69) return 1; const want = target - measured, room = ceiling - peak; return Math.round(Math.pow(10, Math.min(want, room) / 20) * 1000) / 1000;
}

// ---- the platforms, and checking an edit before posting
export interface Platform { id: string; name: string; nameAr: string; aspect: string; w: number; h: number; maxSec: number; minSec?: number; fps: number[]; lufs: number;
  safe: { top: number; bottom: number; left: number; right: number } }   // shares of the frame the platform's buttons and words cover
export const PLATFORMS: Platform[] = [
  { id: "tiktok", name: "TikTok", nameAr: "تيك توك", aspect: "9:16", w: 1080, h: 1920, maxSec: 600, minSec: 3, fps: [24, 25, 30, 60], lufs: -14, safe: { top: 0.1, bottom: 0.22, left: 0.05, right: 0.14 } },
  { id: "reels", name: "Instagram Reels", nameAr: "ريلز إنستغرام", aspect: "9:16", w: 1080, h: 1920, maxSec: 180, minSec: 3, fps: [24, 25, 30, 60], lufs: -14, safe: { top: 0.08, bottom: 0.2, left: 0.05, right: 0.12 } },
  { id: "shorts", name: "YouTube Shorts", nameAr: "يوتيوب شورتس", aspect: "9:16", w: 1080, h: 1920, maxSec: 180, fps: [24, 25, 30, 60], lufs: -14, safe: { top: 0.06, bottom: 0.18, left: 0.05, right: 0.12 } },
  { id: "youtube", name: "YouTube", nameAr: "يوتيوب", aspect: "16:9", w: 1920, h: 1080, maxSec: 43200, fps: [24, 25, 30, 50, 60], lufs: -14, safe: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 } },
  { id: "x", name: "X", nameAr: "إكس", aspect: "16:9", w: 1280, h: 720, maxSec: 140, fps: [24, 25, 30, 60], lufs: -14, safe: { top: 0.05, bottom: 0.08, left: 0.05, right: 0.05 } },
  { id: "linkedin", name: "LinkedIn", nameAr: "لينكدإن", aspect: "1:1", w: 1080, h: 1080, maxSec: 600, minSec: 3, fps: [24, 25, 30], lufs: -14, safe: { top: 0.05, bottom: 0.1, left: 0.05, right: 0.05 } },
  { id: "facebook", name: "Facebook", nameAr: "فيسبوك", aspect: "4:5", w: 1080, h: 1350, maxSec: 14400, fps: [24, 25, 30, 60], lufs: -14, safe: { top: 0.06, bottom: 0.14, left: 0.05, right: 0.05 } },
  { id: "podcast", name: "Podcast", nameAr: "بودكاست", aspect: "16:9", w: 1920, h: 1080, maxSec: 43200, fps: [24, 25, 30], lufs: -16, safe: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 } },
  { id: "broadcast", name: "TV (EBU R128)", nameAr: "تلفزيون (EBU R128)", aspect: "16:9", w: 1920, h: 1080, maxSec: 43200, fps: [25, 50], lufs: -23, safe: { top: 0.1, bottom: 0.1, left: 0.1, right: 0.1 } },
];
export interface Issue { level: "bad" | "warn" | "ok"; code: string; n?: number | string; clip?: Id }
const ratio = (a: string) => { const [x, y] = a.split(":").map(Number); return x / y; };
/** what would go wrong on a platform: the shape, the length, the frame rate, words under the platform's buttons, a silent or too-loud mix */
export function checkProject(p: Project, pl: Platform, o: { fps?: number; lufs?: number | null; peak?: number | null } = {}): Issue[] {
  const out: Issue[] = []; const d = T.duration(p);
  if (Math.abs(p.width / p.height - ratio(pl.aspect)) > 0.02) out.push({ level: "bad", code: "aspect", n: pl.aspect });
  if (d > pl.maxSec + 0.05) out.push({ level: "bad", code: "long", n: pl.maxSec });
  if (pl.minSec && d < pl.minSec) out.push({ level: "warn", code: "short", n: pl.minSec });
  const fps = o.fps ?? p.export?.fps ?? p.fps; if (fps && !pl.fps.includes(fps)) out.push({ level: "warn", code: "fps", n: pl.fps.join("/") });
  const s = pl.safe;
  for (const tr of p.tracks) { if (tr.hidden) continue; for (const c of tr.clips) {
    if (c.type !== "text") continue; const tc = c as TextClip; if (tc.motion && !tc.text.trim()) continue;
    const half = Math.max(0.02, (tc.style?.size || 0.06) * 0.6 * (tc.transform?.scale || 1)); const cx = 0.5 + (tc.transform?.x || 0), cy = 0.5 + (tc.transform?.y || 0);
    if (cy - half < s.top || cy + half > 1 - s.bottom || cx < s.left + 0.02 || cx > 1 - s.right - 0.02) out.push({ level: "warn", code: "unsafe", n: (tc.text || tc.name || "").slice(0, 40), clip: c.id });
  } }
  if (o.lufs != null) {
    if (o.lufs <= -60) out.push({ level: "warn", code: "silent" });
    else if (Math.abs(o.lufs - pl.lufs) > 2) out.push({ level: "warn", code: "loud", n: o.lufs });
    if (o.peak != null && o.peak > -1) out.push({ level: "warn", code: "peak", n: o.peak });
  }
  if (!out.length) out.push({ level: "ok", code: "ok" });
  return out;
}
