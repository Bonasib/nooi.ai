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

// ================= (v278) the library grows: 62 more effects, 47 more transitions, 30 more looks, 32 more text templates
// (the drawing of each lives in the app's WebGL compositor — on the device, no graphics card on the server)
const EFFECTS278: [string, string, string, string, number][] = [
  // distort (the picture bent, mirrored or repeated)
  ["fisheye", "Fisheye", "عين السمكة", "distort", 0.6], ["bulge", "Bulge", "انتفاخ", "distort", 0.6], ["pinch", "Pinch", "قرص", "distort", 0.6], ["twirl", "Twirl", "دوامة", "distort", 0.5],
  ["ripple", "Ripple", "تموّج دائري", "distort", 0.5], ["wave", "Wave", "موجة", "distort", 0.5], ["kaleido", "Kaleidoscope", "مشكال", "distort", 1], ["mirrorV", "Mirror down", "مرآة سفلية", "distort", 1],
  ["quad", "Four copies", "أربع نسخ", "distort", 1], ["split3", "Three strips", "ثلاثة أشرطة", "distort", 1], ["zoomPulse", "Zoom pulse", "نبض التقريب", "distort", 0.6], ["heatHaze", "Heat haze", "سراب حراري", "distort", 0.6],
  ["underwater", "Underwater", "تحت الماء", "distort", 0.6], ["jitter", "Jitter", "ارتجاف", "distort", 0.5],
  // blur & light
  ["tiltShift", "Tilt-shift", "إمالة وإزاحة", "light", 0.7], ["zoomBlur", "Zoom blur", "ضبابية التقريب", "light", 0.5], ["motionBlurH", "Motion blur", "ضبابية الحركة", "light", 0.5], ["spinBlur", "Spin blur", "ضبابية الدوران", "light", 0.5],
  ["bloom", "Bloom", "إزهار ضوئي", "light", 0.6], ["halation", "Halation", "هالة حمراء", "light", 0.6], ["dreamy", "Dreamy", "حالم", "light", 0.6], ["chromaLens", "Lens fringe", "حواف العدسة", "light", 0.5],
  ["lensFlare", "Lens flare", "وهج العدسة", "light", 0.7], ["godRays", "Light rays", "أشعة الضوء", "light", 0.6], ["strobe", "Strobe", "وميض متقطع", "light", 0.5], ["flicker", "Flicker", "ارتعاش الضوء", "light", 0.5],
  // stylize (drawn, painted, printed)
  ["emboss", "Emboss", "نقش بارز", "stylize", 1], ["edges", "Glowing edges", "حواف متوهجة", "stylize", 1], ["sketch", "Pencil sketch", "رسم بالقلم", "stylize", 1], ["cartoon", "Cartoon", "كرتون", "stylize", 1],
  ["oil", "Oil paint", "رسم زيتي", "stylize", 1], ["halftone", "Halftone", "نقاط الطباعة", "stylize", 1], ["crosshatch", "Crosshatch", "تظليل متقاطع", "stylize", 1], ["dotMatrix", "LED dots", "نقاط مضيئة", "stylize", 1],
  ["hexPixel", "Hexagons", "سداسيات", "stylize", 0.6], ["neonEdges", "Neon edges", "حواف نيون", "stylize", 1], ["popArt", "Pop art", "فن البوب", "stylize", 1], ["blockGlitch", "Data glitch", "خلل البيانات", "stylize", 0.6],
  // colour tricks
  ["duotone", "Duotone purple", "لونان بنفسجي", "colorfx", 1], ["duotoneB", "Duotone blue", "لونان أزرق", "colorfx", 1], ["thermal", "Thermal", "حراري", "colorfx", 1], ["nightVision", "Night vision", "رؤية ليلية", "colorfx", 1],
  ["infrared", "Infrared", "أشعة تحت الحمراء", "colorfx", 1], ["xray", "X-ray", "أشعة سينية", "colorfx", 1], ["hueCycle", "Colour cycle", "دوران الألوان", "colorfx", 0.6], ["rainbow", "Rainbow", "قوس قزح", "colorfx", 0.5],
  ["colorPop", "Colour pop (red)", "إبراز الأحمر", "colorfx", 1], ["bleach", "Bleach bypass", "تبييض سينمائي", "colorfx", 0.7],
  // retro
  ["crt", "Old TV", "تلفاز قديم", "retro", 1], ["filmBurn", "Film burn", "احتراق الفيلم", "retro", 0.6], ["scratches", "Scratches", "خدوش", "retro", 0.6], ["grunge", "Grunge", "متّسخ", "retro", 0.6],
  // particles & weather (drawn over the picture, moving)
  ["bokeh", "Bokeh lights", "أضواء بوكيه", "particles", 0.6], ["fireflies", "Fireflies", "يراعات", "particles", 0.6], ["confetti", "Confetti", "قصاصات ملونة", "particles", 0.6], ["hearts", "Hearts", "قلوب", "particles", 0.6],
  ["embers", "Fire sparks", "شرر النار", "particles", 0.6], ["smoke", "Smoke", "دخان", "particles", 0.5], ["lightning", "Lightning", "برق", "particles", 0.7],
  // frames
  ["letterbox", "Cinema bars", "أشرطة سينمائية", "frames", 1], ["frameWhite", "Photo frame", "إطار صورة", "frames", 1], ["roundFrame", "Rounded corners", "زوايا مستديرة", "frames", 1],
];
for (const [id, en, ar, g, amt] of EFFECTS278) { EFFECTS.push({ id, en, ar, group: g }); EFFECT_AMOUNT[id] = amt; (EFFECT_GROUPS[g] = EFFECT_GROUPS[g] || []).push(id); }

