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
export const EFFECT_AMOUNT: Record<string, number> = { mono: 1, sepia: 1, invert: 1, mirror: 1, blur: 0.4, vignette: 0.6, grain: 0.5 };
export const effectAmount = (type: string) => EFFECT_AMOUNT[type] ?? 0.5;
export const EFFECTS: Item[] = [
  ["blur", "Blur", "تمويه"], ["sharpen", "Sharpen", "حدة"], ["vignette", "Vignette", "تظليل الأطراف"], ["grain", "Film grain", "حبيبات الفيلم"],
  ["glitch", "Glitch", "تشويش رقمي"], ["rgbSplit", "RGB split", "انفصال الألوان"], ["pixelate", "Pixelate", "بكسلة"], ["mono", "Black & white", "أبيض وأسود"],
  ["sepia", "Sepia", "بني قديم"], ["invert", "Invert", "عكس الألوان"], ["mirror", "Mirror", "مرآة"], ["vhs", "VHS", "شريط VHS"],
  ["glow", "Glow", "توهج"], ["posterize", "Posterize", "تبسيط الألوان"], ["scanlines", "Scan lines", "خطوط المسح"], ["shake", "Camera shake", "اهتزاز الكاميرا"],
].map(([id, en, ar]) => ({ id, en, ar }));

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
export const FONTS: { name: string; ar: boolean }[] = [
  "Cairo", "Tajawal", "Almarai", "Changa", "El Messiri", "Reem Kufi", "Lalezar", "Rakkas", "IBM Plex Sans Arabic", "Noto Kufi Arabic", "Noto Naskh Arabic", "Amiri", "Harmattan", "Lemonada", "Marhey",
].map((name) => ({ name, ar: true })).concat(["Inter", "Montserrat", "Poppins", "Anton", "Bebas Neue", "Oswald", "Playfair Display", "Pacifico", "Permanent Marker", "Archivo Black", "DM Serif Display", "Space Grotesk"].map((name) => ({ name, ar: false })));
