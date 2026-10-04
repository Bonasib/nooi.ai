// Website analysis: read the homepage + up to 5 inner pages, then ask Claude for a brand profile + content plan.
import * as cheerio from "cheerio";
import { llmJson } from "../providers/anthropic.js";
const UA = "Mozilla/5.0 (compatible; NooiStudio/1.0; +https://nooi.ai)";
async function get(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
  try { const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ar,en;q=0.8" }, signal: ctl.signal, redirect: "follow" }); if (!r.ok) return null; return await r.text(); } catch { return null; } finally { clearTimeout(t); }
}
function extract(html, base) {
  const $ = cheerio.load(html); $("script,noscript,svg,iframe").remove();
  const colors = {}; const css = $("style").text() + " " + $("[style]").map((_, e) => $(e).attr("style")).get().join(" ");
  (css.match(/#[0-9a-f]{6}\b/gi) || []).forEach((c) => { c = c.toLowerCase(); if (!["#ffffff", "#000000"].includes(c)) colors[c] = (colors[c] || 0) + 1; });
  const theme = $('meta[name="theme-color"]').attr("content");
  const links = new Set(); $("a[href]").each((_, a) => { try { const u = new URL($(a).attr("href"), base); if (u.host === new URL(base).host && !/\.(jpg|png|pdf|zip)$/i.test(u.pathname)) links.add(u.origin + u.pathname); } catch {} });
  return {
    title: $("title").text().trim(), description: $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content") || "",
    headings: $("h1,h2,h3").map((_, e) => $(e).text().trim()).get().filter(Boolean).slice(0, 40),
    text: $("main,article,section,body").first().text().replace(/\s+/g, " ").trim().slice(0, 6000),
    colors: [theme, ...Object.entries(colors).sort((a, b) => b[1] - a[1]).map((x) => x[0])].filter(Boolean).slice(0, 6), links: [...links]
  };
}
export async function analyzeSite({ url, notes = "", goals = [], platforms = [], language = "ar", count = 8, days = 14 }) {
  let site = null;
  if (url) {
    const home = await get(url);
    if (home) {
      site = extract(home, url);
      const pick = site.links.filter((l) => /about|service|product|tour|package|offer|contact|من-نحن|خدمات|عروض|باقات/i.test(decodeURIComponent(l))).slice(0, 5);
      for (const l of pick) { const h = await get(l); if (h) { const e = extract(h, l); site.text += "\n\n[" + l + "] " + e.headings.join(" | ") + " — " + e.text.slice(0, 2500); } }
      site.text = site.text.slice(0, 16000);
    }
  }
  const lang = language === "ar" ? "Arabic (Modern Standard Arabic, natural social tone)" : language === "en" ? "English" : "both Arabic and English (Arabic first, then English on a new line)";
  const prompt = `You are a senior social media strategist. Build a brand profile and a content plan.

WEBSITE: ${url || "(none)"}
${site ? `TITLE: ${site.title}\nDESCRIPTION: ${site.description}\nHEADINGS: ${site.headings.join(" | ")}\nCOLORS FOUND: ${site.colors.join(", ")}\nPAGE TEXT:\n${site.text}` : "(website could not be read)"}
OWNER NOTES:\n${notes || "(none)"}
GOALS: ${goals.join(", ")}
PLATFORMS: ${platforms.join(", ")}

Use only facts from the website and notes. Never invent prices, addresses or claims — use placeholders like [price].
Write exactly ${count} posts spread over ${days} days, mixing formats (reel, post, carousel, story) and rotating platforms from the list. Scroll-stopping hooks, ready-to-post captions with a clear call to action. "visual" = a concrete English prompt for an AI video/image generator. All other text in ${lang}.
Return JSON: {"profile":{"brand":"","summary":"","audience":"","tone":"","pillars":[""],"offerings":[""],"colors":["#hex"],"hashtags":["#"],"best_times":{"platform":["HH:MM"]}},"plan":[{"day":1,"platform":"","format":"reel|post|carousel|story","title":"","hook":"","caption":"","hashtags":["#"],"visual":"","cta":""}]}`;
  const out = await llmJson(prompt, { maxTokens: 12000, tier: "complex" });
  if (site && out.profile && (!out.profile.colors || !out.profile.colors.length)) out.profile.colors = site.colors;
  return out;
}
