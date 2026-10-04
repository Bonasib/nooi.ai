// Text AI over the Anthropic Messages API format.
// Works with Claude (api.anthropic.com) or any Anthropic-compatible endpoint, e.g. Qwen:
//   LLM_BASE_URL=https://token-plan.maas.qwencloudapi.com/apps/anthropic
//   LLM_API_KEY=<your key>   LLM_MODEL=<model name from your Qwen console>
import { cfg } from "../lib/settings.js";
let PREF = null;
const TXT = () => { if (PREF === "claude") { const c = cfg("claude"); if (c.apiKey) return { base: "https://api.anthropic.com", key: c.apiKey, model: c.model, provider: "anthropic" }; } const q = cfg("qwentext"); if (q.apiKey) return { base: q.baseUrl || "https://token-plan.maas.qwencloudapi.com/apps/anthropic", key: q.apiKey, model: q.model, provider: "qwen" }; const c = cfg("claude"); if (c.apiKey) return { base: "https://api.anthropic.com", key: c.apiKey, model: c.model, provider: "anthropic" }; return null; };
const BASE = () => TXT()?.base || (process.env.LLM_BASE_URL || "https://api.anthropic.com").replace(/\/+$/, "").replace(/\/v1\/messages$/, "");
const KEY = () => TXT()?.key || process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY || "";
export const llmConfigured = () => !!KEY() && (!!TXT()?.model || !process.env.LLM_BASE_URL || !!process.env.LLM_MODEL || TXT()?.provider === "anthropic");
export const llmInfo = () => ({
  provider: TXT()?.provider || process.env.LLM_PROVIDER || (process.env.LLM_BASE_URL ? (/qwen/i.test(process.env.LLM_BASE_URL) ? "qwen" : "custom") : "anthropic"),
  model: TXT()?.model || process.env.LLM_MODEL || "claude-sonnet-5",
  base: BASE()
});
// Model per tier — cheap for small jobs, strongest for hard ones (story, storyboard, rare languages, site analysis)
export const modelFor = (tier) => TXT()?.model && !process.env.LLM_MODEL_FAST && !process.env.LLM_MODEL_STRONG ? TXT().model : tier === "quick" ? (process.env.LLM_MODEL_FAST || process.env.LLM_MODEL) : tier === "complex" ? (process.env.LLM_MODEL_STRONG || process.env.LLM_MODEL) : process.env.LLM_MODEL;
export async function llm(prompt, { maxTokens = 8000, system, timeoutMs = 120000, tier, images, provider } = {}) {
  PREF = provider === "claude" || provider === "qwen" ? provider : null;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(BASE() + "/v1/messages", {
      method: "POST", signal: ctl.signal,
      headers: { "x-api-key": KEY(), Authorization: "Bearer " + KEY(), "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: modelFor(tier) || llmInfo().model, max_tokens: maxTokens, ...(system ? { system } : {}), messages: [{ role: "user", content: images && images.length ? [...images.map((d) => { const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(d) || []; return { type: "image", source: { type: "base64", media_type: m[1] || "image/png", data: m[2] || "" } }; }), { type: "text", text: prompt }] : prompt }] })
    });
    const txt = await r.text(); let d; try { d = JSON.parse(txt); } catch { d = { raw: txt }; }
    if (!r.ok) throw new Error(`LLM (${llmInfo().provider}) ${r.status}: ${d.error?.message || d.message || txt.slice(0, 200)}`);
    const out = (d.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
    if (!out) throw new Error("LLM returned no text");
    return out;
  } finally { clearTimeout(t); }
}
export async function llmJson(prompt, opts) {
  const text = await llm(prompt + "\n\nRespond with only the JSON object — no prose, no code fences.", opts);
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s < 0 || e < 0) throw new Error("LLM did not return JSON");
  return JSON.parse(text.slice(s, e + 1));
}
