// v273: the ready cast — 30 fictional people (AI-made portraits and character sheets the owner supplied), each a complete
// character anyone can use: a fixed face (the face reference every engine gets), a character sheet (front, sides, back and six
// expressions — sent as an extra reference so the person stays the same in every shot), the full body, a description for the
// engines, a native language and a voice of the voice engine matched to their age, gender and tone. They appear in Characters
// ("Ready characters"), UGC ads (presenters) and the Avatar tool (ready avatars). Children are marked: family-friendly use only.
// The pictures live in public/cast/<id>/ (face, smile, body, sheet — or photo for a portrait); at start they are copied once into
// the media folder (cast273-<id>-<file>.jpg) so engines reach them like any picture on this server.
import fs from "fs";
import path from "path";
import { MEDIA_DIR, publicUrl } from "./media.js";
import { elVoiceId } from "../providers/kie.js";

const SRC = path.resolve("public", "cast");
// [id, en, ar, country en, country ar, flag, gender, age, band, who (for the engines), outfit, lang, voice name, tone, dialect, kind]
// kind: "sheet" (a character sheet) or "photo" (a portrait). Voice names are the voice engine's standard voices.
const C = [
  ["omar", "Omar", "عمر", "Saudi Arabia", "السعودية", "🇸🇦", "male", 30, "adult", "a Saudi man around 30 with short curly black hair and a full trimmed beard, warm confident smile", "a beige overshirt over a white T-shirt, black trousers, white sneakers", "ar", "Roger", "warm", "najdi", "sheet"],
  ["yui", "Yui", "يوي", "Japan", "اليابان", "🇯🇵", "female", 25, "young", "a Japanese woman around 25 with a sleek black bob and full bangs, soft friendly smile", "a teal cropped utility jacket over a cream top, wide navy trousers, white sneakers", "ja", "Laura", "warm", "enUS", "sheet"],
  ["kwame", "Kwame", "كوامي", "Ghana", "غانا", "🇬🇭", "male", 30, "adult", "a Ghanaian man around 30 with short black hair and a broad bright smile", "a mustard overshirt over a charcoal T-shirt, olive trousers, brown shoes", "en", "Chris", "energetic", "enUK", "sheet"],
  ["lucia", "Lucia", "لوسيا", "Brazil", "البرازيل", "🇧🇷", "female", 28, "young", "a Brazilian woman around 28 with voluminous dark curly hair and small gold hoops, lively smile", "a coral cable-knit short-sleeve sweater, light baggy jeans, cream sneakers", "pt", "Jessica", "energetic", "enUS", "sheet"],
  ["arjun", "Arjun", "أرجون", "India", "الهند", "🇮🇳", "male", 28, "young", "an Indian man around 28 with wavy black hair and a short beard, friendly upbeat smile", "a royal-blue shirt with rolled sleeves, charcoal trousers, grey sneakers", "hi", "Will", "warm", "enUS", "sheet"],
  ["camille", "Camille", "كاميل", "France", "فرنسا", "🇫🇷", "female", 66, "senior", "a French woman around 66 with short silver hair and pearl earrings, gentle smile", "a burgundy cardigan over a white collared blouse, navy trousers, brown loafers", "fr", "Lily", "calm", "enUK", "sheet"],
  ["mateo", "Mateo", "ماتيو", "Mexico", "المكسيك", "🇲🇽", "male", 70, "senior", "a Mexican man around 70 with wavy silver hair and a grey moustache, kind twinkling smile", "a sage-green zip jacket over a cream shirt, brown trousers, brown loafers", "es", "Bill", "warm", "enUS", "sheet"],
  ["amina", "Amina", "أمينة", "Morocco", "المغرب", "🇲🇦", "female", 38, "adult", "a Moroccan woman around 38 in a terracotta hijab, warm composed smile", "a sage-green long tunic, cream wide trousers, beige sneakers", "ar", "Aria", "warm", "msa", "sheet"],
  ["leo", "Leo", "ليو", "Canada", "كندا", "🇨🇦", "male", 12, "child", "a Canadian boy around 12 with messy copper-red hair and freckles, cheeky smile", "a navy hoodie, beige cargo trousers, grey sneakers", "en", "Liam", "energetic", "enUS", "sheet"],
  ["maya", "Maya", "مايا", "New Zealand", "نيوزيلندا", "🇳🇿", "female", 11, "child", "a Māori New Zealand girl around 11 with two long dark braids, bright happy smile", "a lilac sweatshirt, dark jeans, white sneakers", "en", "Jessica", "energetic", "enUK", "sheet"],
  ["nora", "Nora", "نورا", "Sweden", "السويد", "🇸🇪", "female", 38, "adult", "a Swedish woman around 38 with dark-blonde hair in a low ponytail and light freckles, calm natural smile", "a slate-blue shirt with rolled sleeves, cream trousers, white sneakers", "sv", "Charlotte", "calm", "enUK", "sheet"],
  ["hassan", "Hassan", "حسن", "Egypt", "مصر", "🇪🇬", "male", 50, "mid", "an Egyptian man around 50 with curly greying hair and a thick black moustache, easy-going smile", "a navy polo shirt, khaki trousers, brown shoes", "ar", "Brian", "deep", "egy", "sheet"],
  ["mei", "Mei", "مي", "China", "الصين", "🇨🇳", "female", 60, "senior", "a Chinese woman around 60 with short dark wavy hair touched with grey, gentle smile", "a plum cardigan over a cream top, charcoal trousers, black flats", "zh", "Alice", "calm", "enUS", "sheet"],
  ["daniel", "Daniel", "دانيال", "Kenya", "كينيا", "🇰🇪", "male", 30, "adult", "a Kenyan man around 30, slim, with short black hair and a light goatee, big genuine smile", "a forest-green corduroy shirt over a cream T-shirt, black jeans, grey sneakers", "en", "Eric", "warm", "enUK", "sheet"],
  ["sofia", "Sofia", "صوفيا", "Argentina", "الأرجنتين", "🇦🇷", "female", 40, "adult", "an Argentine woman around 40 with wavy shoulder-length brown hair, expressive smile", "a rust-orange shirt, dark jeans, tan ankle boots", "es", "Aria", "energetic", "enUS", "sheet"],
  ["emre", "Emre", "أمره", "Turkey", "تركيا", "🇹🇷", "male", 32, "adult", "a Turkish man around 32 with tousled dark curly hair and a full short beard, relaxed smile", "a charcoal canvas jacket over a grey T-shirt, olive trousers, white sneakers", "tr", "Callum", "warm", "enUK", "sheet"],
  ["elena", "Elena", "إيلينا", "Romania", "رومانيا", "🇷🇴", "female", 72, "senior", "a Romanian grandmother around 72 with white hair in a low bun, warm grandmotherly smile", "a soft blue cardigan over a white blouse, brown trousers, black shoes", "ro", "Matilda", "calm", "enUK", "sheet"],
  ["joseph", "Joseph", "جوزيف", "Jamaica", "جامايكا", "🇯🇲", "male", 68, "senior", "a Jamaican man around 68 with short grey hair and a grey goatee, broad joyful smile", "a mustard linen short-sleeve shirt, navy trousers, brown loafers", "en", "George", "warm", "enUK", "sheet"],
  ["anika", "Anika", "أنيكا", "Germany", "ألمانيا", "🇩🇪", "female", 13, "teen", "a German girl around 13 with long light-brown hair, a hair clip and freckles, bright smile", "a teal sweatshirt, grey baggy jeans, white sneakers", "de", "Jessica", "energetic", "enUK", "sheet"],
  ["rafi", "Rafi", "رافي", "Indonesia", "إندونيسيا", "🇮🇩", "male", 11, "child", "an Indonesian boy around 11 with thick black hair, cheerful smile", "a red sweatshirt, navy trousers, grey sneakers", "id", "Liam", "energetic", "enUS", "sheet"],
  ["yazan", "Yazan", "يزن", "Jordan", "الأردن", "🇯🇴", "male", 10, "child", "an Arab boy around 10 with tousled black hair and big brown eyes, happy smile", "a teal T-shirt", "ar", "Liam", "energetic", "lev", "photo"],
  ["hana", "Hana", "هانا", "South Korea", "كوريا الجنوبية", "🇰🇷", "female", 33, "adult", "a Korean woman around 33 with straight shoulder-length dark hair, calm gentle smile", "a cream knit cardigan over a white top", "ko", "Rachel", "calm", "enUS", "photo"],
  ["saleh", "Saleh", "صالح", "Saudi Arabia", "السعودية", "🇸🇦", "male", 68, "senior", "an Arab grandfather around 68 with swept-back white hair and a short white beard, kind wise smile", "a light-blue button-up shirt", "ar", "Bill", "calm", "gulf", "photo"],
  ["rania", "Rania", "رانيا", "Lebanon", "لبنان", "🇱🇧", "female", 32, "adult", "an Arab woman around 32 with shoulder-length wavy dark-brown hair and light freckles, friendly smile", "a soft-blue pleated blouse", "ar", "Sarah", "warm", "lev", "photo"],
  ["jana", "Jana", "جنى", "Saudi Arabia", "السعودية", "🇸🇦", "female", 8, "child", "an Arab girl around 8 with long curly dark hair in two low pigtails, sweet smile", "a mustard-yellow blouse with a ruffled collar", "ar", "Jessica", "energetic", "msa", "photo"],
  ["fatima", "Fatima", "فاطمة", "Saudi Arabia", "السعودية", "🇸🇦", "female", 65, "senior", "an Arab grandmother around 65 in a soft beige hijab, warm caring smile", "a sage-green blouse", "ar", "Lily", "warm", "gulf", "photo"],
  ["faisal", "Faisal", "فيصل", "Saudi Arabia", "السعودية", "🇸🇦", "male", 27, "young", "a Saudi man around 27 with short curly dark hair, a moustache and a light beard, confident smile", "a beige linen overshirt over a white T-shirt", "ar", "Will", "warm", "najdi", "photo"],
  ["margaret", "Margaret", "مارغريت", "United Kingdom", "بريطانيا", "🇬🇧", "female", 78, "senior", "a British grandmother around 78 with short white hair and blue eyes, gentle smile", "a dusty-rose cable-knit cardigan over a floral blouse", "en", "Alice", "calm", "enUK", "photo"],
  ["zara", "Zara", "زارا", "United States", "الولايات المتحدة", "🇺🇸", "female", 12, "child", "an African-American girl around 12 with curly hair in two puffs, bright confident smile", "a lilac sweatshirt", "en", "Jessica", "energetic", "enUS", "photo"],
  ["marcus", "Marcus", "ماركوس", "United States", "الولايات المتحدة", "🇺🇸", "male", 27, "young", "an African-American man around 27 with short curly black hair, easy warm smile", "a dark-green knit sweater", "en", "Chris", "warm", "enUS", "photo"],
];
export const LANG273 = { ar: ["Arabic", "العربية"], en: ["English", "الإنجليزية"], ja: ["Japanese", "اليابانية"], pt: ["Portuguese", "البرتغالية"], hi: ["Hindi", "الهندية"], fr: ["French", "الفرنسية"],
  es: ["Spanish", "الإسبانية"], sv: ["Swedish", "السويدية"], zh: ["Chinese", "الصينية"], tr: ["Turkish", "التركية"], ro: ["Romanian", "الرومانية"], de: ["German", "الألمانية"], id: ["Indonesian", "الإندونيسية"], ko: ["Korean", "الكورية"] };
