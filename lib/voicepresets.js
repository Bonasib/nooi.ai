// v97: the Voice page's ten example voices (VOICE_PRESETS in the page) each get one real voice of the voice engine and a line
// in their own dialect. "Hear" played them with the device's built-in speech, which on most phones and computers has no
// Arabic voice — so nothing was heard. Now the example is made once by the voice engine, kept on the server and free for
// everyone after; "Generate" with that voice picked uses the same engine voice, so what you hear is what you get.
// (No imports: providers/kie.js and lib/localize.js both read it.)
//   id: [engine voice id, English name, Arabic name, dialect, gender, delivery, age]   — delivery is a lib/voice.js DELIVERY key
export const PRESET_VOICES = {
  v1: ["nPczCjzI2devNBz1zQrb", "Abu Fahad", "أبو فهد", "najdi", "male", "serious", "mid"],   // Brian: deep, middle-aged
  v2: ["EXAVITQu4vr4xnSDxMaL", "Noura", "نورة", "najdi", "female", "warm", "young"],          // Sarah: soft, young
  v3: ["onwK4e9ZLuTAKqWW03F9", "Documentary narrator", "راوي وثائقي", "msa", "male", "serious", "adult"], // Daniel: clear narrator
  v4: ["FGY2WhTYpPnrIDTdsKH5", "Layan", "ليان", "hijazi", "female", "excited", "teen"],       // Laura: upbeat, young
  v5: ["pqHfZKP75CvOlQylNhV4", "Grandpa Saad", "الجد سعد", "gulf", "male", "calm", "senior"],  // Bill: older, trustworthy
  v6: ["9BWtsMINqrJLrRacOk9x", "Salma", "سلمى", "egy", "female", "excited", "adult"],         // Aria: expressive
  v7: ["TX3LPaxmHKxFdv7VOQHJ", "Yousef", "يوسف", "msa", "male", "excited", "child"],          // Liam: young, energetic
  v8: ["XrExE9yKIg1WjnnlVkGX", "Ava", "Ava", "enUS", "female", "warm", "young"],             // Matilda: friendly
  v9: ["JBFqnCBsd6RMkjVDRZzb", "Arthur", "Arthur", "enUK", "male", "serious", "senior"],      // George: warm British storyteller
  v10: ["cgSgspJ2msm6clMCkdW9", "Rana", "رنا", "lev", "female", "excited", "young"],         // Jessica: expressive, young
};
// a line in each dialect ({n} = the voice's name), so the example also shows how the dialect sounds
export const DIALECT_LINE = {
  msa: "مرحباً، أنا {n}. كل وصف تكتبه يصبح فيلماً، هيا نبدأ الحكاية.",
  najdi: "هلا والله، أنا {n}. وش رايك نبدأ القصة سوا؟",
  hijazi: "أهلين، أنا {n}. يلا نبدأ الحكاية مع بعض.",
  gulf: "هلا فيكم، أنا {n}. خلونا نبدأ السالفة من أولها.",
  egy: "أهلاً، أنا {n}. يلا بينا نبدأ الحكاية سوا.",
  lev: "مرحبا، أنا {n}. يلا نبلّش القصة سوا.",
  enUS: "Hi, I'm {n}. Every prompt becomes a film — let's begin.",
  enUK: "Hello, I'm {n}. Every prompt becomes a film — shall we begin?",
};
export function presetLine(id) {
  const p = PRESET_VOICES[id]; if (!p) return null;
  const en = /^en/.test(p[3]);
  return { voice: { id: p[0], name: p[1], gender: p[4] }, text: (DIALECT_LINE[p[3]] || DIALECT_LINE.msa).replace("{n}", en ? p[1] : p[2]), lang: en ? "en" : "ar", emotion: p[5], dialect: p[3] };
}
// the engine voice for a Voice page job: the picked example's voice, unless its gender or age was changed after picking
export function presetVoiceId(meta) {
  const p = meta && PRESET_VOICES[meta.preset]; return p && (!meta.gender || meta.gender === p[4]) && (!meta.age || meta.age === p[6]) ? p[0] : null;
}
