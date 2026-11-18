import type { Clip, Keyframes } from "./schema";
// What the editor offers by name (the drawing lives in the app's compositor). Names in English and Arabic.
export interface Item { id: string; en: string; ar: string; group?: string }

// 34 transitions
export const TRANSITIONS: Item[] = [
  ["fade", "Cross dissolve", "تلاشي متداخل", "basic"], ["black", "Dip to black", "عبور بالأسود", "basic"], ["white", "Dip to white", "عبور بالأبيض", "basic"],
  ["flash", "Flash", "ومضة", "basic"], ["blur", "Blur", "ضبابية", "basic"], ["luma", "Luma fade", "تلاشي الإضاءة", "basic"],
  ["wipeL", "Wipe left", "مسح لليسار", "wipe"], ["wipeR", "Wipe right", "مسح لليمين", "wipe"], ["wipeU", "Wipe up", "مسح للأعلى", "wipe"], ["wipeD", "Wipe down", "مسح للأسفل", "wipe"],
  ["diagTL", "Diagonal wipe", "مسح قطري", "wipe"], ["diagBR", "Diagonal wipe back", "مسح قطري عكسي", "wipe"], ["clock", "Clock wipe", "مسح الساعة", "wipe"], ["radial", "Radial wipe", "مسح دائري", "wipe"],
  ["barnV", "Barn doors", "أبواب", "wipe"], ["barnH", "Barn doors flat", "أبواب أفقية", "wipe"], ["blinds", "Blinds", "ستائر", "wipe"], ["checker", "Checkerboard", "رقعة شطرنج", "wipe"],
  ["slideL", "Slide left", "انزلاق لليسار", "move"], ["slideR", "Slide right", "انزلاق لليمين", "move"], ["slideU", "Slide up", "انزلاق للأعلى", "move"], ["slideD", "Slide down", "انزلاق للأسفل", "move"],
  ["pushL", "Push left", "دفع لليسار", "move"], ["pushR", "Push right", "دفع لليمين", "move"], ["pushU", "Push up", "دفع للأعلى", "move"], ["pushD", "Push down", "دفع للأسفل", "move"],
  ["zoomIn", "Zoom in", "تقريب", "zoom"], ["zoomOut", "Zoom out", "تبعيد", "zoom"], ["spin", "Spin", "دوران", "zoom"], ["circleOpen", "Circle open", "فتح دائري", "shape"],
  ["circleClose", "Circle close", "إغلاق دائري", "shape"], ["diamond", "Diamond", "معيّن", "shape"], ["pixelate", "Pixelate", "بكسلة", "stylized"], ["glitch", "Glitch", "تشويش", "stylized"],
].map(([id, en, ar, group]) => ({ id, en, ar, group }));