export const CAST273 = C.map(([id, en, ar, co, coAr, flag, gender, age, band, who, outfit, lang, voice, tone, dialect, kind]) => ({
  id: "cast-" + id, slug: id, name: [en, ar], country: [co, coAr], flag, gender, age, band, who, outfit, lang, kind, kid: age < 18,
  voice: { id: elVoiceId(voice) || voice, name: voice, gender, age: band, tone, dialect },
  files: kind === "sheet" ? ["face", "smile", "body", "sheet"] : ["face", "photo"] }));
const media = (c, f) => `cast273-${c.slug}-${f}.jpg`;
// copy the pictures into the media folder (once; again if one went missing)
export function ensureCast273() {
  let n = 0; try { fs.mkdirSync(MEDIA_DIR, { recursive: true }); } catch {}
  for (const c of CAST273) for (const f of c.files) { const to = path.join(MEDIA_DIR, media(c, f)), from = path.join(SRC, c.slug, f + ".jpg");
    try { if (!fs.existsSync(to) && fs.existsSync(from)) { fs.copyFileSync(from, to); n++; } } catch (e) { console.warn("cast:", e.message); } }
  return n;
}
const url = (c, f) => (c.files.includes(f) ? publicUrl(media(c, f)) : null);
/** one cast member as the page and the engines see it */
export const castView273 = (c) => ({ id: c.id, name: c.name, country: c.country, flag: c.flag, gender: c.gender, age: c.age, band: c.band, who: c.who, outfit: c.outfit, lang: c.lang,
  langName: LANG273[c.lang] || null, kid: c.kid, kind: c.kind, voice: c.voice,
  face: url(c, c.kind === "photo" ? "photo" : "face"), thumb: url(c, "face"), smile: url(c, "smile"), body: url(c, "body"), sheet: url(c, "sheet") });
