// (v245) A long video → shorts: the moments worth posting on their own, found from the words said. A moment is 20–60 s of whole
// phrases; it scores for a hook in its first words (a question, a number, "how", "why", "the secret", "لماذا", "كيف", "سر"…), for
// finished sentences, for steady talk (words a second, few long pauses) and for few fillers. The best ones that don't overlap are
// suggested; each can become its own 9:16 edit with captions. Our own scoring.
import { FILLERS, norm, phrases, type Word } from "./cutting";

export interface Moment { a: number; b: number; score: number; title: string; why: string[] }
const HOOK = ["how", "why", "what", "secret", "mistake", "never", "always", "best", "worst", "top", "stop", "you", "imagine", "truth", "nobody", "here's", "this",
  "كيف", "لماذا", "ليش", "ماذا", "سر", "أسرار", "خطأ", "أخطاء", "أبدا", "دائما", "أفضل", "أسوأ", "توقف", "تخيل", "الحقيقة", "لا أحد", "هل", "انتبه"].map(norm);
const FILL = new Set(FILLERS.hard.map(norm));
/** the best moments (up to `n`, not overlapping), best first */
export function findMoments(words: Word[], o: { min?: number; max?: number; n?: number } = {}): Moment[] {
  const min = o.min ?? 20, max = o.max ?? 60, n = o.n ?? 3; const ws = [...words].filter((w) => w.e > w.s).sort((a, b) => a.s - b.s); if (!ws.length) return [];
  const ph = phrases(ws, 0.45); const out: Moment[] = [];
  for (let i = 0; i < ph.length; i++) {
    for (let j = i; j < ph.length; j++) {
      const a = Math.max(0, ph[i].s - 0.15), b = ph[j].e + 0.25, len = b - a; if (len > max) break; if (len < min) continue;
      const inside = ws.slice(ph[i].i0, ph[j].i1 + 1), first = ph[i].text.split(/\s+/).slice(0, 8).map(norm), why: string[] = [];
      let s = 0; const hook = first.some((w) => HOOK.includes(w)) || /[?؟]/.test(ph[i].text) || /\d/.test(ph[i].text); if (hook) { s += 3; why.push("hook"); }
      if (/[.!?؟…]$/.test(ph[j].text.trim())) { s += 1.5; why.push("ends"); }
      const wps = inside.length / len; s += Math.min(2, wps / 1.4); if (wps > 2) why.push("pace");
      let gaps = 0; for (let k = 1; k < inside.length; k++) if (inside[k].s - inside[k - 1].e > 1.2) gaps++; s -= gaps * 0.6;
      const fill = inside.filter((w) => FILL.has(norm(w.w))).length; s -= fill * 0.3; if (!fill && !gaps) why.push("clean");
      s -= Math.abs(len - 35) / 40;   // around 35 s plays best
      out.push({ a: Math.round(a * 100) / 100, b: Math.round(b * 100) / 100, score: Math.round(s * 100) / 100, title: ph[i].text.slice(0, 70), why });
    }
  }
  out.sort((x, y) => y.score - x.score); const pick: Moment[] = [];
  for (const m of out) { if (pick.length >= n) break; if (pick.length && m.score < pick[0].score * 0.6) break; if (pick.some((q) => m.a < q.b && m.b > q.a)) continue; pick.push(m); }   // the weak ones left out
  return pick;
}
/** the words as caption lines (a few words each, never across a long pause) */
export function captionLines(words: Word[], maxWords = 5, maxSec = 2.6): { s: number; e: number; text: string }[] {
  const out: { s: number; e: number; text: string }[] = []; let cur: Word[] = [];
  const flush = () => { if (cur.length) out.push({ s: cur[0].s, e: cur[cur.length - 1].e, text: cur.map((w) => w.w).join(" ") }); cur = []; };
  const endsAt = (i: number) => { let j = i; while (j < words.length - 1 && !/[.!?؟]$/.test(words[j].w) && words[j + 1].s - words[j].e <= 0.6) j++; return j; };
  for (let i = 0; i < words.length; i++) { const w = words[i], last = cur[cur.length - 1], tail = endsAt(i) - i + 1;   // a line never leaves one or two words of a sentence alone
    if (cur.length && ((cur.length >= maxWords && !(tail <= 2 && cur.length < maxWords + 2)) || w.e - cur[0].s > maxSec + (tail <= 2 ? 0.8 : 0) || w.s - last.e > 0.6 || /[.!?؟,،]$/.test(last.w))) flush(); cur.push(w); }
  flush(); return out;
}
