// nooi Motion templates, eighth set (v247): "Video scenes" — the classic editor's v206 motion scenes, made after the owner's
// reference videos: the 20 named effects (Orbit, Chat Takeover, Frame Escape, Snap Zoom … Phone Mockup, Checklist), the picture
// showcases (Totem Wall, Spread Rows, Iso Cascade, Wheel Carousel, Cascade Deck) and the reference motions (Kinetic promo, Vlog kit,
// App burst). Each keeps its words, list, number, colour and picture slots (your own pictures from the media library), and plays on
// its glowing background or over your video. The drawing is the classic editor's own (motion/scenes206.js).
import { AR, BG, T, type Field, type MCtx, type Template } from "./kit";
import { drawScene206, setLang206 } from "./scenes206";

type Row = [id: string, en: string, ar: string, dur: number, f: { t1?: [string, string]; t2?: [string, string] | true; items?: [string, string]; val?: number; pics?: number; bg?: "none"; itemsLabel?: [string, string]; t2Label?: [string, string] }];
const P = (n: number) => ({ pics: n });
const ROWS: Row[] = [
  ["orbit", "Orbit", "مدار", 5, { t1: ["nooi", "nooi"], items: ["", ""], ...P(8) }],
  ["chat", "Chat Takeover", "سيطرة المحادثة", 5, { t1: ["Everyone is talking", "الكل يتحدث"], items: ["Did you see it? | Wait… what? | This changes everything | Send it to me!", "شفته؟ | لحظة… ماذا؟ | هذا يغيّر كل شيء | أرسله لي!"], itemsLabel: ["Messages (| between)", "الرسائل (| بينها)"] }],
  ["frameEscape", "Frame Escape", "الهروب من الإطار", 4, { t1: ["", ""], ...P(1) }],
  ["snapZoom", "Snap Zoom", "تقريب خاطف", 3, { t1: ["Fast. Bold. Yours.", "سريع. جريء. لك."], t2: true, items: ["", ""], t2Label: ["More words", "كلمات أخرى"] }],
  ["checklistPop", "Checklist Pop", "قائمة منبثقة", 4, { t1: ["", ""], items: ["Plan | Shoot | Edit | Post", "خطّط | صوّر | حرّر | انشر"] }],
  ["headlineStorm", "Headline Storm", "عاصفة العناوين", 4, { t1: ["Out now", "متوفر الآن"], items: ["", ""], itemsLabel: ["Headlines (| between)", "العناوين (| بينها)"] }],
  ["zoomPortal", "Zoom Portal", "بوابة التقريب", 4, { t1: ["Step inside", "ادخل"], t2: ["A new world", "عالم جديد"], ...P(2), bg: "none" }],
  ["growthCurve", "Growth Curve", "منحنى النمو", 4, { t1: ["Monthly growth", "النمو الشهري"], t2: ["", ""], val: 250, t2Label: ["Before the number (e.g. $)", "قبل الرقم (مثل $)"] }],
  ["studioReveal", "Studio Reveal", "كشف الاستوديو", 4, { t1: ["nooi", "nooi"], t2: ["Made with AI", "صُنع بالذكاء الاصطناعي"], ...P(1) }],
  ["broll", "B-roll Overlay", "لقطات فوق الفيديو", 4, { items: ["Fresh | Local | Daily", "طازج | محلي | يومي"], ...P(3), bg: "none", itemsLabel: ["Captions (| between)", "التعليقات (| بينها)"] }],
  ["paperCut", "Paper Cutout", "قصاصات ورق", 4, { t1: ["Once upon a time", "كان يا ما كان"] }],
  ["dollyZoom", "Dolly Zoom", "دولي زووم", 3, { t1: ["", ""], ...P(1), bg: "none" }],
  ["magazine", "Magazine Cover", "غلاف مجلة", 4, { t1: ["NOOI", "NOOI"], t2: ["Issue 01 · 2026", "العدد 01 · 2026"], items: ["", ""], ...P(1), itemsLabel: ["Cover lines (| between)", "سطور الغلاف (| بينها)"] }],
  ["liquidGlass", "Liquid Glass", "زجاج سائل", 4, { t1: ["Clear as glass", "صافٍ كالزجاج"], t2: ["Design that flows", "تصميم ينساب"] }],
  ["zoomThrough", "Zoom Through Cut", "قطع بالتقريب", 4, { t2: ["", ""], items: ["Think | Create | Share", "فكّر | اصنع | شارك"] }],
  ["greenScreen", "Green Screen", "الشاشة الخضراء", 5, { t1: ["EDITED", "معدّل"], t2: ["@nooi", "@nooi"], ...P(1), bg: "none", t2Label: ["Handle (e.g. @you)", "اسم الحساب (مثل @you)"] }],
  ["frameBreak", "Frame Break", "كسر الإطار", 4, { t1: ["Break the rules", "اكسر القواعد"], ...P(1) }],
  ["digitalZoom", "Digital Zoom", "تقريب رقمي", 4, { t1: ["", ""], ...P(1), bg: "none" }],
  ["phoneMockup", "Phone Mockup", "نموذج هاتف", 4, { t1: ["Try it today", "جرّبه اليوم"], t2: ["nooi.ai", "nooi.ai"], ...P(1) }],
  ["checklist", "Checklist", "قائمة المهام", 5, { t1: ["Today", "اليوم"], items: ["", ""] }],
  ["totem", "Totem Wall", "جدار الأعمدة", 5, P(12)],
  ["spread", "Spread Rows", "صفوف منتشرة", 5, P(12)],
  ["iso", "Iso Cascade", "شلال متساوي القياس", 5, P(12)],
  ["wheel", "Wheel Carousel", "عجلة دوّارة", 6, P(10)],
  ["deck", "Cascade Deck", "مجموعة متتالية", 5, { t1: ["", ""], ...P(8) }],
  ["promo", "Kinetic promo", "إعلان حركي", 6, { t1: ["A cat surfing a giant wave", "قطة تركب موجة عملاقة"], t2: ["What will you create?", "ماذا ستصنع؟"], ...P(4), t2Label: ["Above the box", "فوق المربع"] }],
  ["vlog", "Vlog kit", "عدة الفلوق", 6, { t1: ["The best coffee in town", "أفضل قهوة في المدينة"], t2: ["@nooi", "@nooi"], ...P(1), bg: "none", t2Label: ["Handle (e.g. @you)", "اسم الحساب (مثل @you)"] }],
  ["appburst", "App burst", "انفجار التطبيقات", 4, { t1: ["nooi", "nooi"], t2: ["Everything in one app", "كل شيء في تطبيق واحد"], items: ["Video | Image | Voice | Music | 3D | Edit | Agents | Story | Ads | Live", "فيديو | صورة | صوت | موسيقى | ثلاثي | تحرير | وكلاء | قصة | إعلانات | مباشر"], itemsLabel: ["App names (| between)", "أسماء التطبيقات (| بينها)"] }],
];
export const SCENE_IDS = ROWS.map((r) => "sc-" + r[0]);
const fieldsOf = (f: Row[4]): Field[] => {
  const out: Field[] = [];
  if (f.t1) out.push(T("t1", "text", "Words", "الكلمات", f.t1));
  if (f.t2) out.push(T("t2", "text", (f.t2Label || ["Second line", "السطر الثاني"])[0], (f.t2Label || ["Second line", "السطر الثاني"])[1], f.t2 === true ? ["", ""] : f.t2));
  if (f.items) out.push(T("items", "text", (f.itemsLabel || ["List (| between)", "القائمة (| بينها)"])[0], (f.itemsLabel || ["List (| between)", "القائمة (| بينها)"])[1], f.items));
  if (f.val != null) out.push(T("val", "number", "Number", "الرقم", f.val, { min: 0, max: 100000, step: 1 }));
  if (f.pics) out.push(T("pics", "pics", `Pictures (up to ${f.pics})`, `الصور (حتى ${f.pics})`, null, { max: f.pics }));
  out.push(BG({ def: "#c1ff72" }));
  out.push(T("bg", "select", "Background", "الخلفية", f.bg === "none" ? "none" : "glow", { options: [["glow", "Glowing", "متوهّجة"], ["none", "Over the video", "فوق الفيديو"]] }));
  return out;
};
const lang = (m: MCtx) => (AR.test([m.p.t1, m.p.t2, m.p.items].join(" ")) ? "ar" : "en");
export const SCENES: Template[] = ROWS.map(([id, en, ar, dur, f]) => ({ id: "sc-" + id, en, ar, group: "scenes" as const, dur, fields: fieldsOf(f),
  draw(m: MCtx) { setLang206(lang(m)); const it = { t1: m.p.t1 || "", t2: m.p.t2 || "", items: String(m.p.items || ""), val: m.p.val ?? null, pics: Array.isArray(m.p.pics) ? m.p.pics : [] };
    drawScene206(m.ctx, id, m.W, m.H, m.t, m.dur, String(m.p.accent || "#c1ff72"), it, m.p.bg !== "none"); } }));
