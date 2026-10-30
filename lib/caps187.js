// v187: what each video engine can really make — the resolutions it takes and whether it makes sound — in one table the page reads
// (/v1/config.registry[id].res / .audio) for the prompt box's settings sheet, and the server checks before a job is sent:
//   · res   — the resolutions (the page's spelling) the engine is asked for; a job asking for another one gets the nearest (the
//             engine's own spelling is chosen in providers/kie.js pickRes / providers/minimax183.js)
//   · audio — false: makes silent videos (the Sound switch is off and can't be turned on) · true: sound on request (meta.audio is
//             sent) · "always": the engine always makes sound
// And slow motion is no longer a button: words like "slow motion", "slow-mo", "سلو موشن", "حركة بطيئة", "تصوير بطيء" in a video's
// prompt turn it on (lib/slowmo163.js makes it on this server — the engine is asked for real-time action, the words are taken out of
// what it receives, so it isn't slowed twice). The editor's speed tool (0.5× / 0.25×) still makes its own (v168).
import { jobHooks } from "./jobs.js";
import { SLOW163, SLOW_WORDS163 } from "./slowmo163.js";
import { CAPS187 } from "./models.js";   // (the table itself, with the names)
export { CAPS187 };

export const caps187 = (id) => CAPS187[id] || null;
const ORDER = ["360P", "480P", "540P", "720P", "768P", "1080P", "2K", "4K"], rank = (r) => ORDER.indexOf(String(r || "").toUpperCase());
// the nearest resolution the engine takes (a tie goes to the higher one)
export function nearRes187(list, want) {
  const w = rank(want); if (!list || !list.length || w < 0) return list && list[0];
  return list.slice().sort((a, b) => Math.abs(rank(a) - w) - Math.abs(rank(b) - w) || rank(b) - rank(a))[0];
}

// slow motion from the words (English and Arabic): which speed, and the words taken out for the engine
const SLOW_RE187 = /\b(?:(?:super|ultra|very)[-\s]?)?slow[-\s]?(?:motion|mo)\b|\b(?:super|ultra)[-\s]?slow\b|\bslowmo\b|سلو\s*موشن|(?:بال|ب)?حركة\s+(?:ال)?بطيئة(?:\s+جداً|\s+جدا)?|تصوير\s+بطيء(?:\s+جداً|\s+جدا)?/gi;
export function slowWords187(text) {
  const t = String(text || ""), m = t.match(SLOW_RE187); if (!m) return null;
  const w = m.join(" ");   // "slow motion" → 0.5× · "super / very slow", "… جداً" → 0.25× · "ultra slow" → 0.125×
  return /ultra/i.test(w) ? "ultra" : /super|very|جد/i.test(w) ? "super" : "slow";
}
export const stripSlow187 = (text) => String(text || "").replace(SLOW_RE187, " ").replace(/\s*,\s*,/g, ",").replace(/(^|\s+)(?:in|with|at|on|في)\s*(?=[,،.]|$)/gi, "").replace(/\s+([,،.])/g, "$1").replace(/^[\s,،.]+|[\s,،]+$/g, "").replace(/\s{2,}/g, " ").trim();

// (first of all the steps: a silent engine's job is a silent job for every step after — e.g. no "spoken in…" line in its words)
jobHooks.before.unshift(async (u, body) => {
  if (body?.kind !== "video") return;
  const m = (body.meta = body.meta || {}), cap = caps187(body.model);
  if (m.slow163 === "off") m.slowOff187 = true;                     // (a job that says "no slow motion" keeps its words as they are)
  if (!cap) return;
  if (cap.audio === false) m.audio = false;                         // a silent engine: no sound asked of it
  else if (cap.audio === "always" && m.audio == null) m.audio = true;
  if (m.res && !cap.res.some((r) => r.toUpperCase() === String(m.res).toUpperCase())) m.res = nearRes187(cap.res, m.res);
});
// (after the words are put in English)
jobHooks.before.push(async (u, body) => {
  if (body?.kind !== "video") return;
  const m = (body.meta = body.meta || {});
  // slow motion asked for in the words (unless the job already says, or it is a film shown part by part)
  if (m.slow163 == null && !m.slowOff187 && !(+m.parts > 1 && !m.long132) && !m.slowWords187) {
    const k = slowWords187(body.prompt);
    if (k && SLOW163[k]) { m.slow163 = k; m.slowWords187 = true; const bare = stripSlow187(body.prompt);
      body.prompt = (bare || String(body.prompt || "")).replace(/[.\s]*$/, "") + ". " + SLOW_WORDS163; }
  }
});
