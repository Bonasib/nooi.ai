// Stickers & graphics: nooi's own drawings (SVG, 256×256), turned into a 512 px PNG when added — so they behave like any
// picture: on the timeline, in every export (device, computer, server) and in the library.
const L = "#CFE13E", W = "#ffffff", K = "#0b0c0e", R = "#ff4d4f", Y = "#ffd60a", O = "#ff8a1f", P = "#ff5fa2", B = "#3aa0ff";
const face = (inner: string) => `<circle cx="128" cy="128" r="104" fill="${Y}" stroke="${K}" stroke-width="8"/>${inner}`;
const txt = (t: string, y = 150, size = 64, fill = W) => `<text x="128" y="${y}" text-anchor="middle" font-family="Arial Black,Arial,Helvetica,sans-serif" font-weight="900" font-size="${size}" fill="${fill}">${t}</text>`;
const star = (cx: number, cy: number, r: number, fill: string) => { let d = ""; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; d += (i ? "L" : "M") + (cx + rr * Math.cos(a)).toFixed(1) + " " + (cy + rr * Math.sin(a)).toFixed(1); } return `<path d="${d}Z" fill="${fill}"/>`; };
const spark = (cx: number, cy: number, r: number, fill: string) => `<path d="M${cx} ${cy - r}Q${cx + r * 0.18} ${cy - r * 0.18} ${cx + r} ${cy}Q${cx + r * 0.18} ${cy + r * 0.18} ${cx} ${cy + r}Q${cx - r * 0.18} ${cy + r * 0.18} ${cx - r} ${cy}Q${cx - r * 0.18} ${cy - r * 0.18} ${cx} ${cy - r}Z" fill="${fill}"/>`;
const burst = (fill: string) => { let d = ""; for (let i = 0; i < 32; i++) { const a = (i * Math.PI) / 16, rr = i % 2 ? 84 : 120; d += (i ? "L" : "M") + (128 + rr * Math.cos(a)).toFixed(1) + " " + (128 + rr * Math.sin(a)).toFixed(1); } return `<path d="${d}Z" fill="${fill}" stroke="${K}" stroke-width="6"/>`; };