// transitions: id, English, Arabic, group (the drawing: the app's shader, index = position in this list)
const TRANS278: [string, string, string, string][] = [
  ["crossZoom", "Cross zoom", "تقريب متداخل", "zoom"], ["whipL", "Whip left", "سوط لليسار", "move"], ["whipR", "Whip right", "سوط لليمين", "move"], ["whipU", "Whip up", "سوط للأعلى", "move"], ["whipD", "Whip down", "سوط للأسفل", "move"],
  ["dissolve", "Dissolve", "تذويب", "basic"], ["burn", "Burn", "احتراق", "light"], ["leakT", "Light leak", "تسرّب ضوئي", "light"], ["heart", "Heart", "قلب", "shape"], ["star", "Star", "نجمة", "shape"],
  ["irisSq", "Square iris", "فتحة مربعة", "shape"], ["plus", "Cross", "صليب", "shape"], ["splitV", "Doors open", "فتح الأبواب", "3d"], ["splitH", "Split open", "انفتاح أفقي", "3d"], ["cubeL", "Cube left", "مكعب لليسار", "3d"],
  ["cubeR", "Cube right", "مكعب لليمين", "3d"], ["flipH", "Flip", "قلب", "3d"], ["flipV", "Flip up", "قلب للأعلى", "3d"], ["rotateIn", "Rotate in", "دوران للداخل", "3d"], ["zoomSpin", "Zoom spin", "تقريب ودوران", "zoom"],
  ["bounceIn", "Bounce in", "دخول بارتداد", "move"], ["swirl", "Swirl", "دوامة", "stylized"], ["rippleT", "Ripple", "تموّج", "stylized"], ["waveT", "Wave wipe", "مسح موجي", "wipe"], ["squares", "Squares", "مربعات", "pattern"],
  ["hexT", "Hexagons", "سداسيات", "pattern"], ["dotsT", "Dots", "دوائر", "pattern"], ["linesT", "Lines", "خطوط", "pattern"], ["windL", "Wind", "ريح", "wipe"], ["digital", "Digital", "رقمي", "stylized"],
  ["dreamyT", "Dreamy", "حالم", "light"], ["colorFlash", "Colour flash", "ومضة ملونة", "light"], ["ink", "Ink", "حبر", "stylized"], ["spiral", "Spiral", "حلزون", "shape"], ["fan", "Fan", "مروحة", "wipe"],
  ["zigzag", "Zigzag", "متعرج", "wipe"], ["ellipse", "Ellipse", "بيضاوي", "shape"], ["page", "Page", "صفحة", "move"], ["stackUp", "Stack up", "تكديس", "move"], ["zoomThrough", "Zoom through", "اختراق بالتقريب", "zoom"],
  ["shakeT", "Shake", "اهتزاز", "stylized"], ["lumaInv", "Luma reverse", "إضاءة معكوسة", "basic"], ["softWipeL", "Soft wipe left", "مسح ناعم لليسار", "wipe"], ["softWipeR", "Soft wipe right", "مسح ناعم لليمين", "wipe"], ["bars", "Falling bars", "أشرطة متساقطة", "pattern"],
  ["blindsV", "Vertical blinds", "ستائر عمودية", "pattern"], ["crossWarp", "Cross warp", "التواء متداخل", "zoom"],
];
for (const [id, en, ar, group] of TRANS278) TRANSITIONS.push({ id, en, ar, group });
export const TRANSITION_GROUPS = ["basic", "wipe", "move", "zoom", "shape", "3d", "pattern", "light", "stylized"];

