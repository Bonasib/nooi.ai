// v209 — the reactions in a dubbed line: a laugh, a sigh, a gasp, a chuckle, crying, a whisper. The original speaker laughed; the
// dubbed voice laughs at the same place, in every language. The translator is asked to keep them as audio tags ([laughs] …,
// always in English: the voice engine reads them, they are never said); when it forgets, the reaction the original shows is put
// back at the start of the line. ElevenLabs v3 performs the tags; every other voice drops them (lib/voice.js stripTags).
// Pure: no server state, no network.

// what each reaction looks like in the words people write and the transcripts give (English, Arabic, and the common forms)
const CUES209 = [
  ["laughs", /\b(?:ha(?:ha)+|hehe+|lol|lmao|haha)\b|ه{3,}|خخخ+|😂|🤣|\((?:laughs?|laughing)\)|\[(?:laughs?|laughing)\]|\b(?:jaja(?:ja)*|kkk+|wkwk+|mdr|5555+)\b/iu],
  ["chuckles", /\((?:chuckles?|giggles?)\)|\[(?:chuckles?|giggles?)\]/iu],
  ["sighs", /\((?:sighs?)\)|\[(?:sighs?)\]|\b(?:sigh|ugh|phew)\b|^\s*(?:آه+|اوف+|أوف+)(?=\s|$|[،,.!؟?])/iu],
  ["gasps", /\((?:gasps?)\)|\[(?:gasps?)\]|\b(?:gasp|whoa)\b|يا ?إلهي|يا ?الله/iu],
  ["crying", /\((?:cries|crying|sobs?)\)|\[(?:cries|crying|sobs?)\]|😭|\b(?:sob)\b/iu],
  ["whispers", /\((?:whispers?|whispering)\)|\[(?:whispers?|whispering)\]/iu],
  ["clears throat", /\((?:clears throat|coughs?)\)|\[(?:clears throat|coughs?)\]/iu],
];
export const TAGS209 = CUES209.map((c) => c[0]);
// the reactions a line shows (strongest first, at most two)
export function reactions209(text) {
  const t = String(text || ""), out = [];
  for (const [tag, re] of CUES209) if (re.test(t) && !out.includes(tag)) out.push(tag);
  return out.slice(0, 2);
}
// the tags already in a line ("[laughs] …")
export const tagsIn209 = (t) => [...String(t || "").matchAll(/\[([a-z][a-z ]{1,24})\]/gi)].map((m) => m[1].toLowerCase());
// the dubbed line keeps the original's reactions: missing ones go first ("[laughs] …"); text-only laughs ("hahaha", "ههههه")
// in the dubbed line become the tag too, so the voice laughs instead of reading "ha ha ha"
export function keepReactions209(src, dub) {
  let d = String(dub || "").trim(); const want = reactions209(src); if (!d) return d;
  if (/\b(?:ha(?:ha)+|hehe+)\b|ه{3,}|خخخ+/iu.test(d)) { d = d.replace(/\b(?:ha(?:ha)+|hehe+)\b|ه{3,}|خخخ+/giu, "").replace(/\s{2,}/g, " ").trim(); if (!tagsIn209(d).includes("laughs")) d = "[laughs] " + d; }
  const have = tagsIn209(d), add = want.filter((t) => !have.includes(t));
  return (add.length ? add.map((t) => "[" + t + "]").join(" ") + " " : "") + d;
}
// the rule the translator gets (one line, in English)
export const REACT_RULE209 = "- keep every non-verbal reaction of the original where it happens — a laugh, a chuckle, a sigh, a gasp, crying, a whisper, clearing the throat — as an audio tag in square brackets, always in English: [laughs], [chuckles], [sighs], [gasps], [crying], [whispers], [clears throat]; written laughter (hahaha, ههههه, jajaja) becomes [laughs]; never invent a reaction the original does not have";
