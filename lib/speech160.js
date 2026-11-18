// v160: the words someone says in a video keep their own language.
// What the owner saw: a prompt written in Arabic gave videos whose people spoke English. The words reached the engines in
// English — the agents write the engine's prompt in English, and the translation step (lib/v88.js) kept only lines in
// "quotes", not a line in (brackets) after a colon — and nothing told the engine which language people speak, so it spoke
// English. Now the lines someone says stay exactly as typed, in their own language and script, and every talking video says
// which language is spoken ("Everything said aloud is in Arabic, never English …"). The language comes from the lines
// themselves (their script), else from a language the words name for the speech ("يتحدث بالصينية", "speaks Russian"), else
// from the script the prompt is written in. Lines in Latin letters, and prompts in Latin letters, are left as they are.
const GROUPS = [["arabic", /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g], ["cyrillic", /[Ѐ-ӿ]/g], ["kana", /[぀-ヿ]/g],
  ["han", /[㐀-䶿一-鿿]/g], ["hangul", /[ᄀ-ᇿ가-힯]/g], ["hebrew", /[֐-׿]/g], ["devanagari", /[ऀ-ॿ]/g],
  ["thai", /[฀-๿]/g], ["greek", /[Ͱ-Ͽ]/g]];
const LATIN = /[A-Za-zÀ-ɏ]/g;
export const LANG_NAME = { ar: "Arabic", fa: "Persian", ur: "Urdu", ru: "Russian", uk: "Ukrainian", zh: "Chinese", ja: "Japanese", ko: "Korean", he: "Hebrew", hi: "Hindi",
  th: "Thai", el: "Greek", en: "English", fr: "French", es: "Spanish", de: "German", tr: "Turkish", it: "Italian", pt: "Portuguese" };
