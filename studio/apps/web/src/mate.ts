// Nooi Mate: plain words (English or Arabic) → action cards the person confirms with one tap. Read here, on the device: no AI
// call, no credits. What it does not understand it says, with examples (the AI version through the site comes in Step 5).
import * as C from "@nooi/editor-core";
import type { MediaClip } from "@nooi/editor-core";
import * as A from "./actions";
import { editor, playerRef, ui } from "./state";
import { decodeSound, fileOf, monoOf } from "./media/library";

export interface Card { title: string; detail?: string; run: () => void | Promise<void> }
const num = (s: string, d: number) => { const m = /(\d+(?:[.,]\d+)?)/.exec(s); return m ? +m[1].replace(",", ".") : d; };
const has = (s: string, ...w: string[]) => w.some((x) => s.includes(x));
const nm = (list: { id: string; en: string; ar: string }[], id: string) => { const x = list.find((y) => y.id === id); return x ? (ui.get().lang === "ar" ? x.ar : x.en) : id; };

// the quiet parts of the picked clip (or the main track's clips) longer than `min` seconds, as timeline ranges
export async function quietRanges(min: number): Promise<[number, number][]> {
  const p = editor.project; const sel = A.selected().filter((c) => c.type === "media") as MediaClip[];
  const clips = sel.length ? sel : ((p.tracks.filter((t) => t.kind === "video").slice(-1)[0]?.clips || []).filter((c) => c.type === "media") as MediaClip[]);
  const out: [number, number][] = [];
  for (const c of clips) {
    const a = p.assets[c.asset]; if (!a || a.kind === "image") continue; const b = await fileOf(a); const ab = b && (await decodeSound(b)); if (!ab) continue;
    const spans = C.loudSpans(monoOf(ab), ab.sampleRate, { minSilence: min, pad: 0.05 }); const s0 = c.in, s1 = c.in + c.dur * c.speed;
    let prev = s0; const gaps: [number, number][] = [];
    for (const [x, y] of spans) { if (y <= s0 || x >= s1) continue; if (x - prev >= min) gaps.push([prev, x]); prev = Math.max(prev, y); }
    if (s1 - prev >= min) gaps.push([prev, s1]);
    for (const [x, y] of gaps) out.push([c.start + (x - c.in) / c.speed, c.start + (y - c.in) / c.speed]);
  }
  return out.sort((a, b) => b[0] - a[0]);   // from the end, so earlier ranges keep their place
}

export function understand(text: string, t: (k: string, o?: Record<string, unknown>) => string): Card[] {
  const s = text.toLowerCase().trim(); const cards: Card[] = []; if (!s) return cards;
  if (has(s, "pause", "silence", "dead air", "صمت", "الصمت", "سكوت", "توقف")) {
    const min = num(s, 0.4);
    cards.push({ title: t("mate.pauses", { s: min }), run: async () => { const r = await quietRanges(min); if (!r.length) return; A.run("remove pauses", (p) => { for (const [x, y] of r) C.cutRange(p, x, y); }); } });
  }
  if (has(s, "split", "cut here", "قص", "اقطع")) cards.push({ title: t("mate.split"), run: A.split });
  if (has(s, "teal", "orange", "تيل", "برتقالي")) cards.push({ title: t("mate.look", { name: nm(C.LOOKS, "teal") }), run: () => A.applyLook("teal") });
  if (has(s, "warm", "دافئ")) cards.push({ title: t("mate.look", { name: nm(C.LOOKS, "warm") }), run: () => A.applyLook("warm") });
  if (has(s, "black and white", "b&w", "mono", "أبيض وأسود", "ابيض واسود")) cards.push({ title: t("mate.fx", { name: nm(C.EFFECTS, "mono") }), run: () => A.applyEffect("mono") });
  for (const [k, w] of [["rain", ["rain", "مطر"]], ["snow", ["snow", "ثلج"]], ["fog", ["fog", "ضباب"]], ["leak", ["light leak", "تسرب"]], ["sparkle", ["sparkle", "بريق"]]] as [string, string[]][])
    if (has(s, ...w)) cards.push({ title: t("mate.fx", { name: nm(C.EFFECTS, k) }), run: () => A.applyEffect(k) });
  if (has(s, "zoom in", "تقريب")) cards.push({ title: t("mate.motion", { name: nm(C.MOTIONS, "zoomIn") }), run: () => A.applyMotion("zoomIn") });
  if (has(s, "zoom out", "إبعاد", "ابعاد")) cards.push({ title: t("mate.motion", { name: nm(C.MOTIONS, "zoomOut") }), run: () => A.applyMotion("zoomOut") });
  if (has(s, "shake", "اهتزاز")) cards.push({ title: t("mate.motion", { name: nm(C.MOTIONS, "shake") }), run: () => A.applyMotion("shake") });
  if (has(s, "fade in", "ظهور تدريجي")) cards.push({ title: t("mate.fadeIn"), run: () => A.setProp("fadeIn", 0.6) });
  if (has(s, "fade out", "اختفاء تدريجي")) cards.push({ title: t("mate.fadeOut"), run: () => A.setProp("fadeOut", 0.6) });
  if (has(s, "speed", "faster", "slower", "slow motion", "سرعة", "أسرع", "أبطأ", "بطيء")) {
    const v = has(s, "slow", "أبطأ", "بطيء") && !/\d/.test(s) ? 0.5 : Math.max(0.1, Math.min(10, num(s, 2)));
    cards.push({ title: t("mate.speed", { v }), run: () => A.speed(v) });
  }
  if (has(s, "vertical", "9:16", "tiktok", "reels", "shorts", "عمودي")) cards.push({ title: t("mate.format", { f: "9:16" }), run: () => A.format("9:16") });
  if (has(s, "horizontal", "16:9", "youtube", "أفقي")) cards.push({ title: t("mate.format", { f: "16:9" }), run: () => A.format("16:9") });
  if (has(s, "square", "1:1", "مربع")) cards.push({ title: t("mate.format", { f: "1:1" }), run: () => A.format("1:1") });
  const title = /(?:title|text|عنوان|نص)\s*[:"“«]?\s*(.+?)["”»]?$/i.exec(text.trim());
  if (title && title[1].length > 1) cards.push({ title: t("mate.addTitle", { text: title[1].slice(0, 60) }), run: () => { A.addText("title", title[1].slice(0, 120)); } });
  if (has(s, "delete", "remove clip", "احذف", "حذف")) cards.push({ title: t("mate.delete"), run: () => A.del(false) });
  if (has(s, "undo", "تراجع")) cards.push({ title: t("act.undo"), run: A.undo });
  const find = /(?:find|search|ابحث عن|ابحث)\s+(.+)/i.exec(text.trim());
  if (find) { const q = find[1].toLowerCase(); const hits = Object.values(editor.project.assets).filter((a) => a.name.toLowerCase().includes(q));
    cards.push({ title: t("mate.found", { n: hits.length, q: find[1] }), run: () => { ui.set({ rail: "media", panelOpen: true }); if (hits[0] && hits[0].kind !== "lut") A.addAsset(hits[0], playerRef.current?.clock.t); } }); }
  return cards;
}
