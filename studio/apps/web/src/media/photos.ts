// (v235) The background library: high-quality pictures (Full HD, cleaned and sharpened; served with the studio from /studio/backdrops)
// and the drawn moving scenes, sorted as studios, technology, nature and business & finance. A picture can be still or moving:
// moving = a slow push-in plus the light that suits it (rain on a rainy street, stars twinkling, a warm light leak at sunset).
export type Cat = "studio" | "tech" | "nature" | "business";
export const CATS: [Cat | "all", string, string][] = [["all", "All", "الكل"], ["studio", "Studios", "استوديوهات"], ["tech", "Technology", "تقنية"], ["nature", "Nature & travel", "طبيعة وسفر"], ["business", "Business & finance", "أعمال ومال"]];
export interface Photo { id: string; en: string; ar: string; cat: Cat; fx?: [string, number][] }
export const PHOTOS: Photo[] = ([
  ["library", "Library study", "مكتبة فاخرة", "studio", [["leak", 0.18]]], ["brick-loft", "Brick loft", "لوفت الطوب", "studio", [["leak", 0.15]]],
  ["wood-slats", "Wood slats", "ألواح خشبية", "studio", [["leak", 0.15]]], ["teal-wood", "Teal & wood", "فيروزي وخشب", "studio"],
  ["coastal-room", "Coastal room", "غرفة ساحلية", "studio"], ["neon-navy", "Neon studio", "استوديو نيون", "studio", [["sparkle", 0.12]]],
  ["burgundy", "Burgundy studio", "استوديو عنابي", "studio"], ["acoustic-purple", "Acoustic studio", "استوديو صوتي", "studio"],
  ["circuit", "Circuit board", "لوحة إلكترونية", "tech", [["sparkle", 0.3]]], ["quantum", "Quantum lab", "مختبر كمّي", "tech", [["sparkle", 0.2]]],
  ["robot-arm", "Robot arm", "ذراع آلية", "tech", [["leak", 0.2]]], ["telescopes", "Radio telescopes", "تلسكوبات راديوية", "tech", [["sparkle", 0.45]]],
  ["car-factory", "Car factory", "مصنع سيارات", "tech", [["fog", 0.12]]],
  ["greenhouse", "Greenhouse", "بيت زراعي", "nature", [["leak", 0.3]]], ["balloons", "Balloons at sunrise", "مناطيد عند الشروق", "nature", [["leak", 0.25]]],
  ["kyoto-rain", "Rainy lane", "زقاق ممطر", "nature", [["rain", 0.55]]], ["amalfi", "Sea terrace", "شرفة على البحر", "nature", [["leak", 0.28]]],
  ["skyline", "Skyline at dusk", "ناطحات عند الغروب", "business", [["leak", 0.25]]], ["port", "Container port", "ميناء الحاويات", "business"],
  ["camera-rain", "News camera in the rain", "كاميرا أخبار تحت المطر", "business", [["rain", 0.5]]],
] as [string, string, string, Cat, [string, number][]?][]).map(([id, en, ar, cat, fx]) => ({ id, en, ar, cat, fx }));
export const photoUrl = (id: string, thumb = false) => (import.meta.env.BASE_URL || "/studio/") + "backdrops/" + id + (thumb ? "-t" : "") + ".webp";
/** which group each drawn moving scene belongs to */
export const SCENE_CAT: Record<string, Cat> = {
  "mb-aurora": "nature", "mb-bokeh": "studio", "mb-clouds": "nature", "mb-ocean": "nature", "mb-studio": "studio", "mb-space": "tech", "mb-grid": "tech", "mb-rain": "nature",
  "mb-snow": "nature", "mb-sunset": "nature", "mb-plexus": "tech", "mb-waves": "tech", "mb-embers": "nature", "mb-water": "nature", "mb-city": "business", "mb-forest": "nature",
  "st-cyclo": "studio", "st-panels": "studio", "st-neon": "studio", "st-hex": "tech", "st-data": "tech", "st-globe": "business", "st-market": "business", "st-ticker": "business",
  "st-glass": "business", "st-news": "business", "st-garden": "nature",
};
/** the words for a background made with AI: what it shows, where the person stands, and what it must not have */
export const AI_CATS: Record<Cat | "finance", [string, string, string]> = {
  studio: ["Studio", "استوديو", "an empty, elegant professional video studio set with designed wall panels, soft warm practical lights and a polished floor"],
  tech: ["Technology", "تقنية", "a modern technology studio with glowing abstract data screens, neon accent lines and dark glossy surfaces"],
  nature: ["Nature", "طبيعة", "a calm, beautiful natural landscape with soft golden light and depth"],
  business: ["Business", "أعمال", "a premium corporate studio with glass walls, a soft-focus city view and warm, clean light"],
  finance: ["Finance", "مال", "a financial news studio with large glowing abstract market charts and tickers on the back wall"],
};
export function aiWords(cat: Cat | "finance", words: string, space: "centre" | "left" | "right") {
  const what = words.trim() || AI_CATS[cat][2];
  return `${what}. A background for a video presenter, wide 16:9, photorealistic, high detail, sharp, cinematic light, ${space === "centre" ? "open space in the middle" : "open space on the " + space + " side"} where a person will stand. No people, no chairs, no tables, no desks, no furniture in front, no text, no logos, no watermark.`;
}
export const AI_MOVE = "The same scene with a locked, very slow gentle camera push-in and subtle natural ambient motion only (light shimmer, soft particles, screens glowing). No people, no new objects, no cuts, seamless.";
