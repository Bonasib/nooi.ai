// v149: for the editor —
//  · captions translated on the server when the page can't do it on the device: numbered lines in, the same numbered lines out
//    (a reply that misses lines is asked again; a long list goes in parts), free (the quick text AI), any text AI that is set up
//    (the site's own, NVIDIA, Claude / Qwen — each takes over when the one before fails)
//      POST /v1/translate149 {lines:[…], to:"ar", from?:"en"} → {lines:[…]}
//  · the price of voices & sound for every clip of an edit (each clip a part of its file; the sounds come back as separate
//    tracks), worked out from the clips' lengths before anything is uploaded
//      POST /v1/sound149/quote {parts:[{len}], want, who, lipsync, lang} → {total, missing}
import { llm, llmConfigured } from "../providers/anthropic.js";
import { clean134, quote134, ready134 } from "./sound134.js";

export const LANGS149 = { ar: "Arabic", en: "English", fr: "French", es: "Spanish", tr: "Turkish", ur: "Urdu", hi: "Hindi", id: "Indonesian", de: "German", zh: "Chinese (Simplified)",
  ru: "Russian", pt: "Portuguese", it: "Italian", ja: "Japanese", ko: "Korean", fa: "Persian", nl: "Dutch", bn: "Bengali", ms: "Malay", sw: "Swahili" };
const bad = (en, ar, code = 400) => Object.assign(new Error(en), { code, errorAr: ar });

// "3| text" (or "3. text", "3) text", "3: text") → {3: "text"}; a JSON list is read too
export function parse149(out, n) {
  const got = {};
  for (const ln of String(out || "").split(/\r?\n/)) { const m = /^\s*(?:\*\*)?(\d{1,4})(?:\*\*)?\s*[|:.)\-–]\s*(.*)$/.exec(ln); if (m && +m[1] >= 1 && +m[1] <= n && !(m[1] in got)) got[m[1]] = m[2].trim(); }
  if (Object.keys(got).length < n) { try { const s = out.indexOf("{"), e = out.lastIndexOf("}"); const j = JSON.parse(out.slice(s, e + 1)); if (Array.isArray(j.lines) && j.lines.length >= n) j.lines.slice(0, n).forEach((t, i) => { if (!((i + 1) in got)) got[i + 1] = String(t || "").trim(); }); } catch {} }
  return got;
}
async function part149(lines, to, from) {
  const ask = `Translate each numbered line into ${LANGS149[to]}${from && LANGS149[from] && from !== to ? ` (the lines are in ${LANGS149[from]})` : ""}. They are video subtitles: natural and short, the way people really speak; keep names, brands and numbers as they are. Answer with exactly ${lines.length} lines, each one starting with its number and "|", and nothing else.\n\n` +
    lines.map((l, i) => `${i + 1}| ${String(l).replace(/\s+/g, " ").trim()}`).join("\n");
  let last = null, got = {};
  for (let k = 0; k < 2; k++) {
    try { const out = await llm(ask + (k ? "\n\nEvery number from 1 to " + lines.length + " must be in your answer." : ""), { maxTokens: Math.min(8000, 300 + lines.join(" ").length * 4), tier: "quick", timeoutMs: 60000 });
      const g = parse149(out, lines.length); for (const [i, t] of Object.entries(g)) if (t && !got[i]) got[i] = t; if (Object.keys(got).length >= lines.length) break; }
    catch (e) { last = e; }
  }
  if (!Object.keys(got).length) throw last || new Error("no lines came back");
  // (a line still missing after the second answer keeps its own words — better than none)
  return lines.map((l, i) => got[i + 1] || l);
}
export async function translate149(lines, to, from) {
  if (!LANGS149[to]) throw bad("That language isn't offered yet.", "هذه اللغة غير متاحة بعد.");
  const L = (Array.isArray(lines) ? lines : []).map((x) => String(x || "").slice(0, 400)).slice(0, 1200);
  if (!L.length) throw bad("Nothing to translate.", "لا يوجد ما يُترجم.");
  const out = [];
  for (let i = 0; i < L.length; i += 60) out.push(...(await part149(L.slice(i, i + 60), to, from)));
  return out;
}

export function registerEdit149(app, requireUser, isStaff) {
  app.post("/v1/translate149", requireUser, async (req, res) => {
    const b = req.body || {};
    if (!llmConfigured()) return res.status(503).json({ error: "Translation on the server isn't set up — translate on this device instead.", errorAr: "الترجمة على الخادم غير مهيأة — ترجم على هذا الجهاز بدلاً من ذلك." });
    try { res.json({ lines: await translate149(b.lines, String(b.to || ""), String(b.from || "")), by: "server" }); }
    catch (e) { if (e.code) return res.status(e.code).json({ error: e.message, errorAr: e.errorAr });
      console.warn("translate149:", String(e.message || e).slice(0, 200));
      res.status(503).json({ error: "The server's translation isn't answering right now — try again in a minute.", errorAr: "ترجمة الخادم لا تستجيب الآن — حاول مجدداً بعد دقيقة.", ...(isStaff(req.user) ? { detail: String(e.message || e).slice(0, 300) } : {}) }); }
  });
  app.post("/v1/sound149/quote", requireUser, (req, res) => {
    const b = req.body || {}, parts = (Array.isArray(b.parts) ? b.parts : []).slice(0, 20); let total = 0; const missing = new Set();
    for (const p of parts) { const len = Math.max(0.5, Math.min(600, +p.len || 0)), c = clean134({ ...b, scope: "shot", from: 0, to: len, stems: true }, len); total += quote134(c).total; ready134(c).forEach((m) => missing.add(m)); }
    res.json({ total: isStaff(req.user) ? 0 : total, missing: [...missing], parts: parts.length });
  });
}
