// Your own text AI — two ways, both optional:
// 1. Gemma 4 on Google's Gemini API (Admin → AI providers → "Gemma 4 · Google AI Studio", or GEMMA_API_KEY / GEMMA_MODEL):
//    Google runs the model, nothing runs on your server. Google's own request (…/v1beta/models/<model>:generateContent) with
//    the key in the x-goog-api-key header, never in the address. gemma-4-26b-a4b-it (fast, the default) or gemma-4-31b-it
//    (the strongest). The system text goes in front of the request (Gemma takes no separate system instruction), thinking
//    parts are skipped, pictures go along as inline data (Gemma 4 reads pictures). No key of its own → the Google key saved
//    for Nano Banana is used once a model is typed. use=off switches it off without deleting the key.
// 2. Any OpenAI-compatible chat endpoint: Gemma on your server with Ollama
//      LOCAL_LLM_URL=http://127.0.0.1:11434/v1  LOCAL_LLM_MODEL=gemma4:e4b
//    (a Google address here — generativelanguage.googleapis.com, with or without /openai — takes Google's own route too).
// When one is set the site's text tasks run on it first (Gemma on Google before your own server), and NVIDIA / Claude / Qwen
// take over if it fails. Admin → AI providers → "Compare text AIs" (lib/llmcheck.js) scores it against the current text AI
// on nooi's own tasks before you rely on it.
import { cfg, configured } from "../lib/settings.js";
const GOOGLE = "https://generativelanguage.googleapis.com/v1beta";
export const GEMMA_DEFAULT = "gemma-4-26b-a4b-it";
const isGoogle = (u) => /generativelanguage\.googleapis\.com/i.test(String(u || ""));
const gemmaOn = () => configured("gemma") && !/^(off|no|false|0)$/i.test(String(cfg("gemma").use || "").trim());
// which text AI answers and how: { google: true, base, model, key, thinking } or { google: false, base, model, key }
function route() {
  if (gemmaOn()) { const c = cfg("gemma"); return { google: true, base: String(c.baseUrl || GOOGLE).replace(/\/+$/, ""), model: c.model || GEMMA_DEFAULT, key: c.apiKey || cfg("google").apiKey || "", thinking: c.thinking }; }
  const c = cfg("localtext"), base = String(c.baseUrl || "").replace(/\/+$/, "").replace(/\/chat\/completions$/, "");
  if (isGoogle(base)) return { google: true, base: base.replace(/\/openai$/, "").replace(/\/models.*$/, ""), model: c.model, key: c.apiKey || cfg("google").apiKey || "", thinking: c.thinking };
  return { google: false, base, model: c.model, key: c.apiKey || "" };
}
export const localOn = () => gemmaOn() || configured("localtext");
export const localVision = () => { if (!localOn()) return false; const r = route(); return r.google || !!cfg("localtext").vision; };
export const localInfo = () => { const r = route(); return { provider: r.google ? "google" : "local", model: String(r.model || "").replace(/^models\//, ""), base: r.base }; };
export async function localChat(prompt, { system, maxTokens = 2000, timeoutMs = 120000, images } = {}) {
  const r = route(), ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeoutMs);
  try { return r.google ? await googleChat(r, prompt, { system, maxTokens, images, signal: ctl.signal }) : await openaiChat(r, prompt, { system, maxTokens, images, signal: ctl.signal }); }
  finally { clearTimeout(t); }
}
async function openaiChat(r, prompt, { system, maxTokens, images, signal }) {
  const content = images && images.length ? [{ type: "text", text: prompt }, ...images.map((u) => ({ type: "image_url", image_url: { url: u } }))] : prompt;
  const res = await fetch(r.base + "/chat/completions", { method: "POST", signal, headers: { "content-type": "application/json", ...(r.key ? { Authorization: "Bearer " + r.key } : {}) },
    body: JSON.stringify({ model: r.model, messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content }], max_tokens: maxTokens, temperature: 0.3, stream: false }) });
  const txt = await res.text(); let d; try { d = JSON.parse(txt); } catch { d = { raw: txt }; }
  if (!res.ok) throw new Error(`Local text AI ${res.status}: ${d.error?.message || d.message || txt.slice(0, 200)}`);
  const out = d.choices?.[0]?.message?.content;
  if (!out) throw new Error("Local text AI returned no text");
  return String(out).replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}
async function googleChat(r, prompt, { system, maxTokens, images, signal }) {
  if (!r.key) throw new Error("Gemma on Google needs a Google AI Studio key (Admin → AI providers)");
  const model = String(r.model || GEMMA_DEFAULT).replace(/^models\//, "");
  if (!/^[\w.-]{1,80}$/.test(model)) throw new Error("Gemma on Google: that model name isn't valid");
  const pics = (images || []).map((u) => /^data:([\w/+.-]+);base64,(.+)$/s.exec(String(u)));
  if (pics.some((m) => !m)) throw new Error("Gemma on Google takes pictures as data only");
  const level = String(r.thinking || "").trim().toLowerCase(), think = ["minimal", "low", "medium", "high"].includes(level) ? level : "";
  const text = system ? system + "\n\n" + prompt : prompt;
  const res = await fetch(`${r.base}/models/${encodeURIComponent(model)}:generateContent`, { method: "POST", signal, headers: { "content-type": "application/json", "x-goog-api-key": r.key },
    body: JSON.stringify({ contents: [{ role: "user", parts: [...pics.map((m) => ({ inline_data: { mime_type: m[1], data: m[2] } })), { text }] }],
      generationConfig: { maxOutputTokens: maxTokens + (think && think !== "minimal" ? 4096 : 0), temperature: 0.3, ...(think ? { thinkingConfig: { thinkingLevel: think } } : {}) } }) });
  const txt = await res.text(); let d; try { d = JSON.parse(txt); } catch { d = { raw: txt }; }
  if (!res.ok) throw new Error(`Gemma on Google ${res.status}: ${String(d.error?.message || d.message || txt).slice(0, 200)}`);
  const cand = d.candidates?.[0], out = (cand?.content?.parts || []).filter((p) => p && !p.thought && typeof p.text === "string").map((p) => p.text).join("");
  if (!out.trim()) throw new Error("Gemma on Google returned no text" + (d.promptFeedback?.blockReason ? " (blocked: " + d.promptFeedback.blockReason + ")" : cand?.finishReason ? " (" + cand.finishReason + ")" : ""));
  return out.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}