// effects on a clip (params: amount 0..1 unless named); the amount a new one starts with
export const EFFECT_AMOUNT: Record<string, number> = { mono: 1, sepia: 1, invert: 1, mirror: 1, blur: 0.4, vignette: 0.6, grain: 0.5, rain: 0.6, snow: 0.6, fog: 0.5, leak: 0.6, sparkle: 0.6, dust: 0.6, blurBox: 1, pixelBox: 1 };
export const effectAmount = (type: string) => EFFECT_AMOUNT[type] ?? 0.5;
export const EFFECTS: Item[] = [
  ["blur", "Blur", "تمويه"], ["sharpen", "Sharpen", "حدة"], ["vignette", "Vignette", "تظليل الأطراف"], ["grain", "Film grain", "حبيبات الفيلم"],
  ["glitch", "Glitch", "تشويش رقمي"], ["rgbSplit", "RGB split", "انفصال الألوان"], ["pixelate", "Pixelate", "بكسلة"], ["mono", "Black & white", "أبيض وأسود"],
  ["sepia", "Sepia", "بني قديم"], ["invert", "Invert", "عكس الألوان"], ["mirror", "Mirror", "مرآة"], ["vhs", "VHS", "شريط VHS"],
  ["glow", "Glow", "توهج"], ["posterize", "Posterize", "تبسيط الألوان"], ["scanlines", "Scan lines", "خطوط المسح"], ["shake", "Camera shake", "اهتزاز الكاميرا"],
  // weather & light (animated, drawn on the clip's picture)
  ["rain", "Rain", "مطر"], ["snow", "Snow", "ثلج"], ["fog", "Fog", "ضباب"], ["leak", "Light leak", "تسرّب ضوئي"], ["sparkle", "Sparkles", "بريق"], ["dust", "Old film", "فيلم قديم"],
  // erase & blur one part of the picture (a box you place: x, y, w, h)
  ["blurBox", "Blur a part", "تمويه جزء"], ["pixelBox", "Pixelate a part", "بكسلة جزء"],
].map(([id, en, ar]) => ({ id, en, ar }));
// the Effects panel's groups (same order as the tiles)
export const EFFECT_GROUPS: Record<string, string[]> = {
  effects: ["blur", "sharpen", "vignette", "grain", "glitch", "rgbSplit", "pixelate", "mono", "sepia", "invert", "mirror", "vhs", "glow", "posterize", "scanlines", "shake"],
  weather: ["rain", "snow", "fog", "leak", "sparkle", "dust"],
  erase: ["blurBox", "pixelBox"],
};
// a box effect's place on the clip's picture (fractions from the top-left)
export const BOX_EFFECTS = new Set(["blurBox", "pixelBox"]);
export const boxOf = (e: { params: Record<string, number | string | boolean> }) => ({ x: +(e.params.x ?? 0.35), y: +(e.params.y ?? 0.35), w: +(e.params.w ?? 0.3), h: +(e.params.h ?? 0.3) });

// looks: colour adjustments in one tap (they set ColorAdjust values)
export const LOOKS: (Item & { set: Record<string, number> })[] = [
  { id: "none", en: "None", ar: "بدون", set: {} },
  { id: "warm", en: "Warm", ar: "دافئ", set: { temperature: 0.35, saturation: 0.1 } },
  { id: "cool", en: "Cool", ar: "بارد", set: { temperature: -0.35, tint: -0.05 } },
  { id: "vivid", en: "Vivid", ar: "زاهٍ", set: { saturation: 0.4, contrast: 0.15, vibrance: 0.3 } },
  { id: "matte", en: "Matte", ar: "مطفي", set: { contrast: -0.25, shadows: 0.2, saturation: -0.1 } },
  { id: "film", en: "Film", ar: "سينمائي", set: { contrast: 0.12, temperature: 0.12, saturation: -0.12, highlights: -0.15 } },
  { id: "teal", en: "Teal & orange", ar: "أزرق وبرتقالي", set: { temperature: 0.18, tint: -0.12, contrast: 0.18, saturation: 0.15 } },
  { id: "noir", en: "Noir", ar: "نوار", set: { saturation: -1, contrast: 0.35 } },
  { id: "golden", en: "Golden hour", ar: "الساعة الذهبية", set: { temperature: 0.5, exposure: 0.08, saturation: 0.15 } },
  { id: "fade", en: "Faded", ar: "باهت", set: { contrast: -0.35, saturation: -0.3, shadows: 0.3 } },
];