export function registerCast273(app) {
  ensureCast273(); setInterval(ensureCast273, 6 * 3600e3).unref?.();
  app.get("/v1/cast", (req, res) => { res.set("Cache-Control", "public, max-age=300"); res.json({ items: CAST273.map(castView273) }); });
}
// the ready avatars list (Avatar tool, UGC presenters) gets the cast too — adults first, then the children
export const castAvatars273 = () => [...CAST273.filter((c) => !c.kid), ...CAST273.filter((c) => c.kid)].map((c) => ({ id: c.id, name: c.name, gender: c.gender,
  who: c.who + ", wearing " + c.outfit, url: url(c, "face"), cast: true, kid: c.kid, voice: c.voice }));

// the voice sample each cast member says in their own language (made once by the voice engine, kept for everyone, free)
const HELLO = { ar: "مرحباً، أنا {n}. يسعدني أن أكون صوت إعلانك القادم.", en: "Hi, I'm {n}. I'd love to be the voice of your next ad.",
  ja: "こんにちは、{n}です。あなたの次の広告の声になりたいです。", pt: "Oi, eu sou {n}. Adoraria ser a voz do seu próximo anúncio.", hi: "नमस्ते, मैं {n} हूँ। आपके अगले विज्ञापन की आवाज़ बनकर मुझे खुशी होगी।",
  fr: "Bonjour, ici {n}. Ce serait un plaisir d'être la voix de votre prochaine publicité.", es: "Hola, soy {n}. Me encantaría ser la voz de tu próximo anuncio.",
  sv: "Hej, jag heter {n}. Jag vill gärna vara rösten i din nästa reklam.", zh: "你好，我是{n}。很高兴成为你下一支广告的声音。", tr: "Merhaba, ben {n}. Bir sonraki reklamının sesi olmak isterim.",
  ro: "Bună, sunt {n}. Mi-ar plăcea să fiu vocea următoarei tale reclame.", de: "Hallo, ich bin {n}. Ich wäre gern die Stimme deiner nächsten Werbung.",
  id: "Halo, aku {n}. Aku ingin jadi suara iklanmu berikutnya.", ko: "안녕하세요, 저는 {n}입니다. 다음 광고의 목소리가 되고 싶어요." };
const FEEL = { warm: "warm", calm: "calm", energetic: "excited", deep: "serious" };
export function castLine273(id) {
  const c = CAST273.find((x) => x.id === id); if (!c) return null;
  return { voice: { id: c.voice.id, name: c.voice.name, gender: c.gender }, text: (HELLO[c.lang] || HELLO.en).replace("{n}", c.lang === "ar" ? c.name[1] : c.name[0]), lang: c.lang, emotion: FEEL[c.voice.tone] || "warm", key: c.slug };
}