// looks: colour adjustments in one tap (30 more)
const LK = (id: string, en: string, ar: string, set: Record<string, number>) => LOOKS.push({ id, en, ar, set });
LK("cinematic", "Cinematic", "سينمائي داكن", { contrast: 0.22, saturation: -0.08, temperature: 0.05, highlights: -0.2, shadows: -0.1 });
LK("bleachL", "Bleach", "مبيّض", { saturation: -0.55, contrast: 0.3, exposure: 0.03 });
LK("kodak", "Warm film", "فيلم دافئ", { temperature: 0.28, tint: 0.05, contrast: 0.1, saturation: 0.08, shadows: 0.1 });
LK("fuji", "Green film", "فيلم أخضر", { temperature: -0.08, tint: -0.15, contrast: 0.12, saturation: 0.05 });
LK("polaroid", "Instant photo", "صورة فورية", { contrast: -0.15, temperature: 0.18, shadows: 0.25, saturation: -0.05, exposure: 0.05 });
LK("vintage", "Vintage", "عتيق", { temperature: 0.35, saturation: -0.35, contrast: -0.1, shadows: 0.2 });
LK("retro70", "Seventies", "السبعينات", { temperature: 0.45, tint: 0.08, saturation: 0.1, contrast: -0.05 });
LK("moody", "Moody", "مزاجي", { exposure: -0.12, contrast: 0.2, saturation: -0.25, temperature: -0.1 });
LK("dramatic", "Dramatic", "درامي", { contrast: 0.4, saturation: -0.15, highlights: -0.25, shadows: -0.2 });
LK("summer", "Summer", "صيفي", { temperature: 0.25, saturation: 0.3, exposure: 0.06, vibrance: 0.3 });
LK("winter", "Winter", "شتوي", { temperature: -0.45, saturation: -0.2, exposure: 0.05 });
LK("autumn", "Autumn", "خريفي", { temperature: 0.4, tint: 0.06, saturation: 0.15, contrast: 0.08 });
LK("spring", "Spring", "ربيعي", { temperature: 0.05, tint: -0.08, saturation: 0.25, vibrance: 0.3, exposure: 0.05 });
LK("pastel", "Pastel", "باستيل", { contrast: -0.3, saturation: -0.2, exposure: 0.12, shadows: 0.3 });
LK("neonL", "Neon night", "ليل نيون", { tint: 0.25, temperature: -0.2, saturation: 0.45, contrast: 0.2 });
LK("cyberpunk", "Cyberpunk", "سايبربانك", { tint: 0.35, temperature: -0.3, contrast: 0.25, saturation: 0.3 });
LK("desert", "Desert", "صحراوي", { temperature: 0.5, saturation: 0.05, contrast: 0.12, highlights: -0.1 });
LK("forest", "Forest", "غابة", { tint: -0.2, saturation: 0.15, contrast: 0.1, temperature: -0.05 });
LK("ocean", "Ocean", "محيط", { temperature: -0.35, tint: -0.05, saturation: 0.2, contrast: 0.08 });
LK("sunset", "Sunset", "غروب", { temperature: 0.55, tint: 0.12, saturation: 0.2, exposure: -0.03 });
LK("bw_high", "Hard black & white", "أبيض وأسود حاد", { saturation: -1, contrast: 0.55 });
LK("bw_soft", "Soft black & white", "أبيض وأسود ناعم", { saturation: -1, contrast: -0.15, shadows: 0.2 });
LK("sepiaL", "Old brown", "بني قديم", { saturation: -0.75, temperature: 0.6, contrast: 0.05 });
LK("chrome", "Chrome", "كروم", { contrast: 0.25, saturation: 0.2, highlights: 0.1, vibrance: 0.2 });
LK("soft", "Soft", "ناعم", { contrast: -0.2, exposure: 0.06, highlights: -0.15 });
LK("crisp", "Crisp", "واضح", { contrast: 0.25, vibrance: 0.25, shadows: -0.05 });
LK("night", "Night", "ليلي", { exposure: -0.3, temperature: -0.4, saturation: -0.3, contrast: 0.15 });
LK("candle", "Candlelight", "ضوء الشموع", { temperature: 0.7, exposure: -0.1, saturation: 0.1, contrast: 0.1 });
LK("food", "Food", "طعام", { temperature: 0.15, saturation: 0.25, vibrance: 0.35, contrast: 0.1, exposure: 0.04 });
LK("portrait", "Portrait", "بورتريه", { temperature: 0.08, saturation: -0.05, contrast: -0.05, highlights: -0.1, shadows: 0.1 });