const count = (t, re) => (t.match(re) || []).length;
// the language of a piece of text from its letters (null: Latin letters, or too little to tell)
export function scriptLang(text) {
  const t = String(text || ""); let best = null, n = 0;
  for (const [g, re] of GROUPS) { const k = count(t, re); if (k > n) { n = k; best = g; } }
  if (!best || n < 2 || n < count(t, LATIN) * 0.5) return null;
  if (best === "arabic") return count(t, /[ٹڈڑںے]/g) >= 2 ? "ur" : count(t, /[پژگی]/g) >= 3 && !/ي/.test(t) ? "fa" : "ar";
  if (best === "cyrillic") return /[ієїґІЄЇҐ]/.test(t) ? "uk" : "ru";
  if (best === "han") return count(t, GROUPS[2][1]) ? "ja" : "zh";
  return { kana: "ja", hangul: "ko", hebrew: "he", devanagari: "hi", thai: "th", greek: "el" }[best] || null;
}
// the lines someone says: anything in quotes, a line in (brackets) after a colon, and "says: …" to the end of the sentence
const QUOTED = /"([^"\n]{2,400})"|“([^”\n]{2,400})”|«([^»\n]{2,400})»|„([^“”\n]{2,400})[“”]|「([^」\n]{1,400})」|『([^』\n]{1,400})』/g;
const AFTER_COLON = /[:：]\s*[(（[]([^)）\]\n]{2,400})[)）\]]/g;
const SAYS = /(?:\b(?:says?|said|saying|shouts?|whispers?|sings?|announces?|asks?|replies)\b|يقول|تقول|قال|قالت|قائلاً|قائلا|قائلة|يردد|تردد|يصرخ|تصرخ|ينادي|تنادي|يغني|تغني|يهمس|تهمس|يسأل|تسأل|говорит|сказал|сказала|кричит|поёт|шепчет|спрашивает)\s*[:：]\s*([^\n"“«„(（[]{2,300}?)(?=[.!?؟。\n]|$)/giu;
export function spokenLines(text) {
  const t = String(text || ""), out = [];
  const add = (s) => { s = String(s || "").trim(); if (s && !out.includes(s)) out.push(s); };
  for (const m of t.matchAll(QUOTED)) add(m.slice(1).find(Boolean));
  for (const m of t.matchAll(AFTER_COLON)) add(m[1]);
  for (const m of t.matchAll(SAYS)) add(m[1]);
  return out;
}
// someone in the video talks (or a line is given)
const TALKS = /\b(talks?|talking|speaks?|speaking|spoke|says?|said|saying|tells?|dialogue|conversation|interview|presenter|presents?|announces?|narrat\w*|voice[- ]?over|sings?|singing|explains?|welcomes?|greets?|shouts?|whispers?|chats?|pitch(es)?)\b|يتكلم|تتكلم|يتكلّم|تتكلّم|يتحدث|تتحدث|يتحدّث|تتحدّث|يقول|تقول|يشرح|تشرح|يرحب|ترحب|يرحّب|ترحّب|يغني|تغني|يصرخ|ينادي|يسوّق|يسوق|تسوّق|حوار|محادثة|مقابلة|يقدّم|يقدم|تقدّم|تقدم|بصوت|بلهجة|لهجة|كلام|يهمس|говорит|говорят|разговаривает|рассказывает|объясняет|поёт|кричит|диалог|интервью|приветствует/iu;
export const talks = (text) => TALKS.test(String(text || "")) || spokenLines(text).length > 0;
// a language the words name for the speech
const NAMED = [
  ["en", /\b(in|speaks?|speaking|talks?)\s+english\b|بالإنجليزي|بالانجليزي|بالإنكليزي|بالانجليزية|بالإنجليزية|باللغة الإنجليزية|باللغة الانجليزية|يتحدث الإنجليزية|يتكلم الإنجليزية|по-английски|на английском/iu],
  ["ar", /\b(in|speaks?|speaking|talks?)\s+arabic\b|بالعربية|بالعربي|باللغة العربية|يتحدث العربية|تتحدث العربية|يتكلم العربية|تتكلم العربية|по-арабски|на арабском/iu],
  ["zh", /\b(in|speaks?|speaking|talks?)\s+(chinese|mandarin)\b|بالصينية|بالصيني|باللغة الصينية|يتحدث الصينية|يتكلم الصينية|по-китайски|на китайском/iu],
  ["ru", /\b(in|speaks?|speaking|talks?)\s+russian\b|بالروسية|بالروسي|باللغة الروسية|по-русски|на русском/iu],
  ["fr", /\b(in|speaks?|speaking|talks?)\s+french\b|بالفرنسية|باللغة الفرنسية|по-французски|на французском/iu],
  ["es", /\b(in|speaks?|speaking|talks?)\s+spanish\b|بالإسبانية|بالاسبانية|باللغة الإسبانية|по-испански|на испанском/iu],
  ["tr", /\b(in|speaks?|speaking|talks?)\s+turkish\b|بالتركية|باللغة التركية|по-турецки|на турецком/iu],
  ["de", /\b(in|speaks?|speaking|talks?)\s+german\b|بالألمانية|باللغة الألمانية|по-немецки|на немецком/iu],
  ["hi", /\b(in|speaks?|speaking|talks?)\s+hindi\b|بالهندية|باللغة الهندية|на хинди/iu],
  ["ja", /\b(in|speaks?|speaking|talks?)\s+japanese\b|باليابانية|باللغة اليابانية|по-японски|на японском/iu],
  ["ko", /\b(in|speaks?|speaking|talks?)\s+korean\b|بالكورية|باللغة الكورية|по-корейски|на корейском/iu]];
const top = (list) => { const n = {}; let b = null; for (const x of list) { n[x] = (n[x] || 0) + 1; if (!b || n[x] > n[b]) b = x; } return b; };
// the language people speak: { code, name, lines } or null (nobody talks, or nothing says which language)
export function speechLang(original, final) {
  const o = String(original || ""), f = String(final || ""), lines = [...new Set([...spokenLines(o), ...spokenLines(f)])];
  const fromLines = top(lines.map(scriptLang).filter(Boolean));
  const mk = (code) => (code ? { code, name: LANG_NAME[code] || code, lines } : null);
  if (fromLines) return mk(fromLines);
  if (!talks(o) && !talks(f)) return null;
  const src = o || f, named = NAMED.filter(([, re]) => re.test(src)).map(([c]) => c), sc = scriptLang(src);
  if (named.length === 1) return mk(named[0]);
  if (named.length > 1) return mk(sc && named.includes(sc) ? sc : null);
  if (lines.length) return null;   // (the lines are in Latin letters: said as they are)
  return mk(sc);
}
// the sentence the engine reads (no "words", "text" or "written" in it: those ask lib/v88.js for on-screen text). v165: whoever
// talks blinks and moves the eyes like a person — the talking avatars' living face (lib/face165.js), in every talking video
export const SPEECH_MARK = "Everything said aloud is in";
export function speechWords(sl, prompt) {
  if (!sl || !sl.code) return "";
  const p = String(prompt || ""), own = sl.lines.filter((l) => scriptLang(l)), missing = own.filter((l) => !p.includes(l));
  return `${SPEECH_MARK} ${sl.name}${sl.code === "en" ? "" : ", never English"}${missing.length ? ": " + missing.map((l) => `"${l}"`).join(" ") + " —" : ";"}${own.length ? " the quoted lines are spoken exactly as quoted," : ""} lips in sync, natural blinking and living eyes (never a fixed stare), with the accent, tone, expressions and gestures described.`;
}
export function withSpeech(prompt, original) {
  const p = String(prompt || ""); if (!p.trim() || p.includes(SPEECH_MARK)) return p;
  const w = speechWords(speechLang(original, p), p); if (!w) return p;
  return p.replace(/[\s.]*$/, ".") + "\n" + w;
}
// the agents' rule: lines stay as typed, the language and accent are said in English, a talking person with no lines given
// gets one or two short ones in the spoken language
export function speechRule(brief) {
  const sl = speechLang(brief, "");
  return `
- Speech: words someone says aloud (dialogue, a slogan, a song) stay exactly as the client typed them — the same language and script, never translated — inside double quotes, in the request, the prompt and every shot. Say in English who says them, in which language, and with the accent, tone, expressions and gestures the brief asks for (e.g. He says in Arabic with a light Chinese accent, excited, smiling and gesturing: "…").
- ${sl ? `People in this video speak ${sl.name}` : "People speak the language the brief asks for, else the language it is written in"} — never English unless the brief asks for English. If someone talks but the brief gives no lines, write one or two short natural lines for them in that language, in its own script, in quotes.`;
}
