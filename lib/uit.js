// Shared interface translations. The UI asks for a language once; the platform's text AI translates the
// missing strings and the result is kept for every visitor — signed in or not, nobody's credits are used.
//   GET  /v1/ui-t/:lang            → { t: { "English": "translation", … } }  shipped files + shared cache
//   POST /v1/ui-t/:lang {strings}  → { t: [ … ] } in the same order ("" = not available yet)
// Abuse limits: only strings that appear word for word in public/index.html are translated (no free
// translation service), at most 210 per call, a per-IP rate limit, one in-flight translation per string.
import fs from "fs";
import path from "path";
import { llmJson, llmConfigured } from "../providers/anthropic.js";

const FILE = path.resolve(process.env.UI_T_FILE || "data/ui-t.json"), SEED = path.resolve("public/i18n"), SRC = path.resolve("public/index.html");
export const UI_LANG_NAMES = { fr: "French", es: "Spanish", de: "German", it: "Italian", pt: "Portuguese", nl: "Dutch", tr: "Turkish", ru: "Russian", ja: "Japanese", zh: "Chinese (Simplified)", ko: "Korean", hi: "Hindi", th: "Thai", ta: "Tamil", fa: "Persian", ckb: "Kurdish (Sorani, Arabic script)", ku: "Kurdish (Kurmanji, Latin script)", sr: "Serbian (Cyrillic)", sh: "Croatian / Bosnian (Latin script)", fil: "Filipino", ms: "Malay", so: "Somali", sw: "Swahili", am: "Amharic" };

let cache = {}; try { cache = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch {}
let t = null;
const save = () => { clearTimeout(t); t = setTimeout(() => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE + ".tmp", JSON.stringify(cache)); fs.renameSync(FILE + ".tmp", FILE); }, 500); };

const seeds = {};
function seed(lang) {
  if (seeds[lang] === undefined) { try { seeds[lang] = JSON.parse(fs.readFileSync(path.join(SEED, lang + ".json"), "utf8")); } catch { seeds[lang] = {}; } }
  return seeds[lang];
}
let src = { mtime: 0, text: "" };
function source() {
  try { const m = fs.statSync(SRC).mtimeMs; if (m !== src.mtime) src = { mtime: m, text: fs.readFileSync(SRC, "utf8") }; } catch {}
  return src.text;
}
// A string is translatable only if the shipped UI contains it (as written, or with JS string escaping).
const known = (s) => { const x = source(); return x.includes(s) || x.includes(s.replace(/"/g, '\\"')) || x.includes(s.replace(/'/g, "\\'")); };

export const uiLang = (l) => (Object.hasOwn(UI_LANG_NAMES, l) ? l : null);
export function uiDict(lang) { return { ...(cache[lang] || {}), ...seed(lang) }; }

const hits = new Map();
export function rateOk(ip) {
  const now = Date.now(), h = hits.get(ip) || { n: 0, at: now };
  if (now - h.at > 10 * 60e3) { h.n = 0; h.at = now; }
  h.n++; hits.set(ip, h);
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v.at > 10 * 60e3) hits.delete(k);
  return h.n <= 60;
}

const inflight = new Map();
async function translate(lang, items) {
  const name = UI_LANG_NAMES[lang];
  const q = `Translate these user-interface strings of an AI video studio app from English into ${name} (${lang}).\nRules: short, natural UI wording; keep brand and model names (nooi.ai, WAN, Kling, Veo, Seedance, ElevenLabs, TikTok, Instagram, YouTube, SRT, VTT, UGC, POV, FPV, MCP, API, 4K) unchanged; keep numbers and symbols (×, ·, →, %, +, …); no quotes or explanations; one output per input, same order.\nSTRINGS:\n${JSON.stringify(items)}\nReturn ONLY JSON: {"t":["..."]}`;
  const out = await llmJson(q, { maxTokens: 6000, tier: "default" });
  const arr = Array.isArray(out?.t) ? out.t : [];
  cache[lang] = cache[lang] || {};
  items.forEach((s, i) => { const v = arr[i]; if (typeof v === "string" && v.trim() && v.length < 1200) cache[lang][s] = v.replace(/"/g, "”").replace(/[<>]/g, "").trim(); });
  save();
}

export async function uiTranslate(lang, strings) {
  const list = (Array.isArray(strings) ? strings : []).filter((s) => typeof s === "string").map((s) => s.trim()).filter((s) => s && s.length < 500 && /[A-Za-z]/.test(s)).slice(0, 210);
  const dict = uiDict(lang);
  const missing = [...new Set(list.filter((s) => dict[s] == null && known(s)))];
  if (missing.length) {
    if (!llmConfigured()) throw Object.assign(new Error("Interface translation needs the text AI (Admin → AI providers)"), { code: 501 });
    const todo = missing.filter((s) => !inflight.has(lang + "\u0000" + s)), waits = missing.map((s) => inflight.get(lang + "\u0000" + s)).filter(Boolean);
    const jobs = [];
    for (let i = 0; i < todo.length; i += 70) {
      const b = todo.slice(i, i + 70), p = translate(lang, b).catch(() => {}).finally(() => b.forEach((s) => inflight.delete(lang + "\u0000" + s)));
      b.forEach((s) => inflight.set(lang + "\u0000" + s, p)); jobs.push(p);
    }
    await Promise.all([...jobs, ...waits]);
  }
  const d = uiDict(lang);
  return list.map((s) => d[s] || "");
}