// text: templates (a style and animations) and the animations in / out
export const TEXT_ANIMS: Item[] = [
  ["none", "None", "بدون"], ["fade", "Fade", "تلاشي"], ["pop", "Pop", "ظهور"], ["slideUp", "Slide up", "انزلاق للأعلى"], ["slideDown", "Slide down", "انزلاق للأسفل"],
  ["slideL", "Slide from the side", "انزلاق من الجانب"], ["zoom", "Zoom", "تكبير"], ["typewriter", "Typewriter", "آلة كاتبة"], ["blur", "Blur in", "من الضباب"], ["bounce", "Bounce", "ارتداد"],
].map(([id, en, ar]) => ({ id, en, ar }));
export const TEXT_TEMPLATES: (Item & { style: Record<string, unknown>; animIn: string; animOut: string })[] = [
  { id: "title", en: "Bold title", ar: "عنوان عريض", style: { font: "Cairo", weight: 900, size: 0.11 }, animIn: "pop", animOut: "fade" },
  { id: "caption", en: "Caption", ar: "ترجمة", style: { font: "Cairo", weight: 700, size: 0.06, box: { color: "#000000", opacity: 0.55, pad: 0.25, radius: 0.2 } }, animIn: "fade", animOut: "fade" },
  { id: "lower", en: "Lower third", ar: "شريط سفلي", style: { font: "Tajawal", weight: 700, size: 0.055, align: "start", box: { color: "#CFE13E", opacity: 1, pad: 0.3, radius: 0.1 }, color: "#0b0c0e" }, animIn: "slideL", animOut: "fade" },
  { id: "neon", en: "Neon", ar: "نيون", style: { font: "Changa", weight: 800, color: "#7df9ff", shadow: { color: "#00e5ff", blur: 0.03, x: 0, y: 0 } }, animIn: "blur", animOut: "fade" },
  { id: "outline", en: "Outline", ar: "إطار", style: { font: "Almarai", weight: 800, color: "#ffffff", stroke: { color: "#000000", width: 0.006 } }, animIn: "zoom", animOut: "fade" },
  { id: "type", en: "Typewriter", ar: "آلة كاتبة", style: { font: "IBM Plex Sans Arabic", weight: 600, size: 0.06 }, animIn: "typewriter", animOut: "fade" },
  { id: "pop", en: "Yellow pop", ar: "أصفر بارز", style: { font: "Lalezar", weight: 400, color: "#ffd400", stroke: { color: "#000000", width: 0.008 } }, animIn: "bounce", animOut: "pop" },
  { id: "quote", en: "Quote", ar: "اقتباس", style: { font: "El Messiri", weight: 700, italic: false, size: 0.07 }, animIn: "slideUp", animOut: "fade" },
];
// fonts with Arabic and Latin shapes (loaded from Google Fonts by name)
// (v226) fonts by writing system — all free Google Fonts (OFL / Apache); a font can serve several. `ar` is kept for older code.
export type Script = "arabic" | "latin" | "cyrillic" | "cjk" | "devanagari" | "hebrew" | "thai";
export const SCRIPTS: { id: Script; en: string; ar: string; sample: string }[] = [
  { id: "arabic", en: "Arabic", ar: "العربية", sample: "مرحباً بالعالم" }, { id: "latin", en: "English · Español · Français", ar: "الإنجليزية والإسبانية والفرنسية", sample: "Hello · ¡Hola, señor!" },
  { id: "cyrillic", en: "Русский", ar: "الروسية", sample: "Привет, мир" }, { id: "cjk", en: "日本語 · 한국어 · 中文", ar: "اليابانية والكورية والصينية", sample: "こんにちは · 안녕 · 你好" },
  { id: "devanagari", en: "हिन्दी", ar: "الهندية", sample: "नमस्ते दुनिया" }, { id: "hebrew", en: "עברית", ar: "العبرية", sample: "שלום עולם" }, { id: "thai", en: "ไทย", ar: "التايلاندية", sample: "สวัสดีชาวโลก" },
];
const F = (list: string, scripts: Script[]) => list.split(",").map((n) => ({ name: n.trim(), scripts }));
export const FONT_LIST: { name: string; scripts: Script[] }[] = [
  ...F("Cairo,Tajawal,Almarai,Changa,El Messiri,Reem Kufi,Lalezar,Rakkas,IBM Plex Sans Arabic,Noto Kufi Arabic,Noto Naskh Arabic,Amiri,Harmattan,Lemonada,Marhey,Readex Pro,Mada,Markazi Text,Scheherazade New,Aref Ruqaa,Katibeh,Mirza,Jomhuria,Kufam,Baloo Bhaijaan 2,Alexandria,Noto Sans Arabic,Blaka,Gulzar,Vibes", ["arabic"]),
  ...F("Inter,Montserrat,Poppins,Anton,Bebas Neue,Playfair Display,Pacifico,Permanent Marker,Archivo Black,DM Serif Display,Space Grotesk,Open Sans,Lato,Raleway,Nunito,Work Sans,Merriweather,Lora,Libre Baskerville,Cinzel,Abril Fatface,Dancing Script,Great Vibes,Satisfy,Caveat,Shadows Into Light,Bangers,Luckiest Guy,Righteous,Fredoka,Press Start 2P,Orbitron,Audiowide,Monoton,Bungee,Black Ops One,Barlow Condensed,Alfa Slab One,Ultra,Yeseva One,Sacramento,Creepster,Special Elite,Lilita One,Chewy", ["latin"]),
  ...F("Roboto,Rubik,Oswald,PT Sans,PT Serif,Russo One,Comfortaa,Lobster,Amatic SC,Montserrat Alternates,Ubuntu,Exo 2,Jura,Neucha,Pangolin", ["latin", "cyrillic"]),
  ...F("Noto Sans JP,Noto Serif JP,M PLUS Rounded 1c,Zen Maru Gothic,Kosugi Maru,Dela Gothic One,Noto Sans KR,Black Han Sans,Do Hyeon,Jua,Noto Sans SC,ZCOOL KuaiLe,Ma Shan Zheng,Noto Sans TC", ["cjk"]),
  ...F("Hind,Mukta,Noto Sans Devanagari,Yatra One,Teko,Rozha One,Baloo 2,Kalam", ["devanagari", "latin"]),
  ...F("Heebo,Assistant,Frank Ruhl Libre,Secular One,Suez One,Varela Round,Karantina", ["hebrew", "latin"]),
  ...F("Kanit,Prompt,Sarabun,Mitr,Chakra Petch,Itim,Pattaya", ["thai", "latin"]),
];
export const FONTS: { name: string; ar: boolean }[] = FONT_LIST.map((f) => ({ name: f.name, ar: f.scripts.includes("arabic") }));
export const scriptOf = (text: string): Script =>
  /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/.test(text) ? "arabic" : /[\u0590-\u05ff]/.test(text) ? "hebrew" : /[\u0e00-\u0e7f]/.test(text) ? "thai" : /[\u0900-\u097f]/.test(text) ? "devanagari"
    : /[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/.test(text) ? "cjk" : /[\u0400-\u04ff]/.test(text) ? "cyrillic" : "latin";

// (v226) text effects: a whole look in one tap (fill, outline, glow, 3D, shadow, box); the example tile is drawn by the same text engine
export const TEXT_FX: (Item & { style: Record<string, unknown>; font?: string })[] = [
  { id: "neonBlue", en: "Neon blue", ar: "نيون أزرق", style: { color: "#e8fdff", glow: { color: "#00e5ff", blur: 0.035 }, stroke: null, shadow: null, box: null }, font: "Changa" },
  { id: "neonPink", en: "Neon pink", ar: "نيون وردي", style: { color: "#fff0fa", glow: { color: "#ff2bd6", blur: 0.035 }, stroke: null, shadow: null, box: null }, font: "Monoton" },
  { id: "gold", en: "Gold", ar: "ذهبي", style: { gradient: ["#fff3b0", "#c8901c"], stroke: { color: "#5a3a08", width: 0.002 }, shadow: { color: "rgba(0,0,0,0.6)", blur: 0.01, x: 0, y: 0.004 }, box: null }, font: "Cinzel" },
  { id: "chrome", en: "Chrome", ar: "كروم", style: { gradient: ["#ffffff", "#7d8590"], stroke: { color: "#1f2328", width: 0.002 }, shadow: null, box: null }, font: "Orbitron" },
  { id: "fire", en: "Fire", ar: "نار", style: { gradient: ["#ffe45c", "#ff3d00"], glow: { color: "#ff6a00", blur: 0.025 }, stroke: null, shadow: null, box: null }, font: "Bangers" },
  { id: "ice", en: "Ice", ar: "جليد", style: { gradient: ["#ffffff", "#7fd3ff"], glow: { color: "#58c8ff", blur: 0.02 }, stroke: { color: "#1b4f72", width: 0.0015 }, shadow: null, box: null } },
  { id: "pop3d", en: "3D pop", ar: "ثلاثي الأبعاد", style: { color: "#ffe600", stroke: { color: "#111111", width: 0.003 }, extrude: { color: "#111111", depth: 0.12 }, shadow: null, box: null }, font: "Lilita One" },
  { id: "retro3d", en: "Retro 3D", ar: "ثلاثي كلاسيكي", style: { color: "#ff4fa3", extrude: { color: "#5b2a8e", depth: 0.16 }, stroke: { color: "#ffffff", width: 0.002 }, shadow: null, box: null }, font: "Righteous" },
  { id: "comic", en: "Comic", ar: "كوميكس", style: { color: "#ffd400", stroke: { color: "#000000", width: 0.004 }, outline2: { color: "#ffffff", width: 0.003 }, extrude: { color: "#000000", depth: 0.06 }, shadow: null, box: null }, font: "Bangers" },
  { id: "outline", en: "Outline", ar: "إطار فقط", style: { color: "rgba(0,0,0,0)", stroke: { color: "#ffffff", width: 0.003 }, shadow: null, box: null } },
  { id: "double", en: "Double outline", ar: "إطار مزدوج", style: { color: "#ffffff", stroke: { color: "#111111", width: 0.003 }, outline2: { color: "#00f0ff", width: 0.003 }, shadow: null, box: null } },
  { id: "candy", en: "Candy", ar: "حلوى", style: { color: "#ff7ab6", stroke: { color: "#ffffff", width: 0.004 }, outline2: { color: "#ff3d9a", width: 0.003 }, shadow: null, box: null }, font: "Fredoka" },
  { id: "sunset", en: "Sunset", ar: "غروب", style: { gradient: ["#ffcf5a", "#ff3d9a"], stroke: null, shadow: { color: "rgba(0,0,0,0.45)", blur: 0.012, x: 0, y: 0.005 }, box: null }, font: "Poppins" },
  { id: "ocean", en: "Ocean", ar: "محيط", style: { gradient: ["#7af0ff", "#1f5fff"], stroke: null, shadow: { color: "rgba(0,0,0,0.45)", blur: 0.012, x: 0, y: 0.005 }, box: null }, font: "Montserrat" },
  { id: "hardShadow", en: "Hard shadow", ar: "ظل حاد", style: { color: "#ffffff", stroke: null, shadow: { color: "#000000", blur: 0, x: 0.006, y: 0.006 }, box: null }, font: "Archivo Black" },
  { id: "soft", en: "Soft shadow", ar: "ظل ناعم", style: { color: "#ffffff", stroke: null, shadow: { color: "rgba(0,0,0,0.7)", blur: 0.025, x: 0, y: 0.006 }, box: null } },
  { id: "label", en: "Black label", ar: "ملصق أسود", style: { color: "#ffffff", stroke: null, shadow: null, box: { color: "#000000", opacity: 0.85, pad: 0.3, radius: 0.15 } } },
  { id: "tag", en: "Cyan tag", ar: "وسم سماوي", style: { color: "#0f1014", stroke: null, shadow: null, box: { color: "#00F0FF", opacity: 1, pad: 0.3, radius: 0.12 } } },
  { id: "subtitle", en: "Subtitle", ar: "ترجمة", style: { color: "#ffffff", stroke: null, shadow: null, box: { color: "#000000", opacity: 0.55, pad: 0.25, radius: 0.2 } } },
  { id: "cinema", en: "Cinematic", ar: "سينمائي", style: { color: "#f3efe6", letterSpacing: 0.25, weight: 400, stroke: null, shadow: { color: "rgba(0,0,0,0.5)", blur: 0.012, x: 0, y: 0 }, box: null }, font: "Cinzel" },
  { id: "vintage", en: "Vintage", ar: "كلاسيكي", style: { color: "#f6e7c8", extrude: { color: "#7a4a1e", depth: 0.08 }, stroke: null, shadow: null, box: null }, font: "Abril Fatface" },
  { id: "horror", en: "Horror", ar: "رعب", style: { color: "#d8141c", glow: { color: "#4a0000", blur: 0.03 }, stroke: null, shadow: null, box: null }, font: "Creepster" },
  { id: "cyber", en: "Cyber", ar: "سايبر", style: { color: "#00f0ff", outline2: { color: "#ff2bd6", width: 0.002 }, glow: { color: "#00f0ff", blur: 0.015 }, stroke: null, shadow: null, box: null }, font: "Orbitron" },
  { id: "kids", en: "Kids", ar: "أطفال", style: { color: "#ffffff", stroke: { color: "#ff7a1a", width: 0.005 }, outline2: { color: "#ffffff", width: 0.003 }, shadow: { color: "rgba(0,0,0,0.3)", blur: 0.008, x: 0, y: 0.006 }, box: null }, font: "Chewy" },
];


// motion presets: one tap writes ordinary keyframes on the clip (you can still change each point); `none` removes them
export const MOTIONS: Item[] = [
  ["zoomIn", "Slow zoom in", "تقريب بطيء"], ["zoomOut", "Slow zoom out", "إبعاد بطيء"], ["panL", "Pan left", "تحريك لليسار"], ["panR", "Pan right", "تحريك لليمين"],
  ["panU", "Pan up", "تحريك للأعلى"], ["panD", "Pan down", "تحريك للأسفل"], ["popIn", "Pop in", "ظهور بارز"], ["dropIn", "Drop in", "سقوط للداخل"],
  ["spinIn", "Spin in", "دوران للداخل"], ["shake", "Shake", "اهتزاز"], ["pulse", "Pulse", "نبض"], ["fadeInOut", "Fade in & out", "ظهور واختفاء"], ["none", "No motion", "بدون حركة"],
].map(([id, en, ar]) => ({ id, en, ar }));
export function motionKeyframes(id: string, c: Pick<Clip, "dur" | "transform" | "opacity">): Keyframes {
  const d = Math.max(0.2, c.dur), s = c.transform.scale || 1, x = c.transform.x || 0, y = c.transform.y || 0, r = c.transform.rotation || 0, o = c.opacity ?? 1, e = Math.min(0.5, d / 3);
  const k = (pts: [number, number][], ease: "linear" | "easeOut" | "easeInOut" = "easeInOut") => pts.map(([t, v]) => ({ t: Math.min(d, Math.max(0, t)), v, ease }));
  switch (id) {
    case "zoomIn": return { scale: k([[0, s], [d, s * 1.25]], "linear") };
    case "zoomOut": return { scale: k([[0, s * 1.25], [d, s]], "linear") };
    case "panL": return { scale: k([[0, s * 1.2], [d, s * 1.2]]), x: k([[0, x + 0.08], [d, x - 0.08]], "linear") };
    case "panR": return { scale: k([[0, s * 1.2], [d, s * 1.2]]), x: k([[0, x - 0.08], [d, x + 0.08]], "linear") };
    case "panU": return { scale: k([[0, s * 1.2], [d, s * 1.2]]), y: k([[0, y + 0.08], [d, y - 0.08]], "linear") };
    case "panD": return { scale: k([[0, s * 1.2], [d, s * 1.2]]), y: k([[0, y - 0.08], [d, y + 0.08]], "linear") };
    case "popIn": return { scale: k([[0, s * 0.4], [e * 0.6, s * 1.08], [e, s]], "easeOut"), opacity: k([[0, 0], [e * 0.4, o]], "easeOut") };
    case "dropIn": return { y: k([[0, y - 0.6], [e, y]], "easeOut"), opacity: k([[0, 0], [e * 0.5, o]], "easeOut") };
    case "spinIn": return { rotation: k([[0, r - 180], [e * 1.4, r]], "easeOut"), scale: k([[0, s * 0.3], [e * 1.4, s]], "easeOut") };
    case "shake": { const pts: [number, number][] = []; for (let t = 0, i = 0; t <= Math.min(d, 1.2); t += 0.06, i++) pts.push([t, x + (i % 2 ? 0.012 : -0.012) * (1 - t / 1.3)]); pts.push([Math.min(d, 1.26), x]); return { x: k(pts, "linear") }; }
    case "pulse": { const pts: [number, number][] = []; for (let t = 0, i = 0; t <= d; t += 0.5, i++) pts.push([t, i % 2 ? s * 1.06 : s]); return { scale: k(pts) }; }
    case "fadeInOut": return { opacity: k([[0, 0], [e, o], [d - e, o], [d, 0]]) };
    default: return {};
  }
}
