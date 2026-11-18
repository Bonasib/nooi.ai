// v129: one place for the site's own Claude calls (official SDK @anthropic-ai/sdk): the key, the client, and a JSON answer to
// words and pictures in a fixed shape (structured output). Used by the content check (v126) and the text AI look of Replace the
// person / Make it move (v129: Claude Haiku 5.5 answers in a few seconds where the old chain hit its 15 s limit).
// Key: Admin → AI providers → Claude, else ANTHROPIC_API_KEY (never Qwen's key, which goes to another address).
import Anthropic from "@anthropic-ai/sdk";
import { col, save } from "./store.js";
import { cfg, S as platformS } from "./settings.js";

export const HAIKU = "claude-haiku-5-5";
const USD_IN = 0.10 / 1e6, USD_OUT = 0.50 / 1e6;   // Haiku 5.5, per token (prompts up to 100K tokens)
export const claudeKey = () => cfg("claude").apiKey || process.env.ANTHROPIC_API_KEY || (!process.env.LLM_BASE_URL && process.env.LLM_API_KEY) || "";
const CL = new Map();
export function claudeClient(timeoutMs = 15000) {
  const k = claudeKey(), id = k + "|" + timeoutMs; let c = CL.get(id);
  if (!c) { if (CL.size > 8) CL.clear(); c = new Anthropic({ apiKey: k, timeout: timeoutMs, maxRetries: 1 }); CL.set(id, c); }
  return c;
}
// a data: URL or {type, media_type, data} / {type:"url"} → an image block
const imageBlock = (src) => {
  if (src && typeof src === "object") return { type: "image", source: src };
  const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/.exec(String(src || "")); return m ? { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } } : null;
};
// → { data, usd, ms }; throws on no answer (a refusal is { refused: true })
export async function claudeJSON({ text, images = [], schema, system, effort = "low", maxTokens = 1024, timeoutMs = 15000, model = HAIKU }) {
  const t0 = Date.now();
  const r = await claudeClient(timeoutMs).messages.create({
    model, max_tokens: maxTokens, ...(system ? { system } : {}),
    output_config: { effort, format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: [...images.map(imageBlock).filter(Boolean), { type: "text", text }] }],
  });
  const usd = (r.usage?.input_tokens || 0) * USD_IN + (r.usage?.output_tokens || 0) * USD_OUT, ms = Date.now() - t0;
  if (r.stop_reason === "refusal") return { refused: true, usd, ms };
  const t = (r.content || []).find((b) => b.type === "text");
  if (!t || r.stop_reason === "max_tokens") throw Object.assign(new Error("Claude gave no answer (" + r.stop_reason + ")"), { usd, ms });
  return { data: JSON.parse(t.text), usd, ms };
}

// ---- the text AI look (v129): Claude or the site's text AI chain (Admin → Speed), and what it cost
const lookConf = () => { const s = platformS(); return (s.look129 = s.look129 || { by: "claude" }); };
export const lookByClaude = () => lookConf().by !== "chain" && !!claudeKey();
export function setLookBy(by) { lookConf().by = by === "chain" ? "chain" : "claude"; save(); return lookInfo(); }
const today = () => new Date().toISOString().slice(0, 10);
export function noteLook(ok, usd = 0, ms = 0) {
  const c = col("claude129", { days: {} }), d = (c.days[today()] = c.days[today()] || { looks: 0, fails: 0, usd: 0, ms: 0 });
  if (ok) { d.looks++; d.ms += ms; } else d.fails++;
  d.usd = +(d.usd + usd).toFixed(6);
  const k = Object.keys(c.days).sort(); while (k.length > 31) delete c.days[k.shift()];
}
export function lookInfo() {
  const c = col("claude129", { days: {} }), from = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  const w = Object.entries(c.days).filter(([k]) => k >= from).reduce((a, [, x]) => ({ looks: a.looks + x.looks, fails: a.fails + x.fails, usd: +(a.usd + x.usd).toFixed(6), ms: a.ms + x.ms }), { looks: 0, fails: 0, usd: 0, ms: 0 });
  return { by: lookConf().by === "chain" ? "chain" : "claude", ready: !!claudeKey(), model: "Claude Haiku 5.5", week: { looks: w.looks, fails: w.fails, usd: w.usd, avgSec: w.looks ? Math.round(w.ms / w.looks / 100) / 10 : null }, estimate: { perLook: 0.0005, perSwap: 0.002 } };
}