export const STICKERS: { id: string; en: string; ar: string; group: "shapes" | "badges" | "faces" | "marks"; svg: string }[] = [
  { id: "star", en: "Star", ar: "نجمة", group: "shapes", svg: star(128, 132, 116, Y) },
  { id: "heart", en: "Heart", ar: "قلب", group: "shapes", svg: `<path d="M128 220C40 160 16 112 32 76c16-36 64-44 96-6 32-38 80-30 96 6 16 36-8 84-96 144z" fill="${R}"/>` },
  { id: "arrow", en: "Arrow", ar: "سهم", group: "marks", svg: `<path d="M24 104h132V56l80 72-80 72v-48H24z" fill="${L}" stroke="${K}" stroke-width="8" stroke-linejoin="round"/>` },
  { id: "curve", en: "Curved arrow", ar: "سهم منحني", group: "marks", svg: `<path d="M40 200C40 110 100 64 190 70" fill="none" stroke="${W}" stroke-width="18" stroke-linecap="round"/><path d="M170 36l46 36-50 26z" fill="${W}"/>` },
  { id: "down", en: "Tap here", ar: "اضغط هنا", group: "marks", svg: `<path d="M98 20h60v118h44l-74 80-74-80h44z" fill="${L}" stroke="${K}" stroke-width="8" stroke-linejoin="round"/>` },
  { id: "check", en: "Check", ar: "صح", group: "badges", svg: `<circle cx="128" cy="128" r="108" fill="#2fbf71"/><path d="M76 132l36 36 72-80" fill="none" stroke="${W}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>` },
  { id: "cross", en: "Cross", ar: "خطأ", group: "badges", svg: `<circle cx="128" cy="128" r="108" fill="${R}"/><path d="M84 84l88 88M172 84l-88 88" stroke="${W}" stroke-width="24" stroke-linecap="round"/>` },
  { id: "bubble", en: "Speech bubble", ar: "فقاعة كلام", group: "shapes", svg: `<path d="M40 40h176a20 20 0 0 1 20 20v100a20 20 0 0 1-20 20H110l-50 44v-44H40a20 20 0 0 1-20-20V60a20 20 0 0 1 20-20z" fill="${W}" stroke="${K}" stroke-width="8" stroke-linejoin="round"/>` },
  { id: "thought", en: "Thought", ar: "فكرة", group: "shapes", svg: `<g fill="${W}" stroke="${K}" stroke-width="7"><ellipse cx="128" cy="100" rx="100" ry="70"/><circle cx="72" cy="196" r="18"/><circle cx="44" cy="232" r="10"/></g>` },
  { id: "pin", en: "Location", ar: "موقع", group: "marks", svg: `<path d="M128 240s-80-84-80-140a80 80 0 0 1 160 0c0 56-80 140-80 140z" fill="${R}"/><circle cx="128" cy="100" r="30" fill="${W}"/>` },
  { id: "wow", en: "WOW", ar: "واو", group: "badges", svg: burst(Y) + txt("WOW", 150, 58, K) },
  { id: "fire", en: "Fire", ar: "نار", group: "shapes", svg: `<path d="M128 240c-56 0-88-36-88-84 0-44 30-70 44-104 10 30 26 40 36 46 2-36 22-68 52-86-6 40 52 74 52 140 0 52-38 88-96 88z" fill="${O}"/><path d="M128 236c-28 0-46-18-46-44 0-26 20-40 30-60 6 18 16 26 24 30 4-16 14-28 26-36-2 22 22 40 22 66 0 26-22 44-56 44z" fill="${Y}"/>` },
  { id: "bolt", en: "Lightning", ar: "برق", group: "shapes", svg: `<path d="M150 16L56 144h60l-20 96 104-136h-62z" fill="${Y}" stroke="${K}" stroke-width="8" stroke-linejoin="round"/>` },
  { id: "like", en: "Like", ar: "إعجاب", group: "badges", svg: `<circle cx="128" cy="128" r="108" fill="${B}"/><path d="M84 120h28v72H84zM120 192h56c10 0 16-6 18-14l12-50c2-10-4-18-14-18h-38l6-30c2-12-6-22-16-22l-24 52z" fill="${W}"/>` },
  { id: "bell", en: "Subscribe bell", ar: "جرس الاشتراك", group: "badges", svg: `<path d="M128 28a14 14 0 0 1 14 14v6c34 8 54 36 54 72v44l20 22v10H40v-10l20-22v-44c0-36 20-64 54-72v-6a14 14 0 0 1 14-14z" fill="${Y}" stroke="${K}" stroke-width="7"/><circle cx="128" cy="212" r="18" fill="${K}"/>` },
  { id: "crown", en: "Crown", ar: "تاج", group: "shapes", svg: `<path d="M28 196L44 76l54 52 30-76 30 76 54-52 16 120z" fill="${Y}" stroke="${K}" stroke-width="8" stroke-linejoin="round"/><rect x="28" y="196" width="200" height="28" rx="6" fill="${O}" stroke="${K}" stroke-width="8"/>` },
  { id: "sun", en: "Sun", ar: "شمس", group: "shapes", svg: `<g stroke="${O}" stroke-width="14" stroke-linecap="round">${[...Array(12)].map((_, i) => { const a = (i * Math.PI) / 6; return `<line x1="${(128 + 78 * Math.cos(a)).toFixed(0)}" y1="${(128 + 78 * Math.sin(a)).toFixed(0)}" x2="${(128 + 112 * Math.cos(a)).toFixed(0)}" y2="${(128 + 112 * Math.sin(a)).toFixed(0)}"/>`; }).join("")}</g><circle cx="128" cy="128" r="60" fill="${Y}"/>` },
  { id: "note", en: "Music note", ar: "نوتة", group: "shapes", svg: `<path d="M100 44l112-24v148a34 34 0 1 1-24-32V68l-64 14v110a34 34 0 1 1-24-32z" fill="${P}"/>` },
  { id: "play", en: "Play button", ar: "زر التشغيل", group: "badges", svg: `<rect x="20" y="52" width="216" height="152" rx="40" fill="${R}"/><path d="M106 92l56 36-56 36z" fill="${W}"/>` },
  { id: "new", en: "NEW", ar: "جديد", group: "badges", svg: `<rect x="16" y="76" width="224" height="104" rx="24" fill="${L}" stroke="${K}" stroke-width="8"/>` + txt("NEW", 152, 66, K) },
  { id: "sale", en: "SALE", ar: "تخفيض", group: "badges", svg: `<path d="M28 80h150l50 48-50 48H28z" fill="${R}" stroke="${K}" stroke-width="8" stroke-linejoin="round"/><circle cx="186" cy="128" r="10" fill="${W}"/>` + txt("SALE", 150, 54) },
  { id: "live", en: "LIVE", ar: "مباشر", group: "badges", svg: `<rect x="24" y="84" width="208" height="88" rx="44" fill="${R}"/><circle cx="72" cy="128" r="14" fill="${W}"/>` + `<text x="150" y="148" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="54" fill="${W}">LIVE</text>` },
  { id: "smile", en: "Smile", ar: "ابتسامة", group: "faces", svg: face(`<circle cx="92" cy="104" r="12" fill="${K}"/><circle cx="164" cy="104" r="12" fill="${K}"/><path d="M76 148c24 40 80 40 104 0" fill="none" stroke="${K}" stroke-width="12" stroke-linecap="round"/>`) },
  { id: "laugh", en: "Laugh", ar: "ضحك", group: "faces", svg: face(`<path d="M74 104q18-20 36 0M146 104q18-20 36 0" fill="none" stroke="${K}" stroke-width="10" stroke-linecap="round"/><path d="M70 136h116c0 44-26 66-58 66s-58-22-58-66z" fill="${K}"/><path d="M92 176q36 22 72 0" fill="${R}"/>`) },
  { id: "love", en: "Love", ar: "حب", group: "faces", svg: face(`<path d="M92 120c-24-14-30-26-26-36 4-10 18-12 26-2 8-10 22-8 26 2 4 10-2 22-26 36zM164 120c-24-14-30-26-26-36 4-10 18-12 26-2 8-10 22-8 26 2 4 10-2 22-26 36z" fill="${R}"/><path d="M84 158c22 30 66 30 88 0" fill="none" stroke="${K}" stroke-width="12" stroke-linecap="round"/>`) },
  { id: "shock", en: "Surprised", ar: "مندهش", group: "faces", svg: face(`<circle cx="92" cy="104" r="16" fill="${K}"/><circle cx="164" cy="104" r="16" fill="${K}"/><ellipse cx="128" cy="170" rx="26" ry="32" fill="${K}"/>`) },
  { id: "underline", en: "Brush underline", ar: "خط فرشاة", group: "marks", svg: `<path d="M20 150c50-20 110-26 216-12-60 4-120 12-180 32" fill="none" stroke="${L}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>` },
  { id: "ring", en: "Circle mark", ar: "دائرة تحديد", group: "marks", svg: `<path d="M150 40c-70-10-130 30-128 92 2 58 64 94 128 84 56-8 90-46 84-92-6-46-58-76-120-70" fill="none" stroke="${R}" stroke-width="12" stroke-linecap="round"/>` },
  { id: "sparkles", en: "Sparkles", ar: "لمعان", group: "shapes", svg: spark(150, 104, 80, Y) + spark(64, 176, 44, W) + spark(196, 206, 30, L) },
  { id: "frame", en: "Photo frame", ar: "إطار", group: "shapes", svg: `<rect x="24" y="24" width="208" height="208" rx="20" fill="none" stroke="${W}" stroke-width="16"/><rect x="40" y="40" width="176" height="176" rx="10" fill="none" stroke="${L}" stroke-width="4" stroke-dasharray="10 10"/>` },
];
export const stickerSvg = (s: { svg: string }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="512" height="512">${s.svg}</svg>`;
export const stickerUrl = (s: { svg: string }) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(stickerSvg(s));
// the drawing as a 512 px PNG file (what goes into the project)
export async function stickerFile(id: string): Promise<File | null> {
  const s = STICKERS.find((x) => x.id === id); if (!s) return null;
  const img = new Image(); img.decoding = "async"; img.src = stickerUrl(s); await img.decode();
  const cv = Object.assign(document.createElement("canvas"), { width: 512, height: 512 }); cv.getContext("2d")!.drawImage(img, 0, 0, 512, 512);
  const b = await new Promise<Blob | null>((ok) => cv.toBlob(ok, "image/png")); return b ? new File([b], "sticker-" + id + ".png", { type: "image/png" }) : null;
}
