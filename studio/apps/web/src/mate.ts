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

// v285: the agents take several steps in one sentence ("split here, then add rain and a warm look") — each step read on its own
type T = (k: string, o?: Record<string, unknown>) => string;
export function steps285(text: string): string[] {
  const keep: string[] = [];   // quoted words and "black and white" stay whole
  let x = text.replace(/(?:title|text|عنوان|نص)\s*[:]?\s*(["“«][^"”»]+["”»])/gi, (m) => { keep.push(m); return "\u0001" + (keep.length - 1) + "\u0001"; })
    .replace(/black and white|b&w|أبيض وأسود|ابيض واسود/gi, (m) => { keep.push(m); return "\u0001" + (keep.length - 1) + "\u0001"; });
  const back = (y: string) => y.replace(/\u0001(\d+)\u0001/g, (_m, i) => keep[+i]);
  return x.split(/\s*(?:[,;،؛\n]+|\.\s+|\band then\b|\bthen\b|\band\b|\bثم\b|\s+و(?=\S))\s*/i).map((y) => back(y).trim()).filter((y) => y.length > 1);
}
// the clip a command acts on: the picked one, else the main-track clip under the playhead (it becomes picked)
export function pick285(): boolean {
  if (editor.selection.length) return true;
  const p = editor.project, t0 = A.now();
  for (const tr of [...p.tracks].reverse()) for (const c of tr.clips) if (t0 >= c.start && t0 < c.start + c.dur) { editor.select([c.id]); return true; }
  return false;
}
const need = (f: () => unknown) => () => { pick285(); return f() as void; };
export function understand(text: string, t: T): Card[] {
  const out: Card[] = [], seen = new Set<string>();
  const parts = steps285(text); for (const part of parts.length ? parts : [text]) for (const c of understandOne(part, t)) if (!seen.has(c.title)) { seen.add(c.title); out.push(c); }
  return out;
}
// the catalogue by name — any effect, colour look, transition or motion the editor has, in English or Arabic
function byName(s: string, list: { id: string; en: string; ar: string }[]): { id: string; en: string; ar: string } | null {
  let best: { id: string; en: string; ar: string } | null = null, len = 0;
  for (const x of list) for (const n of [x.en.toLowerCase(), x.ar]) if (n.length >= 3 && n.length > len && s.includes(n)) { best = x; len = n.length; }
  return best;
}
function understandOne(text: string, t: T): Card[] {
  const s = text.toLowerCase().trim(); const cards: Card[] = []; if (!s) return cards;
  if (has(s, "pause", "silence", "dead air", "صمت", "الصمت", "سكوت", "توقف")) {
    const min = num(s, 0.4);
    cards.push({ title: t("mate.pauses", { s: min }), run: async () => { const r = await quietRanges(min); if (!r.length) return; A.run("remove pauses", (p) => { for (const [x, y] of r) C.cutRange(p, x, y); }); } });
  }
  if (has(s, "split", "cut here", "قص", "اقطع") && !has(s, "split screen", "شاشة مقسومة", "تقسيم الشاشة")) cards.push({ title: t("mate.split"), run: need(A.split) });
  if (has(s, "teal", "orange", "تيل", "برتقالي")) cards.push({ title: t("mate.look", { name: nm(C.LOOKS, "teal") }), run: need(() => A.applyLook("teal")) });
  if (has(s, "warm", "دافئ")) cards.push({ title: t("mate.look", { name: nm(C.LOOKS, "warm") }), run: need(() => A.applyLook("warm")) });
  if (has(s, "black and white", "b&w", "mono", "أبيض وأسود", "ابيض واسود")) cards.push({ title: t("mate.fx", { name: nm(C.EFFECTS, "mono") }), run: need(() => A.applyEffect("mono")) });
  for (const [k, w] of [["rain", ["rain", "مطر"]], ["snow", ["snow", "ثلج"]], ["fog", ["fog", "ضباب"]], ["leak", ["light leak", "تسرب"]], ["sparkle", ["sparkle", "بريق"]]] as [string, string[]][])
    if (has(s, ...w)) cards.push({ title: t("mate.fx", { name: nm(C.EFFECTS, k) }), run: need(() => A.applyEffect(k)) });
  if (has(s, "zoom in", "تقريب")) cards.push({ title: t("mate.motion", { name: nm(C.MOTIONS, "zoomIn") }), run: need(() => A.applyMotion("zoomIn")) });
  if (has(s, "zoom out", "إبعاد", "ابعاد")) cards.push({ title: t("mate.motion", { name: nm(C.MOTIONS, "zoomOut") }), run: need(() => A.applyMotion("zoomOut")) });
  if (has(s, "shake", "اهتزاز")) cards.push({ title: t("mate.motion", { name: nm(C.MOTIONS, "shake") }), run: need(() => A.applyMotion("shake")) });
  if (has(s, "fade in", "ظهور تدريجي")) cards.push({ title: t("mate.fadeIn"), run: need(() => A.setProp("fadeIn", 0.6)) });
  if (has(s, "fade out", "اختفاء تدريجي")) cards.push({ title: t("mate.fadeOut"), run: need(() => A.setProp("fadeOut", 0.6)) });
  if (has(s, "speed", "faster", "slower", "slow motion", "slow-mo", "slowmo", "سرعة", "أسرع", "اسرع", "أبطأ", "ابطأ", "بطيء", "بطيئ", "سلو موشن")) {
    const v = has(s, "slow", "أبطأ", "ابطأ", "بطيء", "بطيئ", "سلو") && !/\d/.test(s) ? 0.5 : Math.max(0.1, Math.min(10, num(s, 2)));
    cards.push({ title: t("mate.speed", { v }), run: need(() => A.speed(v)) });
  }
  if (has(s, "vertical", "9:16", "tiktok", "reels", "shorts", "عمودي")) cards.push({ title: t("mate.format", { f: "9:16" }), run: () => A.format("9:16") });
  if (has(s, "horizontal", "16:9", "youtube", "أفقي")) cards.push({ title: t("mate.format", { f: "16:9" }), run: () => A.format("16:9") });
  if (has(s, "square", "1:1", "مربع")) cards.push({ title: t("mate.format", { f: "1:1" }), run: () => A.format("1:1") });
  const title = /(?:title|text|عنوان|نص)\s*[:"“«]?\s*(.+?)["”»]?$/i.exec(text.trim());
  if (title && title[1].length > 1) cards.push({ title: t("mate.addTitle", { text: title[1].slice(0, 60) }), run: () => { A.addText("title", title[1].slice(0, 120)); } });
  if (has(s, "delete", "remove clip", "احذف", "حذف")) cards.push({ title: t("mate.delete"), run: need(() => A.del(false)) });
  if (has(s, "undo", "تراجع")) cards.push({ title: t("act.undo"), run: A.undo });
  const find = /(?:find|search|ابحث عن|ابحث)\s+(.+)/i.exec(text.trim());
  if (find) { const q = find[1].toLowerCase(); const hits = Object.values(editor.project.assets).filter((a) => a.name.toLowerCase().includes(q));
    cards.push({ title: t("mate.found", { n: hits.length, q: find[1] }), run: () => { ui.set({ rail: "media", panelOpen: true }); if (hits[0] && hits[0].kind !== "lut") A.addAsset(hits[0], playerRef.current?.clock.t); } }); }
  if (!cards.length || /look|effect|transition|motion|لون|مؤثر|انتقال|حركة|فلتر|filter/.test(s)) {
    const lk = byName(s, C.LOOKS); if (lk && !cards.some((c) => c.title.includes(nm(C.LOOKS, lk.id)))) cards.push({ title: t("mate.look", { name: nm(C.LOOKS, lk.id) }), run: need(() => A.applyLook(lk.id)) });
    const fx = byName(s, C.EFFECTS); if (fx && !cards.some((c) => c.title.includes(nm(C.EFFECTS, fx.id)))) cards.push({ title: t("mate.fx", { name: nm(C.EFFECTS, fx.id) }), run: need(() => A.applyEffect(fx.id)) });
    const tr = byName(s, C.TRANSITIONS); if (tr && has(s, "transition", "انتقال", tr.en.toLowerCase(), tr.ar)) cards.push({ title: t("mate.trans", { name: nm(C.TRANSITIONS, tr.id) }), run: need(() => A.applyTransition(tr.id)) });
    const mo = byName(s, C.MOTIONS); if (mo && !cards.some((c) => c.title.includes(nm(C.MOTIONS, mo.id)))) cards.push({ title: t("mate.motion", { name: nm(C.MOTIONS, mo.id) }), run: need(() => A.applyMotion(mo.id)) });
  }
  if (has(s, "duplicate", "copy clip", "كرر", "تكرار", "نسخ")) cards.push({ title: t("mate.dup"), run: need(A.duplicate) });
  if (has(s, "reverse", "backwards", "عكس", "اعكس")) cards.push({ title: t("mate.rev"), run: need(A.reverse) });
  if (has(s, "freeze", "تجميد", "جمد", "ثبت اللقطة")) cards.push({ title: t("mate.freeze"), run: need(A.freeze) });
  if (has(s, "unmute", "sound on", "شغل الصوت", "ارجع الصوت")) cards.push({ title: t("mate.unmute"), run: need(() => A.setProp("muted", false)) });
  else if (has(s, "mute", "no sound", "silent", "اكتم", "كتم", "بدون صوت")) cards.push({ title: t("mate.mute"), run: need(() => A.setProp("muted", true)) });
  if (has(s, "louder", "volume up", "ارفع الصوت", "أعلى صوت")) cards.push({ title: t("mate.vol", { v: 150 }), run: need(() => A.setProp("volume", 1.5)) });
  if (has(s, "quieter", "volume down", "lower the volume", "اخفض الصوت", "خفض الصوت")) cards.push({ title: t("mate.vol", { v: 50 }), run: need(() => A.setProp("volume", 0.5)) });
  if (has(s, "clean", "noise", "denoise", "نظف", "تنظيف", "ضوضاء", "ضجيج")) cards.push({ title: t("mate.clean"), run: need(() => A.setProp("denoise", true)) });
  if (has(s, "reset position", "center it", "centre it", "وسط", "إعادة الموضع")) cards.push({ title: t("mate.reset"), run: need(A.resetTransform) });
  if (has(s, "redo", "إعادة", "اعادة")) cards.push({ title: t("act.redo"), run: A.redo });
  if (has(s, "marker", "علامة")) cards.push({ title: t("mate.marker"), run: A.marker });
  if (has(s, "montage", "مونتاج", "جمّع", "اجمع")) cards.push({ title: t("mate.montage"), run: A.instantMontage });
  if (has(s, "split screen", "شاشة مقسومة", "تقسيم الشاشة")) { const n = num(s, 2) >= 4 ? 2 : 1; cards.push({ title: t("mate.grid", { n: n * 2 }), run: () => A.splitScreen(2, n) }); }
  if (has(s, "logo", "شعار")) cards.push({ title: t("mate.logo"), run: () => ui.set({ rail: "titles", panelOpen: true }) });
  if (has(s, "caption", "subtitle", "ترجمة", "كابشن", "نص الكلام")) cards.push({ title: t("mate.caps"), run: () => ui.set({ rail: "titles", panelOpen: true }) });
  if (has(s, "music", "موسيقى", "اغنية", "أغنية")) cards.push({ title: t("mate.music"), run: () => ui.set({ rail: "audio", panelOpen: true }) });
  if (has(s, "export", "download", "صدّر", "صدر", "تصدير", "حمّل الفيديو", "تحميل")) cards.push({ title: t("mate.export"), run: () => ui.set({ exportOpen: true }) });
  return cards;
}

// v285: what the device can't read goes to the site's text AI (the quick tier — no credits), which rewrites it as short commands
// from this list; those are then read here like typed ones, so the AI never runs anything the editor doesn't offer.
export const SAY285 = ["split here", "delete", "duplicate", "reverse", "freeze", "speed 2", "slow motion", "mute", "unmute", "louder", "quieter",
  "clean the voice", "fade in", "fade out", "zoom in", "zoom out", "shake", "reset position", "vertical", "horizontal", "square", "title \"…\"",
  "remove pauses", "add marker", "montage", "split screen 2", "split screen 4", "captions", "music", "logo", "export", "undo", "redo"];
export async function askAI285(text: string, t: T, req: (path: string, o: { json: unknown }) => Promise<unknown>): Promise<Card[]> {
  const names = (l: { en: string }[]) => l.map((x) => x.en).join(", ");
  const prompt = `You run a video editor for a client. Rewrite the client's request as a JSON object {"steps": [..]} of short English commands, in order, each one of:
${SAY285.join(" · ")}
or "look <name>" with a colour look from: ${names(C.LOOKS)}
or "effect <name>" with an effect from: ${names(C.EFFECTS)}
or "transition <name>" from: ${names(C.TRANSITIONS)}
or "motion <name>" from: ${names(C.MOTIONS)}
Use only these. Keep any title words exactly as the client wrote them (any language). At most 8 steps. If nothing fits, {"steps": []}.
Client: ${text.slice(0, 600)}`;
  const r = (await req("/v1/llm/json", { json: { prompt, tier: "quick", task: "editor agents" } })) as { steps?: unknown };
  const list = Array.isArray(r?.steps) ? (r.steps as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 8) : [];
  const out: Card[] = [], seen = new Set<string>();
  for (const st of list) for (const c of understandOne(st, t)) if (!seen.has(c.title)) { seen.add(c.title); out.push(c); }
  return out;
}