// text in / out animations (10 more)
for (const [id, en, ar] of [["rotateIn", "Rotate", "دوران"], ["dropIn", "Drop", "سقوط"], ["riseUp", "Rise", "صعود"], ["swing", "Swing", "تأرجح"], ["elastic", "Elastic", "مطاطي"],
  ["shrink", "Shrink", "تصغير"], ["glitchIn", "Glitch", "تشويش"], ["wordByWord", "Word by word", "كلمة كلمة"], ["flicker", "Flicker", "وميض"], ["slideR", "Slide from the other side", "انزلاق من الجهة الأخرى"]]) TEXT_ANIMS.push({ id, en, ar });

// text templates (32 more): a style and in / out animations, drawn by the same text engine as the titles
const TT = (id: string, en: string, ar: string, style: Record<string, unknown>, animIn: string, animOut: string) => TEXT_TEMPLATES.push({ id, en, ar, style, animIn, animOut });
TT("headline", "Headline", "عنوان رئيسي", { font: "Anton", weight: 400, size: 0.13, color: "#ffffff", shadow: { color: "rgba(0,0,0,0.5)", blur: 0.012, x: 0, y: 0.005 } }, "slideUp", "fade");
TT("breaking", "Breaking news", "خبر عاجل", { font: "Cairo", weight: 900, size: 0.06, color: "#ffffff", box: { color: "#d0021b", opacity: 1, pad: 0.35, radius: 0.05 } }, "slideL", "slideL");
TT("subscribe", "Subscribe", "اشترك", { font: "Cairo", weight: 800, size: 0.06, color: "#ffffff", box: { color: "#ff0033", opacity: 1, pad: 0.4, radius: 0.5 } }, "elastic", "shrink");
TT("price", "Price tag", "سعر", { font: "Archivo Black", weight: 400, size: 0.1, color: "#0f1014", box: { color: "#D9F43B", opacity: 1, pad: 0.3, radius: 0.15 } }, "pop", "fade");
TT("sale", "Sale", "تخفيضات", { font: "Lilita One", weight: 400, size: 0.14, color: "#ffffff", stroke: { color: "#d0021b", width: 0.008 }, extrude: { color: "#7a0010", depth: 0.08 } }, "bounce", "pop");
TT("cinemaT", "Movie title", "عنوان فيلم", { font: "Cinzel", weight: 700, size: 0.09, color: "#f3efe6", letterSpacing: 0.3, shadow: { color: "rgba(0,0,0,0.6)", blur: 0.02, x: 0, y: 0 } }, "fade", "fade");
TT("credits", "Credits", "شارة الختام", { font: "Montserrat", weight: 600, size: 0.04, color: "#ffffff", letterSpacing: 0.2 }, "riseUp", "fade");
TT("handwrite", "Handwriting", "خط يدوي", { font: "Caveat", weight: 700, size: 0.1, color: "#ffffff" }, "typewriter", "fade");
TT("signature", "Signature", "توقيع", { font: "Great Vibes", weight: 400, size: 0.11, color: "#ffffff" }, "wordByWord", "fade");
TT("marker", "Marker", "قلم عريض", { font: "Permanent Marker", weight: 400, size: 0.09, color: "#ffeb3b", shadow: { color: "#000000", blur: 0, x: 0.004, y: 0.004 } }, "dropIn", "fade");
TT("gameOver", "Game", "لعبة", { font: "Press Start 2P", weight: 400, size: 0.05, color: "#7CFF6B", glow: { color: "#2bff6b", blur: 0.02 } }, "glitchIn", "flicker");
TT("horrorT", "Horror", "رعب", { font: "Creepster", weight: 400, size: 0.12, color: "#d8141c", glow: { color: "#4a0000", blur: 0.03 } }, "flicker", "fade");
TT("sciFi", "Sci-fi", "خيال علمي", { font: "Orbitron", weight: 800, size: 0.08, color: "#00f0ff", glow: { color: "#00f0ff", blur: 0.02 }, letterSpacing: 0.15 }, "glitchIn", "fade");
TT("goldT", "Gold award", "جائزة ذهبية", { font: "Cinzel", weight: 900, size: 0.1, gradient: ["#fff3b0", "#c8901c"], stroke: { color: "#5a3a08", width: 0.002 } }, "zoom", "fade");
TT("kidsT", "Kids", "أطفال", { font: "Chewy", weight: 400, size: 0.11, color: "#ffffff", stroke: { color: "#ff7a1a", width: 0.006 } }, "elastic", "pop");
TT("arabicCal", "Arabic calligraphy", "خط عربي", { font: "Aref Ruqaa", weight: 700, size: 0.12, color: "#f6e7c8", shadow: { color: "rgba(0,0,0,0.6)", blur: 0.012, x: 0, y: 0.004 } }, "fade", "fade");
TT("kufi", "Kufi bold", "كوفي عريض", { font: "Reem Kufi", weight: 700, size: 0.11, color: "#D9F43B" }, "slideUp", "fade");
TT("naskh", "Naskh", "نسخ", { font: "Amiri", weight: 700, size: 0.09, color: "#ffffff" }, "fade", "fade");
TT("ramadan", "Ramadan", "رمضان", { font: "El Messiri", weight: 700, size: 0.11, gradient: ["#fff3b0", "#d4a017"], glow: { color: "#ffcf5a", blur: 0.02 } }, "zoom", "fade");
TT("eid", "Eid", "عيد", { font: "Lalezar", weight: 400, size: 0.13, color: "#ffffff", stroke: { color: "#3a5bd9", width: 0.006 } }, "bounce", "fade");
TT("question", "Question", "سؤال", { font: "Cairo", weight: 800, size: 0.07, color: "#0f1014", box: { color: "#ffffff", opacity: 1, pad: 0.35, radius: 0.35 } }, "pop", "fade");
TT("chat", "Chat bubble", "فقاعة محادثة", { font: "Tajawal", weight: 700, size: 0.055, color: "#ffffff", box: { color: "#1f8cff", opacity: 1, pad: 0.4, radius: 0.6 } }, "slideUp", "fade");
TT("label", "Name label", "اسم المتحدث", { font: "Tajawal", weight: 800, size: 0.05, align: "start", color: "#ffffff", box: { color: "#111111", opacity: 0.85, pad: 0.3, radius: 0.08 } }, "slideL", "slideL");
TT("location", "Location", "الموقع", { font: "Montserrat", weight: 700, size: 0.045, color: "#ffffff", letterSpacing: 0.2, box: { color: "#000000", opacity: 0.5, pad: 0.3, radius: 0.1 } }, "fade", "fade");
TT("date", "Date", "التاريخ", { font: "Space Grotesk", weight: 700, size: 0.05, color: "#ffffff", letterSpacing: 0.1 }, "typewriter", "fade");
TT("hashtag", "Hashtag", "وسم", { font: "Poppins", weight: 800, size: 0.07, color: "#00F0FF", shadow: { color: "rgba(0,0,0,0.5)", blur: 0.01, x: 0, y: 0.004 } }, "rotateIn", "fade");
TT("countdown", "Countdown", "عد تنازلي", { font: "Bebas Neue", weight: 400, size: 0.2, color: "#ffffff", glow: { color: "#ff3d00", blur: 0.02 } }, "shrink", "pop");
TT("comicT", "Comic", "كوميكس", { font: "Bangers", weight: 400, size: 0.12, color: "#ffd400", stroke: { color: "#000000", width: 0.006 }, outline2: { color: "#ffffff", width: 0.004 } }, "elastic", "pop");
TT("retroT", "Retro", "كلاسيكي", { font: "Righteous", weight: 400, size: 0.1, color: "#ff4fa3", extrude: { color: "#5b2a8e", depth: 0.14 } }, "swing", "fade");
TT("minimal", "Minimal", "بسيط", { font: "Inter", weight: 300, size: 0.06, color: "#ffffff", letterSpacing: 0.3 }, "fade", "fade");
TT("quoteBig", "Big quote", "اقتباس كبير", { font: "Playfair Display", weight: 700, size: 0.075, color: "#ffffff", italic: true }, "wordByWord", "fade");
TT("tiktok", "Short-video caption", "تعليق الفيديو القصير", { font: "Montserrat", weight: 900, size: 0.075, color: "#ffffff", stroke: { color: "#000000", width: 0.006 } }, "pop", "fade");

// ================= (v278) phase 3: voices for a clip's sound (drawn by Web Audio nodes in the preview and the export)
export const VOICES278: Item[] = [
  ["none", "Natural", "طبيعي"], ["deep", "Deep", "عميق"], ["chipmunk", "Chipmunk", "سنجاب"], ["robot", "Robot", "روبوت"], ["telephone", "Telephone", "هاتف"], ["radio", "Radio", "راديو"],
  ["echo", "Echo", "صدى"], ["hall", "Big hall", "قاعة كبيرة"], ["underwater", "Underwater", "تحت الماء"], ["monster", "Monster", "وحش"], ["alien", "Alien", "فضائي"], ["megaphone", "Megaphone", "مكبّر صوت"],
].map(([id, en, ar]) => ({ id, en, ar }));
